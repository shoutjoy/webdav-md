import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync('mdpro/js/app.js', 'utf8');
const chat = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8');
const image = { kind: 'image', name: 'portrait.png', dataUrl: 'data:image/png;base64,aGVsbG8=' };
const helpers = app.slice(app.indexOf('function normalizeAIChatMessages('), app.indexOf('function getAIChatLMContextLength('));
const complete = app.slice(app.indexOf('    complete: async function (request) {', app.indexOf('window.AIChatBridge = Object.freeze')), app.indexOf('    abort: function () {', app.indexOf('window.AIChatBridge = Object.freeze')));

for (const provider of ['lemonade', 'openai-compatible']) {
  for (const streaming of [false, true]) {
    test(`${provider} ${streaming ? 'streaming' : 'JSON'} request sends actual image bytes`, async () => {
      let body;
      const context = vm.createContext({
        AbortController, aiChatAbortController: null,
        applyLocalAIChatResponseStyle: request => request,
        getStoredLemonadeConnection: () => ({ baseUrl: 'local', apiKey: 'local', contextTokens: 8192 }),
        getStoredOpenAICompatibleConnection: () => ({ baseUrl: 'local', apiKey: 'local' }),
        isLemonadeImageModel: () => false, findCachedLemonadeModel: () => ({}),
        fitOpenAICompatibleMessages: rows => rows,
        openAICompatibleRequestUrl: () => 'http://test/chat/completions',
        streamOpenAICompatibleChat: async (_connection, payload) => { body = payload; return { text: 'description' }; },
        fetch: async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ choices: [{ message: { content: 'description' } }] }) }; }
      });
      vm.runInContext(app.slice(app.indexOf('function openAICompatibleHeaders('), app.indexOf('async function fetchOpenAICompatibleModels(')) + helpers + '\nvar bridge = {' + complete + '};', context);
      await context.bridge.complete({ provider, model: 'vision-model', onStreamEvent: streaming ? () => {} : undefined,
        messages: [{ role: 'user', content: '이 이미지를 설명해줘', attachments: [image] }] });
      assert.equal(body.model, 'vision-model');
      assert.equal(body.messages[0].content[0].text, '이 이미지를 설명해줘');
      assert.equal(body.messages[0].content[1].image_url.url, image.dataUrl);
      assert.equal(body.messages[0].attachments, undefined);
    });
  }
}

test('missing image data fails before a text-only request is sent', async () => {
  const context = vm.createContext({ AbortController, aiChatAbortController: null, applyLocalAIChatResponseStyle: value => value });
  vm.runInContext(app.slice(app.indexOf('function openAICompatibleHeaders('), app.indexOf('async function fetchOpenAICompatibleModels(')) + helpers + '\nvar bridge = {' + complete + '};', context);
  await assert.rejects(context.bridge.complete({ provider: 'lemonade', messages: [{ role: 'user', content: 'describe', attachments: [{ kind: 'image' }] }] }), /이미지를 다시 첨부/);
});

test('local image chat routes to vision transport and text chat retains its existing route', async () => {
  const context = vm.createContext({ AbortController, aiChatAbortController: null,
    applyLocalAIChatResponseStyle: value => value,
    completeLocalImageToolRequest: async request => ({ text: request.messages[0].attachments[0].dataUrl }),
    callNPUChat: async () => ({ text: 'text route' }) });
  vm.runInContext(app.slice(app.indexOf('function openAICompatibleHeaders('), app.indexOf('async function fetchOpenAICompatibleModels(')) + helpers + '\nvar bridge = {' + complete + '};', context);
  for (const provider of ['lmstudio', 'ollama', 'ollama-npu', 'litertlm', 'deepseek']) {
    assert.equal((await context.bridge.complete({ provider, messages: [{ role: 'user', content: 'describe', attachments: [image] }] })).text, image.dataUrl);
  }
  assert.equal((await context.bridge.complete({ provider: 'ollama-npu', messages: [{ role: 'user', content: 'hello' }] })).text, 'text route');
});

for (const retry of [false, true]) {
  test(`${retry ? 'retry' : 'edit'} restores independent image/document attachments and clears stale attachments`, () => {
    let sent = false;
    let rendered = 0;
    const input = { focus() {}, setSelectionRange() {} };
    const context = vm.createContext({ state: {}, attachmentLoading: false,
      pendingAttachments: [{ name: 'unrelated.png' }],
      document: { getElementById: () => input }, setStatus() {},
      renderPendingAttachments() { rendered++; }, sendMessage() { sent = true; }
    });
    vm.runInContext(chat.slice(chat.indexOf('  function putQuestionInComposer('), chat.indexOf('  function deleteQuestion(')), context);
    const message = { content: 'describe', attachments: [image, { kind: 'document', text: 'document' }] };
    context.putQuestionInComposer(message, retry);
    assert.equal(input.value, 'describe');
    assert.equal(context.pendingAttachments[0].dataUrl, image.dataUrl);
    assert.equal(context.pendingAttachments[1].text, 'document');
    assert.notEqual(context.pendingAttachments[0], image);
    context.pendingAttachments.pop();
    assert.equal(message.attachments.length, 2);
    assert.equal(sent, retry);
    assert.equal(rendered, 1);
    context.putQuestionInComposer({ content: 'text only' }, false);
    assert.equal(context.pendingAttachments.length, 0);
  });
}

test('clipping a retained image turn preserves attachment bytes', () => {
  const context = vm.createContext({ estimateAIChatTokens: text => text.length });
  vm.runInContext(app.slice(app.indexOf('function clipAIChatHistoryMessage('), app.indexOf('function retainAIChatHistory(')), context);
  const result = context.clipAIChatHistoryMessage({ role: 'user', content: 'x'.repeat(1000), attachments: [image] }, 200);
  assert.equal(result.attachments[0].dataUrl, image.dataUrl);
  assert.ok(result.content.length < 1000);
});

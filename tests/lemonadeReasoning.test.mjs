import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');

test('Lemonade reasoning is enabled independently of the display preference; quick and FAST stay off', () => {
  const flags = app.slice(app.indexOf('const enableThinking ='), app.indexOf("if (typeof request.onStreamEvent === 'function')", app.indexOf('const enableThinking ='))).replace(/}\s*$/, '');
  for (const [mode, disableThinking, fastMode, expected] of [
    ['reasoning', false, false, true], ['quick', false, false, false],
    ['reasoning', true, false, false], ['reasoning', false, true, false]
  ]) {
    const context = { request: { mode, disableThinking, fastMode }, requestBody: {} };
    vm.runInNewContext(flags, context);
    assert.equal(context.requestBody.chat_template_kwargs.enable_thinking, expected);
    assert.equal(context.requestBody.thinking, expected);
  }
});

test('Lemonade live rendering shows received reasoning while the final answer is pending', () => {
  const nodes = new Map();
  const getNode = id => {
    if (!nodes.has(id)) nodes.set(id, { style: {}, classList: { toggle() {} }, scrollHeight: 0, scrollTop: 0, clientHeight: 0 });
    return nodes.get(id);
  };
  const context = vm.createContext({
    state: { running: true, responseMode: 'reasoning', showReasoning: true, provider: 'lemonade' },
    liveStream: { reasoning: '모델이 보낸 추론 토큰', answer: '', progress: 35 },
    thinkingStartedAt: Date.now(), document: { getElementById: getNode }, setStatus() {}
  });
  vm.runInContext(chat.slice(chat.indexOf('  function estimateStreamTokens('), chat.indexOf('  function scheduleLiveStreamRender(')), context);
  context.updateLiveStreamDom();
  assert.equal(getNode('ai-chat-live-reasoning').hidden, false);
  assert.equal(getNode('ai-chat-live-reasoning-content').textContent, '모델이 보낸 추론 토큰');
  assert.equal(getNode('ai-chat-live-answer').hidden, false);
  context.state.showReasoning = false;
  context.updateLiveStreamDom();
  assert.equal(getNode('ai-chat-live-reasoning').hidden, true);
});

test('reasoning and empty answer events never claim document writing has started', () => {
  const written = [];
  const context = vm.createContext({
    state: { running: true, realtimeDocWrite: true, provider: 'lemonade' },
    liveStream: { reasoning: '', answer: '', progress: 2 },
    realtimeDocActive: false, realtimeDocWritten: '',
    providerDisplayName: () => 'Lemonade', scheduleLiveStreamRender() {},
    updateLiveStreamDom() {}, isActiveImageModel: () => false,
    getThinkingStage() { throw new Error('Elapsed time must not fabricate a stage'); },
    streamDeltaToRealtimeDoc(chunk) { written.push(chunk); context.realtimeDocWritten += chunk; },
    getBridge: () => ({ finishRealtimeDocStream() {} }),
    parseAssistantSections: text => ({ answer: text })
  });
  vm.runInContext(chat.slice(chat.indexOf('  function handleStreamEvent('), chat.indexOf('  function startThinkingProgress(')), context);
  const emit = event => context.handleStreamEvent({ provider: 'lemonade', ...event });
  emit({ type: 'reasoning.start' });
  emit({ type: 'reasoning.delta', content: '검토 메모' });
  assert.equal(context.liveStream.answer, '');
  assert.equal(context.liveStream.reasoning, '검토 메모');
  assert.match(context.liveStream.stage, /추론 중 · 문서 작성 대기/);
  assert.equal(written.length, 0);
  emit({ type: 'reasoning.end' });
  assert.match(context.liveStream.stage, /추론 완료 · 첫 본문 토큰 대기/);
  context.liveStream.phase = 'connecting';
  emit({ type: 'message.start' });
  emit({ type: 'message.delta', content: '' });
  context.updateThinkingProgress();
  assert.match(context.liveStream.stage, /첫 본문 토큰 대기/);
  context.realtimeDocActive = true;
  emit({ type: 'message.delta', content: '실제 본문' });
  assert.deepEqual(written, ['실제 본문']);
  assert.equal(context.liveStream.stage, '문서에 실시간 작성 중');
});

test('one request writes body chunks before completion while reasoning stays out of the document', async () => {
  let calls = 0;
  let documentText = '';
  let finish;
  const context = vm.createContext({
    state: { running: true, realtimeDocWrite: true, provider: 'lemonade' },
    liveStream: { reasoning: '', answer: '', progress: 2 },
    realtimeDocActive: false, realtimeDocWritten: '', realtimeDocAccumulated: '',
    providerDisplayName: () => 'Lemonade', scheduleLiveStreamRender() {},
    parseAssistantSections: text => ({ answer: text }),
    beginRealtimeDocForCurrentGeneration() { context.realtimeDocActive = true; },
    getBridge: () => ({
      complete(request) {
        calls++;
        assert.equal(request.mode, 'reasoning');
        assert.equal(request.disableThinking, false);
        request.onStreamEvent({ type: 'reasoning.delta', content: '근거를 검토' });
        assert.equal(documentText, '');
        request.onStreamEvent({ type: 'message.delta', content: '첫 문장. ' });
        assert.equal(documentText, '첫 문장. ');
        return new Promise(resolve => { finish = () => {
          request.onStreamEvent({ type: 'message.delta', content: '둘째 문장.' });
          request.onStreamEvent({ type: 'chat.end' });
          resolve({ text: documentText, reasoning: '근거를 검토' });
        }; });
      },
      writeRealtimeDocStreamChunk(delta) { documentText += delta; },
      finishRealtimeDocStream(text) { documentText = text; }
    })
  });
  vm.runInContext(chat.slice(chat.indexOf('  function handleStreamEvent('), chat.indexOf('  function updateThinkingProgress(')), context);
  vm.runInContext(chat.slice(chat.indexOf('  function streamDeltaToRealtimeDoc('), chat.indexOf('  function setOpen(')), context);
  context.baseRequest = { mode: 'reasoning', disableThinking: false, onStreamEvent: context.handleStreamEvent };
  const start = chat.indexOf('      // Stream the same model response');
  const flow = chat.slice(start, chat.indexOf('      if (nativeInternetSearch)', start));
  const pending = vm.runInContext('(async () => {' + flow + '; return result; })()', context);
  assert.equal(documentText, '첫 문장. ');
  assert.equal(calls, 1);
  finish();
  const result = await pending;
  assert.equal(documentText, '첫 문장. 둘째 문장.');
  assert.equal(result.reasoning, '근거를 검토');
  assert.equal(calls, 1);
});

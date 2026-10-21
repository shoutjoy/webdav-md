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

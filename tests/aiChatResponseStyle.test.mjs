import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function applyLocalAIChatResponseStyle(');
const end = source.indexOf('async function streamNPUChat(', start);

function harness() {
  let body;
  const context = vm.createContext({
    normalizeAIChatMessages: messages => messages,
    listNPUModels: async () => ['model-FLM'],
    localStorage: { getItem: () => JSON.stringify([{ id: 'model-FLM', context_length: 4096 }]) },
    getScholarAIProviderRuntime: () => ({ getLMStudioConfig: () => ({ quickMaxTokens: 2048 }) }),
    getNPUBaseUrl: () => 'http://localhost:13305/api/v1',
    requestLocalAIJson: async (url, options) => {
      body = JSON.parse(options.body);
      return { choices: [{ message: { content: '결과이다.' } }] };
    }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, get body() { return body; } };
}

for (const responseStyle of ['academic', 'polite']) {
  test(`${responseStyle} survives NPU system truncation and conflicting conversation history`, async () => {
    const h = harness();
    const request = { provider: 'ollama-npu', responseStyle,
      systemInstruction: 'Long evidence and formatting instructions. '.repeat(1000),
      messages: [{ role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Previous English answer.' },
        { role: 'user', content: '이어서 설명해줘' }] };
    const prepared = h.context.applyLocalAIChatResponseStyle(request);
    await h.context.callNPUChat(prepared);
    const expected = responseStyle === 'academic' ? '-이다/-한다' : '-습니다/-입니다';
    assert.ok(h.body.messages[0].content.includes(expected));
    assert.ok(h.body.messages.at(-1).content.includes(expected));
    assert.ok(h.body.messages.at(-1).content.startsWith('이어서 설명해줘'));
    assert.ok(h.body.messages.at(-1).content.includes('이번 사용자 요청'));
    assert.equal(request.messages.at(-1).content, '이어서 설명해줘');
    assert.ok(h.body.messages[0].content.length < request.systemInstruction.length);
  });
}

test('Ollama receives the current style without rewriting previous turns', () => {
  const { context } = harness();
  const messages = [{ role: 'assistant', content: '이전 답변입니다.' }, { role: 'user', content: '다시 설명' }];
  const request = context.applyLocalAIChatResponseStyle({ provider: 'ollama', responseStyle: 'academic', messages });
  assert.ok(request.systemInstruction.startsWith('[현재 답변 문체]'));
  assert.equal(request.messages[0].content, messages[0].content);
  assert.ok(request.messages[1].content.includes('한국어 학술체'));
});

test('internal requests without a selected tone do not acquire style instructions', () => {
  const { context } = harness();
  for (const request of [
    { provider: 'ollama', responseStyle: '', messages: [] },
    { provider: 'ollama-npu', messages: [] },
    { provider: 'aistudio', responseStyle: 'academic', messages: [] }
  ]) assert.equal(context.applyLocalAIChatResponseStyle(request), request);
});

test('Lemonade original replies receive the selected academic tone near the latest question', () => {
  const { context } = harness();
  const messages = [{ role: 'user', content: '잠재프로파일 분석을 설명해줘' }];
  const prepared = context.applyLocalAIChatResponseStyle({ provider: 'lemonade', preserveModelStyle: true, responseStyle: 'academic', messages });
  assert.match(prepared.systemInstruction, /한국어 학술체/);
  assert.match(prepared.messages[0].content, /-이다\/-한다/);
  assert.equal(prepared.preserveModelStyle, true);
  assert.equal(messages[0].content, '잠재프로파일 분석을 설명해줘');
});

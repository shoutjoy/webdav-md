import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = source.indexOf("            const fastMode = request.fastMode === true;", source.indexOf('const synced = await getScholarAIProviderRuntime().syncLMStudioLoadedModel();'));
const end = source.indexOf('            const result = streamEventHandler', start);
assert.ok(start > 0 && end > start);

function options(request) {
  const context = vm.createContext({
    request, config: { reasoningLevel: 'high', fastMaxTokens: 700, quickMaxTokens: 1000, reasoningMaxTokens: 2000 },
    contextLength: 8192, messages: [{ role: 'user', content: '질문' }], lastUserIndex: 0,
    synced: { model: 'local-model' }, controller: new AbortController(),
    estimateAIChatTokens: value => Math.ceil(String(value).length / 4),
    getAIChatHistoryOutputReserve: (_context, tokens) => tokens,
    retainAIChatHistory: () => []
  });
  return vm.runInContext(source.slice(start, end) + '\nchatOptions;', context);
}

test('LM Studio FAST disables reasoning even when the selected response mode is reasoning', () => {
  const result = options({ mode: 'reasoning', fastMode: true });
  assert.equal(result.reasoning, 'off');
  assert.equal(result.maxTokens, 700);
  assert.equal(result.completeStreaming, true);
  assert.equal(result.store, false);
});

test('LM Studio retains deep reasoning and honors explicit thinking disable independently of FAST', () => {
  assert.equal(options({ mode: 'reasoning' }).reasoning, 'high');
  assert.equal(options({ mode: 'reasoning' }).maxTokens, 2000);
  assert.equal(options({ mode: 'reasoning', disableThinking: true }).reasoning, 'off');
  assert.equal(options({ mode: 'quick' }).reasoning, 'off');
  assert.equal(options({ mode: 'reasoning', academicSearch: true }).reasoning, 'off');
  assert.equal(options({ mode: 'reasoning', fastMode: true, maxOutputTokens: 500 }).maxTokens, 500);
});

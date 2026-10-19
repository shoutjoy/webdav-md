import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const refresh = source.slice(source.indexOf('  async function refreshModels(silent)'), source.indexOf('  function formatConversationDate'));
function harness(provider, bridge) {
  const badge = { dataset: {} };
  const summary = {};
  const summaryCode = source.slice(source.indexOf('  function updateProviderSummary()'), source.indexOf('  function normalizeAcademicCount'));
  const context = vm.createContext({
    state: { open: true, provider, ollamaModel: 'cached-model' },
    providerConnections: {}, modelRefreshRevision: 0,
    document: { getElementById: id => id === 'ai-chat-provider-connection' ? badge : id === 'ai-chat-provider-summary' ? summary : null },
    getBridge: () => bridge, setStatus() {}, setModelOptions() {}, storageSet() {},
    updateHeaderModel() { context.updateProviderSummary(); }, updateModelModeUI() {},
    OLLAMA_MODEL_KEY: 'ollama'
  });
  vm.runInContext(summaryCode + refresh, context);
  return { context, badge };
}

test('cached model selection does not imply connection; silent refresh contacts Ollama', async () => {
  let resolve;
  let calls = 0;
  const { context, badge } = harness('ollama', { refreshOllamaModels() { calls++; return new Promise(r => { resolve = r; }); } });
  context.updateProviderSummary();
  assert.equal(badge.dataset.status, 'unknown');
  const pending = context.refreshModels(true);
  assert.equal(calls, 1);
  assert.equal(badge.dataset.status, 'checking');
  resolve([]);
  await pending;
  assert.equal(badge.dataset.status, 'connected');
});

test('LM Studio server with no loaded model is connected', async () => {
  const { context, badge } = harness('lmstudio', { async refreshLMStudioModels() { return { model: '', models: [] }; } });
  await context.refreshModels(true);
  assert.equal(context.state.lmModel, '');
  assert.equal(badge.dataset.status, 'connected');
});

test('failed server check is separate from model selection', async () => {
  const { context, badge } = harness('ollama', { async refreshOllamaModels() { throw new Error('offline'); } });
  await context.refreshModels(false);
  assert.equal(badge.dataset.status, 'error');
});

test('late failure from previous provider does not clear current provider model', async () => {
  let reject;
  const { context } = harness('ollama', { refreshOllamaModels() { return new Promise((_, r) => { reject = r; }); } });
  const pending = context.refreshModels(false);
  context.state.provider = 'lmstudio';
  context.state.lmModel = 'loaded-model';
  reject(new Error('offline'));
  await pending;
  assert.equal(context.state.lmModel, 'loaded-model');
});

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('mdpro/AI_App/ai_local/scholar-ai-provider.js', 'utf8');
function setup({ provider = 'auto', loaded = [], lmFail = false, models = ['available'], saved = '', cloud = false, streamFail = false, protectedKey, cloudModels } = {}) {
  const values = new Map([['ss_scholar_ai_provider', provider], ['ss_scholar_ai_ollama_model', saved]]);
  if (cloud) values.set('ss_gemini_api_key', 'test');
  const calls = [];
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const context = vm.createContext({ AbortController, DOMException, console, LocalAI: {
    loadConfig: () => ({ model: '' }), saveConfig: () => {},
    createClient: () => ({ listLoadedModels: async () => { calls.push('lm-probe'); if (lmFail) throw new Error('offline'); return loaded; },
      complete: async () => ({ text: 'LM answer' }),
      stream: async request => { request.onToken('partial'); if (streamFail) throw new Error('disconnected'); return { text: 'LM answer' }; } })
  } });
  vm.runInContext(source, context);
  const api = context.ScholarAIProvider.create({ storage,
    ...(protectedKey !== undefined ? { isAIStudioConfigured: () => protectedKey } : {}),
    ...(cloudModels ? { listAIStudioModels: async () => { calls.push('studio-probe'); return cloudModels; } } : {}),
    listOllamaModels: async () => { calls.push('ollama-probe'); return models; },
    callOllama: async (p, s, search, model) => { calls.push(model); return { text: 'Ollama answer', model }; },
    callAIStudio: async () => { calls.push('cloud'); return { text: 'cloud answer' }; }
  });
  return { api, calls, values };
}
test('auto probes default LM server even with no saved config', async () => {
  const h = setup({ loaded: [{ id: 'loaded' }] });
  assert.equal((await h.api.complete({ prompt: 'hello' })).provider, 'lmstudio');
  assert.deepEqual(h.calls, ['lm-probe']);
});
for (const provider of ['auto', 'lmstudio']) test(`${provider} discovers Ollama without a saved model when LM is offline`, async () => {
  const h = setup({ provider, lmFail: true, cloud: true });
  const result = await h.api.complete({ prompt: 'hello' });
  assert.equal(result.provider, 'ollama');
  assert.equal(result.model, 'available');
  assert.equal(result.fallbackFrom, 'lmstudio');
  assert.equal(h.values.get('ss_scholar_ai_ollama_model'), 'available');
  assert.deepEqual(h.calls, ['lm-probe', 'ollama-probe', 'available']);
});
test('replaces stale Ollama model with an installed model', async () => {
  const h = setup({ saved: 'removed' });
  assert.equal((await h.api.complete({})).model, 'available');
});
test('cloud fallback remains available when both local servers have no models', async () => {
  const h = setup({ models: [], cloud: true });
  assert.equal((await h.api.complete({})).provider, 'aistudio');
});
test('does not switch servers after streaming output starts', async () => {
  const h = setup({ loaded: [{ id: 'loaded' }], streamFail: true });
  await assert.rejects(h.api.complete({ onText() {} }), /disconnected/);
  assert.deepEqual(h.calls, ['lm-probe']);
});
test('abort during discovery prevents generation and fallback', async () => {
  const h = setup({ lmFail: true });
  const pending = h.api.complete({});
  h.api.abort();
  await assert.rejects(pending);
  assert.deepEqual(h.calls, ['lm-probe']);
});
for (const provider of ['auto', 'lmstudio']) test(`${provider} discovers AI Studio from ENV vault without a legacy key`, async () => {
  const h = setup({ provider, models: [], protectedKey: true, cloudModels: ['available-gemini'] });
  const result = await h.api.complete({});
  assert.equal(result.provider, 'aistudio');
  assert.equal(result.model, 'available-gemini');
  assert.equal(h.values.get('ss_scholar_ai_model'), 'available-gemini');
  assert.deepEqual(h.calls, ['lm-probe', 'ollama-probe', 'studio-probe', 'cloud']);
});
test('locked vault prevents use of a stale legacy AI Studio key', async () => {
  const h = setup({ models: [], cloud: true, protectedKey: false });
  await assert.rejects(h.api.complete({}), /로컬 AI 서버 연결 실패/);
  assert.ok(!h.calls.includes('cloud'));
});
test('sspimgAI connection indicator uses current ENV credentials and handles key removal', () => {
  const script = readFileSync('mdpro/sidebarAI/sidebar-ai.js', 'utf8');
  const start = script.indexOf('  function viewerSSPRefreshAIStudioConnection()');
  const end = script.indexOf("  window.addEventListener('mdp-credential-vault-change'", start);
  let key = 'configured';
  const status = { style: {} };
  const context = vm.createContext({ document: { getElementById: id => id === 'ssp-model' ? { parentNode: {} } : status }, getCallback: () => () => key });
  vm.runInContext(script.slice(start, end), context);
  context.viewerSSPRefreshAIStudioConnection();
  assert.match(status.textContent, /AI Studio 연결됨 · ENV/);
  assert.equal(status.style.color, '#22c55e');
  key = '';
  context.viewerSSPRefreshAIStudioConnection();
  assert.match(status.textContent, /잠금 해제/);
  assert.match(status.textContent, /미연결/);
  assert.equal(status.style.color, '#94a3b8');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
test('ENV model check synchronizes AI Jena after storing the complete installed list', async () => {
  const records = Array.from({ length: 10 }, (_, i) => ({ id: `model-${i}` }));
  let saved;
  let synchronized = false;
  const context = vm.createContext({
    document: { getElementById: () => null },
    getLemonadeFormConnection: () => ({}), openAICompatibleRequestUrl: (_connection, path) => path,
    fetch: async url => { assert.equal(url, 'models?show_all=true'); return { ok: true, json: async () => records }; },
    normalizeInstalledLemonadeModels: value => value, LEMONADE_MODELS_KEY: 'models',
    localStorage: { setItem: (_key, value) => { saved = JSON.parse(value); } },
    renderLemonadeModels() {}, preferredInstalledLemonadeModelId: () => '', setLemonadeStatus() {},
    window: { AIChat: { syncSettings() { assert.deepEqual(saved, records); synchronized = true; } } }
  });
  vm.runInContext(app.slice(app.indexOf('async function checkLemonadeModels()'), app.indexOf('async function saveLemonadeSettings()')), context);
  await context.checkLemonadeModels();
  assert.equal(synchronized, true);
});
test('installed Lemonade list retains all modalities but excludes undownloaded catalog entries', () => {
  const context = vm.createContext({ LEMONADE_DEFAULT_MODEL: 'chat' });
  vm.runInContext(app.slice(app.indexOf('function normalizeOpenAICompatibleModels('), app.indexOf('function readOpenAICompatibleModelsCache(')), context);
  const records = ['chat', 'image', 'tts', 'transcription', 'music'].map(id => ({ id, downloaded: true, labels: [id] }));
  const result = context.prioritizeInstalledLemonadeModels({ data: [...records, { id: 'not-installed', downloaded: false }] }, 'chat');
  assert.deepEqual(Array.from(result, row => row.id), records.map(row => row.id));
});
const refresh = source.slice(source.indexOf('  async function refreshModels(silent,'), source.indexOf('  function formatConversationDate'));
function harness(provider, bridge) {
  const badge = { dataset: {} };
  const summary = {};
  const modelSelect = { value: '' };
  const summaryCode = source.slice(source.indexOf('  function updateProviderSummary()'), source.indexOf('  function normalizeAcademicCount'));
  const context = vm.createContext({
    state: { open: true, provider, ollamaModel: 'cached-model' },
    providerConnections: {}, modelRefreshRevision: 0,
    document: { getElementById: id => id === 'ai-chat-provider-connection' ? badge : id === 'ai-chat-provider-summary' ? summary : id === 'ai-chat-model' ? modelSelect : null },
    getBridge: () => bridge, setStatus() {},
    setModelOptions(models, selected) { modelSelect.value = models.includes(selected) ? selected : models[0] || ''; },
    storageSet() {}, storageGet() { return ''; }, applyModelTokenProfile() {}, updateProviderUI() {},
    isActiveImageModel: () => false, isLemonadeImageModel: model => model === 'image', providerDisplayName: value => value,
    updateHeaderModel() { context.updateProviderSummary(); }, updateModelModeUI() {},
    OLLAMA_MODEL_KEY: 'ollama', LEMONADE_MODEL_KEY: 'lemonade', PROVIDER_KEY: 'provider'
  });
  vm.runInContext(summaryCode + refresh, context);
  return { context, badge, modelSelect };
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
  resolve(['cached-model']);
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

for (const [preferred, alternative] of [['lemonade', 'ollama'], ['ollama', 'lemonade']]) {
  test(`${preferred} offline automatically selects working ${alternative}`, async () => {
    const calls = [];
    const bridge = Object.fromEntries(['lemonade', 'ollama'].map(provider => [provider === 'lemonade' ? 'refreshLemonadeModels' : 'refreshOllamaModels', async () => {
      calls.push(provider);
      if (provider === preferred) throw new Error('offline');
      return ['chat-model'];
    }]));
    const { context, badge } = harness(preferred, bridge);
    await context.refreshModels(true);
    assert.deepEqual(calls, [preferred, alternative]);
    assert.equal(context.state.provider, alternative);
    assert.equal(badge.dataset.status, 'connected');
  });
}

test('both local servers offline stop after one fallback and display failure', async () => {
  let calls = 0;
  const offline = async () => { calls++; throw new Error('offline'); };
  const { context, badge } = harness('lemonade', { refreshLemonadeModels: offline, refreshOllamaModels: offline });
  await context.refreshModels(true);
  assert.equal(calls, 2);
  assert.equal(badge.dataset.status, 'error');
});

test('Lemonade silent refresh retains every installed modality and the selected chat model', async () => {
  let calls = 0;
  const models = ['chat-model', 'image', 'audio', 'music', 'transcription'];
  const { context, badge } = harness('lemonade', {
    async refreshLemonadeModels() { calls++; return models; },
    getCachedLemonadeModelRecords() { return [{ id: 'audio', labels: ['tts'] }, { id: 'chat-model', labels: ['chat'] }]; }
  });
  let visible;
  context.setModelOptions = (rows, selected) => { visible = [...rows]; context.document.getElementById('ai-chat-model').value = rows.includes(selected) ? selected : rows[0]; };
  context.state.lemonadeModel = 'chat-model';
  await context.refreshModels(true);
  assert.equal(calls, 1);
  assert.deepEqual(visible, models);
  assert.equal(context.state.lemonadeModel, 'chat-model');
  assert.equal(badge.dataset.status, 'connected');
});

for (const selected of ['image', 'audio', 'music', 'transcription']) {
  test(`Lemonade manual refresh preserves selected ${selected} and all installed models`, async () => {
    const models = ['chat-model', 'image', 'audio', 'music', 'transcription'];
    const { context, modelSelect, badge } = harness('lemonade', {
      async refreshLemonadeModels() { return models; }
    });
    let visible;
    context.setModelOptions = (rows, value) => { visible = [...rows]; modelSelect.value = rows.includes(value) ? value : rows[0]; };
    context.state.lemonadeModel = selected;
    await context.refreshModels(false);
    assert.deepEqual(visible, models);
    assert.equal(context.state.lemonadeModel, selected);
    assert.equal(badge.dataset.status, 'connected');
  });
}

test('startup defaults to Lemonade and migrates the old LM Studio default once', () => {
  const start = source.indexOf("    var savedProvider = storageGet(PROVIDER_KEY, 'lemonade');");
  const end = source.indexOf('    state.providerControlsOpen =', start);
  for (const [saved, revision, expected] of [
    [undefined, '', 'lemonade'], ['lmstudio', '', 'lemonade'],
    ['ollama', '', 'ollama'], ['openai', '', 'openai'],
    ['lmstudio', 'lemonade-ollama-v2', 'lmstudio']
  ]) {
    const values = new Map([['provider', saved], ['revision', revision]]);
    const context = vm.createContext({ state: {}, PROVIDER_KEY: 'provider', LOCAL_PROVIDER_DEFAULT_KEY: 'revision',
      storageGet: (key, fallback) => values.get(key) ?? fallback,
      storageSet: (key, value) => values.set(key, value)
    });
    vm.runInContext(source.slice(start, end), context);
    assert.equal(context.state.provider, expected);
  }
});

test('old LM Studio conversation cannot undo the preferred local provider', () => {
  const start = source.indexOf('    if (record && record.provider) {');
  const end = source.indexOf('    if (record && record.responseMode)', start);
  for (const preferred of ['lemonade', 'ollama']) {
    const context = vm.createContext({ record: { provider: 'lmstudio' }, state: { provider: preferred },
      PROVIDER_KEY: 'provider', storageGet: () => preferred });
    vm.runInContext(source.slice(start, end), context);
    assert.equal(context.state.provider, preferred);
  }
});

for (const fail of [false, true]) {
  test(`llama.cpp silent refresh contacts its server and ${fail ? 'retains an authentication error' : 'selects its model'}`, async () => {
    let calls = 0;
    const { context, badge } = harness('openai-compatible', {
      getCachedOpenAICompatibleModels() { throw new Error('must query server'); },
      async refreshOpenAICompatibleModels() { calls++; if (fail) throw new Error('HTTP 401'); return ['local-gguf']; }
    });
    context.storageGet = key => key === 'ss_openai_compatible_provider' ? 'llamacpp' : '';
    context.OPENAI_COMPATIBLE_MODEL_KEY = 'selected';
    await context.refreshModels(true);
    assert.equal(calls, 1);
    assert.equal(context.state.provider, 'openai-compatible');
    assert.equal(badge.dataset.status, fail ? 'error' : 'connected');
    assert.equal(context.state.openaiCompatibleModel, fail ? '' : 'local-gguf');
  });
}

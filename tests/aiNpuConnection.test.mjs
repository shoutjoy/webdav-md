import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const connect = source.slice(source.indexOf('window.connectAIJenaNPU ='), source.indexOf('function closeOpenAICompatibleModelMenu'));

function harness(models, failure) {
  const storage = new Map([['ss_ai_chat_provider', 'ollama']]);
  const writes = [];
  let syncs = 0;
  const context = vm.createContext({
    window: { AIChat: { syncSettings: () => syncs++ } },
    OPENAI_COMPATIBLE_PROVIDER_URLS: { lemonade: 'http://127.0.0.1:13305/api/v1' },
    OPENAI_COMPATIBLE_FREE_ONLY_KEY: 'freeOnly',
    fetchOpenAICompatibleModels: async connection => {
      assert.equal(connection.baseUrl, 'http://127.0.0.1:13305/api/v1');
      if (failure) throw failure;
      return models;
    },
    setAiSettings: async settings => writes.push(settings),
    loadOpenAICompatibleSettingsUI() {},
    OLLAMA_BASE_URL_KEY: 'ss_ollama_base_url', OLLAMA_MODELS_KEY: 'models',
    getOllamaSettings: () => ({ baseUrl: storage.get('ss_ollama_base_url') || 'http://127.0.0.1:11434', contextLength: 8192 }),
    listOllamaModels: async connection => {
      assert.equal(connection.baseUrl, 'http://127.0.0.1:13305');
      if (failure) throw failure;
      return models;
    },
    saveStoredModelList: (key, models) => writes.push(models),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    loadOllamaSettingsToUI() {}
  });
  vm.runInContext(connect, context);
  return { run: context.window.connectAIJenaNPU, restore: context.window.restoreAIJenaOllama, storage, writes, get syncs() { return syncs; } };
}

test('NPU connection selects the installed FLM model and persists loopback configuration', async () => {
  const h = harness(['qwen3-it-4b-FLM:latest']);
  assert.equal(await h.run(), 'qwen3-it-4b-FLM:latest');
  assert.equal(h.storage.get('ss_ai_chat_provider'), 'ollama');
  assert.equal(h.storage.get('ss_ai_chat_ollama_model'), 'qwen3-it-4b-FLM:latest');
  assert.equal(h.storage.get('ss_ollama_base_url'), 'http://127.0.0.1:13305');
  assert.equal(JSON.parse(h.storage.get('ss_ai_chat_ollama_generation_v1')).contextLength, 16384);
  assert.equal(h.syncs, 1);
});

test('OpenAI-compatible Lemonade connection preserves Ollama settings and selects the NPU model', async () => {
  const h = harness(['qwen3-it-4b-FLM']);
  h.storage.set('ss_ollama_base_url', 'http://127.0.0.1:11434');
  assert.equal(await h.run('openai-compatible'), 'qwen3-it-4b-FLM');
  assert.equal(h.storage.get('ss_ai_chat_provider'), 'openai-compatible');
  assert.equal(h.storage.get('ss_openai_compatible_base_url'), 'http://127.0.0.1:13305/api/v1');
  assert.equal(h.storage.get('ss_ai_chat_openai_compatible_model'), 'qwen3-it-4b-FLM');
  assert.equal(h.storage.get('ss_ollama_base_url'), 'http://127.0.0.1:11434');
  assert.equal(h.syncs, 1);
});

test('returning from NPU restores the original Ollama endpoint, model and generation settings', async () => {
  const h = harness(['qwen3-it-4b-FLM:latest']);
  h.storage.set('ss_ollama_base_url', 'http://127.0.0.1:11435');
  h.storage.set('ss_ai_chat_ollama_model', 'gemma4:e2b');
  h.storage.set('ss_ai_chat_ollama_generation_v1', '{"contextLength":4096}');
  await h.run();
  await h.run(); // Reconnecting must preserve the original backup.
  h.restore();
  assert.equal(h.storage.get('ss_ollama_base_url'), 'http://127.0.0.1:11435');
  assert.equal(h.storage.get('ss_ai_chat_ollama_model'), 'gemma4:e2b');
  assert.equal(h.storage.get('ss_ai_chat_ollama_generation_v1'), '{"contextLength":4096}');
});

test('missing NPU model preserves the active provider instead of selecting a CPU model', async () => {
  const h = harness(['Qwen3-4B-GGUF']);
  await assert.rejects(h.run(), /NPU 모델이 설치되지/);
  assert.equal(h.storage.get('ss_ai_chat_provider'), 'ollama');
  assert.equal(h.writes.length, 0);
});

test('unreachable NPU server leaves existing settings intact', async () => {
  const h = harness([], new Error('Failed to fetch'));
  await assert.rejects(h.run(), /Failed to fetch/);
  assert.equal(h.storage.get('ss_ai_chat_provider'), 'ollama');
  assert.equal(h.writes.length, 0);
});

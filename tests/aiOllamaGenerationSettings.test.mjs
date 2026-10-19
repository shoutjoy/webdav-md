import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const settingsSource = source.slice(source.indexOf('function normalizeOllamaGenerationSettings('), source.indexOf('function normalizeOllamaBaseUrl('));
const callSource = source.slice(source.indexOf('async function callOllamaChatText('), source.indexOf('function updateOllamaSettingsModeUI('));

function harness({ pending = false } = {}) {
  const storage = new Map();
  const requests = [];
  let timer, timeoutMs, cleared = false;
  const runtime = vm.createContext({
    URL, AbortController, OLLAMA_BASE_URL_KEY: 'base',
    localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
    window: { LocalAI: { loadConfig: () => ({ fastMaxTokens: 7, fastTimeoutMs: 42000 }) } },
    normalizeOllamaBaseUrl: value => value,
    normalizeAIChatMessages: messages => messages,
    estimateAIChatTokens: value => Math.ceil(String(value || '').length / 4),
    retainAIChatHistory: () => [],
    setTimeout: (callback, ms) => { timer = callback; timeoutMs = ms; return 1; },
    clearTimeout: () => { cleared = true; },
    requestLocalAITextStream: async (url, options, onChunk) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      if (pending) return new Promise((resolve, reject) => {
        const abort = () => { const error = new Error('cancelled'); error.name = 'AbortError'; reject(error); };
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      });
      onChunk(JSON.stringify({ model: 'gemma4:e2b-gpu', message: { content: '연결 성공' }, done: true, eval_count: 3, prompt_eval_count: 10, eval_duration: 100000000 }) + '\n');
    }
  });
  vm.runInContext(settingsSource + callSource, runtime);
  const controller = new AbortController();
  const run = (mode, overrides = {}, system = '') => runtime.callOllamaChatText(
    [{ role: 'user', content: 'test' }], system, 'gemma4:e2b-gpu', controller.signal, mode, undefined,
    { contextLength: 8192, quickMaxTokens: 11, reasoningMaxTokens: 13, temperature: 0, ...overrides }
  );
  return { runtime, storage, requests, controller, run, expire: () => timer(), get timeoutMs() { return timeoutMs; }, get cleared() { return cleared; } };
}

test('Ollama mode settings change the actual request, including FAST limits and thinking', async () => {
  for (const [mode, fastMode, tokens, thinking, timeout] of [
    ['quick', false, 11, false, 580000], ['reasoning', false, 13, true, 580000], ['reasoning', true, 7, false, 42000]
  ]) {
    const h = harness();
    const result = await h.run(mode, { fastMode });
    assert.equal(h.requests[0].body.options.num_predict, tokens);
    assert.equal(h.requests[0].body.options.num_ctx, 8192);
    assert.equal(h.requests[0].body.options.temperature, 0);
    assert.equal(h.requests[0].body.think, thinking);
    assert.equal(result.maxOutputTokens, tokens);
    assert.equal(h.timeoutMs, timeout);
    assert.equal(h.cleared, true);
  }
});

test('stored settings survive reads and normalize invalid values without losing zero temperature', () => {
  const h = harness();
  h.storage.set('ss_ai_chat_ollama_generation_v1', JSON.stringify({ contextLength: 16384, quickMaxTokens: 500, reasoningMaxTokens: 1500, timeoutMs: 90000, temperature: 0 }));
  const settings = h.runtime.getOllamaSettings();
  assert.equal(settings.contextLength, 16384);
  assert.equal(settings.quickMaxTokens, 500);
  assert.equal(settings.reasoningMaxTokens, 1500);
  assert.equal(settings.timeoutMs, 90000);
  assert.equal(settings.temperature, 0);
  assert.equal(h.runtime.normalizeOllamaGenerationSettings({ contextLength: -5 }).contextLength, 512);
  h.storage.set('ss_ai_chat_ollama_generation_v1', '{broken');
  assert.equal(h.runtime.getOllamaSettings().contextLength, 8192);
});

test('context budget caps output and rejects oversized fixed input before sending', async () => {
  const h = harness();
  const result = await h.run('quick', { contextLength: 512, quickMaxTokens: 1000 });
  assert.equal(result.maxOutputTokens, 255);
  await assert.rejects(h.run('quick', { contextLength: 512 }, 'x'.repeat(2048)), /컨텍스트를 초과/);
  assert.equal(h.requests.length, 1);
});

test('FAST timeout cancels the stream and releases the timer', async () => {
  const h = harness({ pending: true });
  const promise = h.run('quick', { fastMode: true });
  h.expire();
  await assert.rejects(promise, /FAST 제한 시간\(42초\)/);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.cleared, true);
});

test('user stop remains AbortError rather than a timeout', async () => {
  const h = harness({ pending: true });
  const promise = h.run('quick');
  h.controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(h.cleared, true);
});

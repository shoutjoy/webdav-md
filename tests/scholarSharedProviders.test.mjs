import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('mdpro/AI_App/ai_local/scholar-ai-provider.js', 'utf8');
test('ScholarAI model discovery uses the same protected DeepSeek credential as generation', async () => {
  let authorization;
  const context = vm.createContext({
    AbortController,
    fetch: async (url, options) => {
      authorization = options.headers.Authorization;
      assert.equal(options.method, 'GET');
      return { ok: true, json: async () => ({ data: [{ id: 'deepseek-model' }] }) };
    }
  });
  vm.runInContext(source, context);
  const api = context.ScholarAIProvider.create({
    storage: { getItem: () => null, setItem: () => {} },
    getCredential: () => 'protected'
  });
  assert.deepEqual(Array.from(await api.listDeepSeekModels()), ['deepseek-model']);
  assert.equal(authorization, 'Bearer protected');
});
test('ScholarAI exposes every AI Jena provider', () => {
  const jena = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8');
  const scholar = readFileSync('mdpro/sidebarAI/sidebar-ai.js', 'utf8');
  const options = jena.match(/id="ai-chat-provider">(.*?)<\/select>/)[1];
  for (const [, provider] of options.matchAll(/value="([^"]+)"/g)) {
    assert.ok(scholar.includes(`<option value="${provider}">`), provider);
  }
});
for (const provider of ['litertlm', 'ollama-npu', 'openai-compatible']) {
  test(`ScholarAI routes ${provider} with its own model and cancellation signal`, async () => {
    const values = new Map();
    const context = vm.createContext({ AbortController });
    vm.runInContext(source, context);
    let received;
    const api = context.ScholarAIProvider.create({
      storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
      getSharedModel: () => 'jena-default',
      callSharedProvider: async (request, signal) => {
        received = { request, signal };
        request.onText('answer');
        return { provider, model: request.model, text: 'answer' };
      }
    });
    assert.equal(api.setProvider(provider), provider);
    assert.equal(api.getModel(), 'jena-default');
    api.setModel('scholar-model');
    assert.equal(api.getModel(), 'scholar-model');
    let text = '';
    const result = await api.complete({ prompt: 'question', systemInstruction: 'instruction', onText: delta => { text += delta; } });
    assert.equal(result.provider, provider);
    assert.equal(result.model, 'scholar-model');
    assert.equal(received.request.prompt, 'question');
    assert.equal(received.request.systemInstruction, 'instruction');
    assert.equal(text, 'answer');
    assert.equal(received.signal.aborted, false);
  });
}

test('ScholarAI stop aborts a pending shared provider request', async () => {
  const context = vm.createContext({ AbortController });
  vm.runInContext(source, context);
  const api = context.ScholarAIProvider.create({
    storage: { getItem: () => null, setItem: () => {} },
    callSharedProvider: (request, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    })
  });
  const pending = api.complete({ provider: 'litertlm', model: 'test', prompt: 'question' });
  api.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

for (const provider of ['deepseek', 'openai']) {
  test(`ScholarAI ${provider} uses the protected credential instead of a stale legacy key`, async () => {
    const context = vm.createContext({ AbortController });
    vm.runInContext(source, context);
    let key;
    const call = async (...args) => { key = args[5]; return { text: 'answer' }; };
    const api = context.ScholarAIProvider.create({
      storage: { getItem: () => 'stale', setItem: () => {} },
      getCredential: () => 'protected', callOpenAI: call, callDeepseek: call
    });
    await api.complete({ provider, prompt: 'question' });
    assert.equal(key, 'protected');
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('mdpro/js/ai-tool-providers.js', 'utf8');
test('tool providers match AI Jena labels and order including Lemonade', () => {
    const context = vm.createContext({ window: {} });
    vm.runInContext(source, context);
    const jena = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8').match(/id="ai-chat-provider">(.*?)<\/select>/)[1];
    const expected = [...jena.matchAll(/value="([^"]+)">([^<]+)/g)].map(match => [match[1], match[2]]);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.AIToolProviders.catalog())).map(row => row.slice(0, 2)), expected);
});
test('each tool retains its own provider and model without switching to cloud', async () => {
    const stored = new Map([['ss_ai_chat_provider', 'ollama-npu'], ['ss_ai_chat_npu_model', 'qwen-FLM']]);
    const window = { localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) }, AIChatBridge: { refreshNPUModels: async () => ['qwen-FLM'] } };
    vm.runInContext(source, vm.createContext({ window }));
    const api = window.AIToolProviders;
    assert.equal(api.read('img2math').provider, 'ollama-npu');
    api.save('img2math', { provider: 'ollama', model: 'vision-model' });
    assert.equal(api.read('img2math').model, 'vision-model');
    assert.equal(api.read('mermaid').provider, 'ollama-npu');
    assert.equal(stored.get('ss_ai_chat_provider'), 'ollama-npu');
    assert.deepEqual(Array.from(await api.models('ollama-npu', true)), ['qwen-FLM']);
});

const app = readFileSync('mdpro/js/app.js', 'utf8');
const imageFunction = app.slice(app.indexOf('async function completeLocalImageToolRequest('), app.indexOf('window.AIChatBridge = Object.freeze'));
for (const provider of ['ollama', 'ollama-npu', 'lmstudio', 'openai-compatible', 'litertlm']) {
    test(`${provider} image request preserves chosen model and image bytes`, async () => {
        let payload;
        const context = vm.createContext({
            normalizeAIChatMessages: value => value,
            normalizeOllamaBaseUrl: value => value,
            getOllamaSettings: () => ({ baseUrl: 'http://localhost:11434' }),
            getNPUBaseUrl: () => 'http://localhost:13305/api/v1',
            getStoredOpenAICompatibleConnection: () => ({ baseUrl: 'https://example.test/v1', apiKey: 'test' }),
            getLiteRTLMSettings: () => ({}),
            getScholarAIProviderRuntime: () => ({ getLMStudioConfig: () => ({ baseUrl: 'http://localhost:5678/v1' }) }),
            fetch: async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ message: { content: 'latex' }, choices: [{ message: { content: 'latex' } }] }) }; },
            requestLiteRTLM: async (_path, options) => { payload = JSON.parse(options.body); return { data: { choices: [{ message: { content: 'latex' } }] } }; }
        });
        vm.runInContext(imageFunction, context);
        const result = await context.completeLocalImageToolRequest({ provider, model: 'chosen-vision', messages: [{ role: 'user', content: 'recognize', attachments: [{ kind: 'image', dataUrl: 'data:image/png;base64,aGVsbG8=' }] }] });
        assert.equal(payload.model, 'chosen-vision');
        assert.equal(result.provider, provider);
        if (provider === 'ollama') assert.equal(payload.messages[0].images[0], 'aGVsbG8=');
        else assert.equal(payload.messages[0].content[1].image_url.url, 'data:image/png;base64,aGVsbG8=');
    });
}

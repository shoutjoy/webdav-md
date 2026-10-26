const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const app = fs.readFileSync(require('node:path').join(__dirname, '../mdpro/js/app.js'), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

function setup() {
    const saved = new Map();
    const fields = Object.fromEntries(['provider', 'base-url', 'api-key', 'model-id', 'save-feedback'].map(id => ['openai-compatible-' + id, { value: '' }]));
    fields['openai-compatible-provider'].value = 'llamacpp';
    const context = {
        URL, AbortSignal, AbortController, DOMException, TextDecoder, setTimeout, clearTimeout, fetch,
        localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)) },
        document: { getElementById: id => fields[id] || null, addEventListener() {} },
        window: { location: new URL('http://127.0.0.1:9999') },
        setAiSettings: async () => {}, showToast() {},
        normalizeAIChatMessages: messages => messages, estimateAIChatTokens: () => 1,
        retainAIChatHistory: messages => messages
    };
    vm.createContext(context);
    vm.runInContext(between('const OPENAI_COMPATIBLE_DEFAULTS', 'function loadOpenAICompatibleSettingsUI(')
        + between('async function saveOpenAICompatibleSettings(', 'async function resetOpenAICompatibleSettings('), context);
    vm.runInContext(between('function aiChatMessagesWithImageContent(', 'function getAIChatLMContextLength('), context);
    // Execute the actual AI Jena compatible-provider branch, including its streaming path.
    const start = app.indexOf("            if (request.provider === 'openai-compatible' || request.provider === 'lemonade') {", app.indexOf('complete: async function (request)'));
    const end = app.indexOf("            if (['ollama-npu', 'openai-compatible', 'litertlm'].includes(request.provider))", start);
    vm.runInContext('async function complete(request) { const controller = new AbortController();' + app.slice(start, end) + '}', context);
    return { context, saved, fields };
}

test('llama.cpp normalizes server, API and endpoint URLs without changing other providers', () => {
    const { context: c } = setup();
    for (const raw of ['127.0.0.1:8080', 'http://127.0.0.1:8080/', 'http://127.0.0.1:8080/v1/', 'http://127.0.0.1:8080/v1/chat/completions', 'http://127.0.0.1:8080/v1/models?x=1#x']) {
        assert.equal(c.normalizeOpenAICompatibleBaseUrl(raw, 'llamacpp'), 'http://127.0.0.1:8080/v1');
    }
    assert.equal(c.normalizeOpenAICompatibleBaseUrl('https://host/proxy', 'llamacpp'), 'https://host/proxy/v1');
    assert.equal(c.normalizeOpenAICompatibleBaseUrl('http://[::1]:8080', 'llamacpp'), 'http://[::1]:8080/v1');
    assert.equal(c.normalizeOpenAICompatibleBaseUrl('https://api.perplexity.ai', 'perplexity'), 'https://api.perplexity.ai');
    assert.throws(() => c.normalizeOpenAICompatibleBaseUrl('file:///tmp', 'llamacpp'), /http/);
});

test('llama.cpp empty credentials and models cannot inherit cloud settings', () => {
    const { context: c, saved } = setup();
    saved.set('ss_openai_compatible_provider', 'llamacpp');
    saved.set('ss_openai_compatible_api_key', 'cloud-secret');
    saved.set('ss_ai_chat_openai_compatible_model', 'cloud/model');
    saved.set('ss_openai_compatible_base_url', 'https://cloud.invalid');
    const connection = c.getStoredOpenAICompatibleConnection();
    assert.equal(connection.apiKey, '');
    assert.equal(connection.modelId, '');
    assert.equal(connection.baseUrl, 'http://127.0.0.1:8080/v1');
    assert.equal(c.openAICompatibleHeaders(connection).Authorization, undefined);
    assert.throws(() => c.getStoredOpenAICompatibleConnection('groq'), /API Key/);
});

test('offline address remains saved with actionable error, without a cloud model fallback', async () => {
    const { context: c, fields, saved } = setup();
    saved.set('ss_openai_compatible_api_key_orcarouter', 'preserved-cloud-key');
    fields['openai-compatible-base-url'].value = '192.168.0.10:8080';
    c.fetch = async () => { throw new Error('Failed to fetch'); };
    await c.saveOpenAICompatibleSettings();
    assert.equal(saved.get('ss_openai_compatible_base_url_llamacpp'), 'http://192.168.0.10:8080/v1');
    assert.equal(saved.get('ss_openai_compatible_model_id_llamacpp'), '');
    assert.equal(saved.get('ss_openai_compatible_api_key_orcarouter'), 'preserved-cloud-key');
    assert.match(fields['openai-compatible-save-feedback'].textContent, /모델 자동 조회 실패.*CORS/);
});

test('address-only ENV save, AI Jena JSON/SSE, authentication and HTTP errors over real HTTP', async () => {
    const calls = [];
    const server = http.createServer(async (req, res) => {
        let raw = ''; for await (const part of req) raw += part;
        const body = raw ? JSON.parse(raw) : null;
        calls.push({ url: req.url, auth: req.headers.authorization, body });
        if (req.headers.authorization === 'Bearer bad') { res.writeHead(401); res.end(JSON.stringify({ error: { message: 'Invalid API Key' } })); return; }
        if (req.url === '/v1/models') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'local-gguf' }] })); return; }
        assert.equal(req.url, '/v1/chat/completions');
        assert.equal(body.model, 'local-gguf');
        if (body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.end('data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: '생각' } }] }) + '\n\ndata: ' + JSON.stringify({ choices: [{ delta: { content: '안녕하세요' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
        } else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: '안녕하세요' }, finish_reason: 'stop' }] })); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const { context: c, fields, saved } = setup();
        const base = 'http://127.0.0.1:' + server.address().port;
        fields['openai-compatible-base-url'].value = base;
        await c.saveOpenAICompatibleSettings();
        assert.equal(saved.get('ss_openai_compatible_base_url_llamacpp'), base + '/v1');
        assert.equal(saved.get('ss_openai_compatible_model_id_llamacpp'), 'local-gguf', fields['openai-compatible-save-feedback'].textContent);
        assert.equal(fields['openai-compatible-model-id'].value, 'local-gguf');
        const request = { provider: 'openai-compatible', openAICompatibleProvider: 'llamacpp', messages: [{ role: 'user', content: '안녕' }] };
        assert.equal((await c.complete(request)).text, '안녕하세요');
        const events = [];
        const streamed = await c.complete({ ...request, onStreamEvent: event => events.push(event) });
        assert.equal(streamed.text, '안녕하세요');
        assert.equal(streamed.reasoning, '생각');
        assert.ok(events.some(event => event.type === 'message.delta'));
        assert.ok(calls.every(call => call.auth === undefined));
        saved.set('ss_openai_compatible_api_key_llamacpp', 'my-key');
        await c.complete(request);
        assert.equal(calls.at(-1).auth, 'Bearer my-key');
        saved.set('ss_openai_compatible_api_key_llamacpp', 'bad');
        await assert.rejects(c.complete(request), /Invalid API Key/);
        await assert.rejects(c.fetchOpenAICompatibleModels(c.getStoredOpenAICompatibleConnection('llamacpp')), /Invalid API Key/);
        assert.ok(calls.every(call => !call.url.includes('load')));
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});


test('ENV restart retains llama.cpp and does not migrate to OrcaRouter', () => {
    const { context: c, saved, fields } = setup();
    saved.set('ss_openai_compatible_provider', 'llamacpp');
    saved.set('ss_openai_compatible_base_url_llamacpp', 'http://localhost:8080/v1');
    saved.set('ss_openai_compatible_api_key', 'old-cloud-key');
    saved.set('ss_openai_compatible_model_id', 'cloud/model');
    c.readOpenAICompatibleModelsCache = () => [];
    c.renderOpenAICompatibleModelMenu = () => [];
    c.validateOpenAICompatibleBaseUrlUI = () => {};
    vm.runInContext(between('function loadOpenAICompatibleSettingsUI(', 'async function saveOpenAICompatibleSettings('), c);
    c.loadOpenAICompatibleSettingsUI({});
    assert.equal(fields['openai-compatible-provider'].value, 'llamacpp');
    assert.equal(fields['openai-compatible-base-url'].value, 'http://localhost:8080/v1');
    assert.equal(fields['openai-compatible-api-key'].value, '');
    assert.equal(fields['openai-compatible-model-id'].value, '');
    assert.equal(saved.get('ss_openai_compatible_provider'), 'llamacpp');
    assert.equal(saved.get('ss_openai_compatible_api_key_orcarouter'), undefined);
});

test('llama.cpp model lookup rejects an empty list and respects cancellation', async () => {
    const { context: c } = setup();
    c.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
    await assert.rejects(c.resolveLlamaCppModel({ provider: 'llamacpp', baseUrl: 'http://localhost:8080/v1' }), /모델/);
    const controller = new AbortController();
    controller.abort();
    c.fetch = async (_url, options) => { options.signal.throwIfAborted(); };
    await assert.rejects(c.resolveLlamaCppModel({ provider: 'llamacpp', baseUrl: 'http://localhost:8080/v1' }, controller.signal), { name: 'AbortError' });
});

test('cloud preset switches do not inherit llama.cpp credentials or model', () => {
    const { context: c, fields, saved } = setup();
    saved.set('ss_openai_compatible_base_url_orcarouter', 'https://api.orcarouter.ai/v1');
    saved.set('ss_openai_compatible_api_key_orcarouter', 'cloud-key');
    saved.set('ss_openai_compatible_model_id_orcarouter', 'cloud/model');
    c.renderOpenAICompatibleModelMenu = () => [];
    c.validateOpenAICompatibleBaseUrlUI = () => {};
    fields['openai-compatible-provider'].value = 'orcarouter';
    c.applyOpenAICompatibleProviderPreset();
    assert.equal(fields['openai-compatible-api-key'].value, 'cloud-key');
    fields['openai-compatible-provider'].value = 'llamacpp';
    c.applyOpenAICompatibleProviderPreset();
    assert.equal(fields['openai-compatible-api-key'].value, '');
    assert.equal(fields['openai-compatible-model-id'].value, '');
    assert.equal(fields['openai-compatible-base-url'].value, 'http://127.0.0.1:8080/v1');
});

test('AI Jena cannot restore a cloud model when the ENV provider is llama.cpp', () => {
    const chat = fs.readFileSync(require('node:path').join(__dirname, '../mdpro/AI_App/aiChat/ai-chat.js'), 'utf8');
    const values = new Map([['ss_openai_compatible_provider', 'llamacpp'], ['ss_ai_chat_openai_compatible_model', 'cloud/model']]);
    const context = vm.createContext({ OPENAI_COMPATIBLE_MODEL_KEY: 'ss_ai_chat_openai_compatible_model', storageGet: (key, fallback) => values.get(key) ?? fallback });
    vm.runInContext(chat.slice(chat.indexOf('  function storedOpenAICompatibleModel('), chat.indexOf('  async function refreshModels(')), context);
    assert.equal(context.storedOpenAICompatibleModel(), '');
    values.set('ss_openai_compatible_model_id_llamacpp', 'local-gguf');
    assert.equal(context.storedOpenAICompatibleModel(), 'local-gguf');
});

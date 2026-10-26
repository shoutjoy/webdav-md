import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const models = readFileSync('mdpro/Apps/fmaviewer/js/ai/aiJenaModels.js', 'utf8');
const jena = readFileSync('mdpro/Apps/fmaviewer/js/ai/aiJena.js', 'utf8');
const upscale = readFileSync('mdpro/Apps/fmaviewer/js/image/imageUpscale.js', 'utf8');
function harness(initial = {}, response = {}) {
  const store = new Map(Object.entries(initial));
  const calls = [];
  const controls = Object.fromEntries(['aiJenaProvider', 'aiJenaImageModel', 'btnAiJenaRefreshModels', 'aiJenaModelStatus'].map(id => [id, {
    value: '', children: [], events: {}, addEventListener(name, fn) { this.events[name] = fn; },
    replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); }
  }]));
  const context = vm.createContext({ getMdproSettingsHost: () => ({ localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } }),
    getUsableAiStudioApiKey: () => 'test-key', findGeneratedImageBlock: data => data?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData,
    aiJenaState: { processing: false }, updateAiJenaKeyStatus() {}, AbortSignal,
    window: { getFmaLemonadeBaseUrl: () => '/api/lemonade/v1' },
    document: { getElementById: id => controls[id], createElement: () => ({}) },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: response.ok !== false, status: response.status || 200, json: async () => response.body || {} }; }
  });
  vm.runInContext(models, context);
  return { context, store, calls, controls };
}

test('FMA selection is independent from global image provider and preserves one model per provider', () => {
  const { context, store } = harness({ ss_image_provider: 'lemonade', ss_image_model_lemonade: 'Flux-4B' });
  assert.equal(context.getAiJenaImageConnection().model, 'Flux-4B');
  store.set('ss_fma_jena_provider', 'aistudio');
  store.set('ss_fma_jena_model_aistudio', 'models/gemini-2.5-flash-image');
  assert.equal(context.getAiJenaImageConnection().model, 'gemini-2.5-flash-image');
  assert.equal(store.get('ss_image_provider'), 'lemonade');
  store.set('ss_fma_jena_model_aistudio', 'gemini-3.1-flash-image-preview');
  assert.equal(context.getAiJenaImageConnection().model, 'gemini-3.1-flash-image');
  store.set('ss_fma_jena_provider', 'lemonade');
  assert.equal(context.getAiJenaImageConnection().model, 'Flux-4B');
});

test('Gemini edit posts original, mask, references and prompt via selected model generateContent', async () => {
  const { context, calls } = harness({}, { body: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'cmVzdWx0' } }] } }] } });
  const signal = new AbortController().signal;
  const result = await context.requestAiJenaStudioImage([
    { type: 'image', mime_type: 'image/jpeg', data: 'original' },
    { type: 'image', mime_type: 'image/png', data: 'mask' },
    { type: 'text', text: 'FACE REFERENCE' }, { type: 'image', mime_type: 'image/png', data: 'reference' },
    { type: 'text', text: 'black hair' }
  ], signal, 'gemini-2.5-flash-image');
  assert.match(calls[0].url, /models\/gemini-2.5-flash-image:generateContent$/);
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key');
  assert.equal(calls[0].options.signal, signal);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.contents[0].parts.filter(part => part.inlineData).map(part => part.inlineData.data), ['original', 'mask', 'reference']);
  assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.equal(result.src, 'data:image/png;base64,cmVzdWx0');
});

test('Google auth failure reports provider model and status, without exposing key', async () => {
  const { context } = harness({}, { ok: false, status: 403, body: { error: { message: 'API key not valid' } } });
  await assert.rejects(context.requestAiJenaStudioImage([{ type: 'text', text: 'test' }], undefined, 'gemini-image'), /AI Studio.*gemini-image.*HTTP 403.*API key not valid/);
});

test('Google missing image reports finish reason instead of inventing a successful edit', async () => {
  const { context } = harness({}, { body: { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'Cannot comply' }] } }] } });
  await assert.rejects(context.requestAiJenaStudioImage([], undefined, 'gemini-image'), /SAFETY.*Cannot comply/);
});

test('Google zero free-tier quota gives project billing recovery and makes exactly one request', async () => {
  const { context, calls, controls } = harness({}, { ok: false, status: 429, body: { error: {
    message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image. Please retry in 13h22m52s.'
  } } });
  await assert.rejects(context.requestAiJenaStudioImage([], undefined, 'gemini-3.1-flash-image'), error => {
    assert.equal(error.code, 'AI_STUDIO_QUOTA_ZERO');
    assert.match(error.message, /프로젝트.*할당량이 0/);
    assert.match(error.message, /결제/);
    assert.doesNotMatch(error.message, /13h22m|test-key/);
    return true;
  });
  assert.equal(calls.length, 1);
  assert.match(controls.aiJenaModelStatus.textContent, /할당량 0/);
});

test('structured quota failure detects numeric zero and does not confuse positive limits', () => {
  const { context } = harness();
  const error = context.createAiJenaStudioError({ error: { message: 'Resource exhausted', details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaValue: 0 }] }
  ] } }, 429, 'image-model');
  assert.equal(error.code, 'AI_STUDIO_QUOTA_ZERO');
  const temporary = context.createAiJenaStudioError({ error: { message: 'Quota exceeded, limit: 10' } }, 429, 'image-model');
  assert.equal(temporary.code, 'AI_STUDIO_RATE_LIMIT');
  assert.doesNotMatch(temporary.message, /할당량이 0/);
});

test('successful image response replaces prior quota error status', async () => {
  const { context, controls } = harness({}, { body: { candidates: [{ content: { parts: [{ inlineData: { data: 'result' } }] } }] } });
  controls.aiJenaModelStatus.textContent = '할당량 0';
  await context.requestAiJenaStudioImage([], undefined, 'image-model');
  assert.match(controls.aiJenaModelStatus.textContent, /이미지 출력을 확인/);
});

test('model refresh filters text models and persists chosen image model without changing global selection', async () => {
  const { context, controls, calls, store } = harness({}, { body: { models: [
    { name: 'models/gemini-custom-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-chat', supportedGenerationMethods: ['generateContent'] }
  ] } });
  context.initAiJenaModelControls();
  await controls.btnAiJenaRefreshModels.events.click();
  const ids = controls.aiJenaImageModel.children.map(option => option.value);
  assert.ok(ids.includes('gemini-custom-image'));
  assert.ok(!ids.includes('gemini-chat'));
  assert.match(controls.aiJenaModelStatus.textContent, /연결 확인/);
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-key');
  controls.aiJenaImageModel.value = 'gemini-custom-image';
  controls.aiJenaImageModel.events.change();
  assert.equal(store.get('ss_fma_jena_model_aistudio'), 'gemini-custom-image');
  assert.equal(store.get('ss_image_provider'), undefined);
});

test('Jena dispatches selected provider/model rather than global model or upscale interactions endpoint', async () => {
  const calls = [];
  const context = vm.createContext({ aiJenaState: { mode: 'edit', sourceItem: {}, references: {} },
    getAiImagePayload: async () => ({ mimeType: 'image/png', data: 'original' }),
    isAiKeyUsageEnabled: () => true,
    getAiJenaImageConnection: () => ({ provider: 'lemonade', model: 'Chosen-Flux' }),
    window: { getFmaLemonadeImageSettings: () => ({ width: 768, height: 1024, steps: 8, cfgScale: 0, seed: 42 }), requestFmaLemonadeImage: async (...args) => calls.push(args) }, appendAiJenaMessage() {}, setAiJenaProgress() {}, setAiJenaRequestPhase() {}, prepareAiJenaLocalImages: async input => input
  });
  vm.runInContext(jena.slice(jena.indexOf('async function requestAiJenaImage('), jena.indexOf('async function requestAiJenaVideo(')), context);
  await context.requestAiJenaImage('change hair', undefined);
  assert.equal(calls[0][2].model, 'Chosen-Flux');
  assert.equal(calls[0][2].imageSettings.width, 768);
  assert.equal(calls[0][2].imageSettings.height, 1024);
  assert.equal(calls[0][0][0].data, 'original');
});

test('Lemonade new generation does not load or describe the current edit source', async () => {
  const calls = [];
  const context = vm.createContext({ aiJenaState: { mode: 'generate', sourceItem: {}, references: {} },
    getAiImagePayload: async () => { throw new Error('must not load current source'); },
    isAiKeyUsageEnabled: () => true, setAiJenaRequestPhase() {},
    getAiJenaImageConnection: () => ({ provider: 'lemonade', model: 'Chosen-Flux' }),
    window: { getFmaLemonadeImageSettings: () => ({ width: 512, height: 768 }), requestFmaLemonadeImage: async (...args) => calls.push(args) },
    prepareAiJenaLocalImages: async input => input
  });
  vm.runInContext(jena.slice(jena.indexOf('async function requestAiJenaImage('), jena.indexOf('async function requestAiJenaVideo(')), context);
  await context.requestAiJenaImage('a red mug');
  assert.equal(calls[0][0].length, 1);
  assert.equal(calls[0][0][0].text, 'a red mug');
  assert.equal(calls[0][2].mode, 'generate');
});

test('FMA credential lookup uses owning MDPro frame and respects vault lock', () => {
  let locked = false;
  const context = vm.createContext({ getMdproSettingsHost: () => ({ MDPCredentialVault: {
    getSecret: () => locked ? '' : 'vault-key', getStatus: () => ({ locked, entries: [{ id: 'gemini', configured: true }] })
  }, localStorage: { getItem: () => 'legacy-key' } }), readUpscaleSetting: () => 'old-fma-key', AI_API_KEY_STORAGE: 'key', console });
  vm.runInContext(upscale.slice(upscale.indexOf('function getAiStudioApiKey('), upscale.indexOf('function isAiKeyUsageEnabled(')), context);
  assert.equal(context.getAiStudioApiKey(), 'vault-key');
  locked = true;
  assert.equal(context.getAiStudioApiKey(), '');
});


test('button session overrides the saved provider without changing global or FMA preferences', () => {
  const { context, store } = harness({ ss_image_provider: 'aistudio', ss_fma_jena_provider: 'aistudio', ss_fma_jena_model_lemonade: 'Local-Flux' });
  context.aiJenaState.imageProvider = 'lemonade';
  assert.equal(context.getAiJenaImageConnection().provider, 'lemonade');
  assert.equal(context.getAiJenaImageConnection().model, 'Local-Flux');
  assert.equal(store.get('ss_image_provider'), 'aistudio');
  assert.equal(store.get('ss_fma_jena_provider'), 'aistudio');
});

test('closing during generation aborts and hides the editor with one click', () => {
  let aborted = false;
  const context = vm.createContext({ aiJenaState: { processing: true, open: true },
    stopAiJena: () => { aborted = true; }, closeAiJenaReferencePreview() {}, closeAiJenaFmaPicker() {}, closeAiJenaSaveChoice() {},
    dom: { aiJenaModal: { style: { display: 'flex' } } }
  });
  vm.runInContext(jena.slice(jena.indexOf('function closeAiJena()'), jena.indexOf('function setAiJenaMode(')), context);
  context.closeAiJena();
  assert.equal(aborted, true);
  assert.equal(context.aiJenaState.open, false);
  assert.equal(context.dom.aiJenaModal.style.display, 'none');
});

test('Lemonade session never silently submits Veo to AI Studio', async () => {
  const context = vm.createContext({ getAiJenaImageConnection: () => ({ provider: 'lemonade' }) });
  const start = jena.indexOf('async function requestAiJenaVideo(');
  const end = jena.indexOf('\nfunction ', start);
  vm.runInContext(jena.slice(start, end), context);
  await assert.rejects(context.requestAiJenaVideo('test'), /AI Studio/);
});

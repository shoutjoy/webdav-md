import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
function harness(initial = {}) {
  const store = new Map(Object.entries(initial));
  const calls = [];
  const scope = vm.createContext({
    FormData, Blob, Uint8Array, atob,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    LEMONADE_DEFAULT_MODEL: 'chat',
    findCachedLemonadeModel: id => ({ image_defaults: id === 'SD' ? { width: 768, height: 512, steps: 8, cfg_scale: 2 } : { width: 256, height: 256, steps: 4, cfg_scale: 1 } }),
    openAICompatibleRequestUrl: (_, path) => path,
    openAICompatibleHeaders: () => ({ 'Content-Type': 'application/json' }),
    readOpenAICompatibleError: async () => 'server error',
    fetch: async (url, request) => {
      calls.push({ url, request });
      return { ok: true, json: async () => ({ data: [{ b64_json: 'cmVzdWx0' }] }) };
    }
  });
  vm.runInContext(app.slice(app.indexOf('function getLemonadeImageSettings('), app.indexOf('function lemonadeImageSizeForRatio(')), scope);
  return { scope, store, calls };
}

test('Flux native default overrides the 256px server draft; SD keeps model defaults', () => {
  const { scope } = harness();
  assert.equal(scope.getLemonadeImageSettings('Flux-Klein').width, 1024);
  assert.equal(scope.getLemonadeImageSettings('Flux-Klein').steps, 4);
  assert.equal(scope.getLemonadeImageSettings('Flux-Klein').cfgScale, 1);
  assert.equal(scope.getLemonadeImageSettings('SD').width, 768);
  assert.equal(scope.getLemonadeImageSettings('SD').steps, 8);
});

test('legacy settings migrate once to their original model without leaking across model switches', () => {
  const { scope, store } = harness({ ss_openai_compatible_model_id_lemonade: 'Flux-old', ss_lemonade_image_size: '512x512', ss_lemonade_image_cfg_scale: '0' });
  assert.equal(scope.getLemonadeImageSettings('Flux-old').width, 512);
  assert.equal(scope.getLemonadeImageSettings('Flux-old').cfgScale, 0);
  store.set('ss_openai_compatible_model_id_lemonade', 'Flux-new');
  store.set('ss_lemonade_image_size', '768x768');
  assert.equal(scope.getLemonadeImageSettings('Flux-new').width, 1024);
  assert.equal(scope.getLemonadeImageSettings('Flux-old').width, 512);
});

test('model settings normalize ranges, blanks, NaN and infinity and preserve zero CFG', () => {
  const { scope } = harness();
  const result = scope.saveLemonadeImageSettings('Flux', { width: 770, height: 9999, steps: 70, cfgScale: 0, seed: 9999999999 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { width: 768, height: 1536, steps: 50, cfgScale: 0, seed: 2147483647 });
  const fallback = scope.getLemonadeImageSettings('Flux-other', { width: '', height: Infinity, steps: NaN, cfgScale: '', seed: '' });
  assert.deepEqual(JSON.parse(JSON.stringify(fallback)), { width: 1024, height: 1024, steps: 4, cfgScale: 1, seed: -1 });
  assert.equal(scope.getLemonadeImageSettings('Flux').width, 768);
  assert.equal(scope.getLemonadeImageSettings('Flux-other').width, 1024);
});

for (const edit of [false, true]) test(`${edit ? 'multipart edit' : 'JSON generation'} sends a frozen size, steps, zero CFG and seed`, async () => {
  const { scope, calls } = harness();
  scope.saveLemonadeImageSettings('Flux', { width: 1024, height: 576, steps: 4, cfgScale: 0, seed: 42 });
  const result = await scope.generateLemonadeImage({ apiKey: 'lemonade' }, 'Flux', [{ role: 'user', content: 'blue cup',
    attachments: edit ? [{ kind: 'image', dataUrl: 'data:image/png;base64,aGVsbG8=', name: 'cup.png' }] : [] }]);
  const body = edit ? Object.fromEntries(calls[0].request.body) : JSON.parse(calls[0].request.body);
  assert.equal(body.size, '1024x576');
  assert.equal(Number(body.steps), 4);
  assert.equal(Number(body.cfg_scale), 0);
  assert.equal(Number(body.seed), 42);
  assert.equal(body.prompt, 'blue cup');
  assert.equal(calls[0].url, edit ? 'images/edits' : 'images/generations');
  if (edit) assert.equal(await body.image.text(), 'hello');
  scope.saveLemonadeImageSettings('Flux', { seed: 99 });
  assert.equal(result.imageSettings.seed, 42);
});

test('Jena preset, model switch, native change and running lock use the model store', () => {
  const { scope } = harness();
  const elements = {};
  for (const name of ['width', 'height', 'steps', 'cfg', 'seed']) elements['ai-chat-image-' + name] = {};
  elements['ai-chat-image-preset'] = { options: ['512x512', '1024x1024', 'custom'].map(value => ({ value })) };
  elements['ai-chat-lemonade-image-settings'] = {};
  Object.assign(scope, { state: { provider: 'lemonade', lemonadeModel: 'Flux-A', running: false },
    document: { getElementById: id => elements[id] }, isLemonadeImageModel: () => true,
    getBridge: () => ({ getLemonadeImageSettings: scope.getLemonadeImageSettings, saveLemonadeImageSettings: scope.saveLemonadeImageSettings }) });
  vm.runInContext(chat.slice(chat.indexOf('  function syncLemonadeImageControls('), chat.indexOf('  function updateModelModeUI(')), scope);
  scope.syncLemonadeImageControls();
  assert.equal(elements['ai-chat-image-width'].value, 1024);
  const preset = elements['ai-chat-image-preset'];
  preset.value = '512x512';
  scope.saveLemonadeImageControls({ target: preset });
  elements['ai-chat-image-seed'].value = '42';
  scope.saveLemonadeImageControls({ target: elements['ai-chat-image-seed'] });
  scope.state.lemonadeModel = 'Flux-B';
  scope.syncLemonadeImageControls();
  assert.equal(elements['ai-chat-image-width'].value, 1024);
  scope.state.lemonadeModel = 'Flux-A';
  scope.syncLemonadeImageControls();
  assert.equal(elements['ai-chat-image-width'].value, 512);
  assert.equal(elements['ai-chat-image-seed'].value, 42);
  scope.state.running = true;
  scope.syncLemonadeImageControls();
  assert.equal(preset.disabled, true);
  assert.equal(elements['ai-chat-image-seed'].disabled, true);
});

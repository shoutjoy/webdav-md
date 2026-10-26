import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync('mdpro/Apps/fmaviewer/js/image/lemonadeQuality.js', 'utf8');
function harness(initial = {}, bridge) {
  const store = new Map(Object.entries(initial));
  const host = { AIChatBridge: bridge, addEventListener() {}, localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } };
  const window = {};
  vm.runInNewContext(source, { window, getMdproSettingsHost: () => host, document: { querySelectorAll: () => [] } });
  return { window, store };
}
test('standalone FMA shares Jena per-model persistence, clamps dimensions and keeps zero CFG', () => {
  const { window, store } = harness();
  const settings = window.saveFmaLemonadeImageSettings('Flux-A', { width: 770, height: 9000, cfgScale: 0, steps: 100, seed: 42 });
  assert.deepEqual(JSON.parse(JSON.stringify(settings)), { width: 768, height: 1536, cfgScale: 0, steps: 50, seed: 42 });
  assert.equal(JSON.parse(store.get('ss_ai_chat_lemonade_image_v1:Flux-A')).width, 768);
  assert.equal(window.getFmaLemonadeImageSettings('Flux-B').width, 1024);
  assert.equal(window.getFmaLemonadeImageSettings('Flux-A').width, 768);
});
test('FMA delegates settings to the owning MDPro bridge', () => {
  const calls = [];
  const { window } = harness({}, { getLemonadeImageSettings: (...args) => { calls.push(args); return { width: 576 }; }, saveLemonadeImageSettings: (...args) => { calls.push(args); return { height: 1024 }; } });
  assert.equal(window.getFmaLemonadeImageSettings('Flux').width, 576);
  assert.equal(window.saveFmaLemonadeImageSettings('Flux', { height: 1024 }).height, 1024);
  assert.equal(calls.length, 2);
});
test('legacy resolution migrates only to its original model', () => {
  const { window } = harness({ ss_openai_compatible_model_id_lemonade: 'Flux-old', ss_lemonade_image_size: '512x768', ss_lemonade_image_cfg_scale: '0' });
  assert.equal(window.getFmaLemonadeImageSettings('Flux-old').height, 768);
  assert.equal(window.getFmaLemonadeImageSettings('Flux-old').cfgScale, 0);
  assert.equal(window.getFmaLemonadeImageSettings('Flux-new').height, 1024);
});

test('a completed generated result becomes the next edit source while manual history stays locked', async () => {
  const code = readFileSync('mdpro/Apps/fmaviewer/js/ai/aiJena.js', 'utf8');
  const state = { processing: true, history: [{ src: 'data:image/png;base64,generated', path: 'generated', mimeType: 'image/png' }] };
  const scope = vm.createContext({ aiJenaState: state, loadUpscaleImage: async () => ({}),
    dom: { btnAddAiJenaResult: {}, aiJenaResultPreview: { style: {} } }, drawAiJenaSource() {}, renderAiJenaHistory() {} });
  vm.runInContext(code.slice(code.indexOf('async function selectAiJenaHistoryEntry('), code.indexOf('async function addAiJenaResult(')), scope);
  await scope.selectAiJenaHistoryEntry(0, false);
  assert.equal(state.sourceItem, undefined);
  await scope.selectAiJenaHistoryEntry(0, false, true);
  assert.equal(state.sourceItem.src, state.history[0].src);
  assert.equal(state.resultSrc, state.history[0].src);
  const addCode = code.slice(code.indexOf('async function addAiJenaHistoryResult('), code.indexOf('async function addAiJenaVideoHistoryResult('));
  assert.match(addCode, /selectAiJenaHistoryEntry\(aiJenaState.history.length - 1, false, true\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../mdpro/Apps/fmaviewer/js/image/backgroundRemove.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function loadMediaPipeSelfieSegmentationScript()'), source.indexOf('async function runWebGlBackgroundRemoval('));

function setup() {
  const nodes = [];
  const stale = { remove() { this.removed = true; } };
  const context = vm.createContext({ window: {}, Promise, DOMException, setTimeout, clearTimeout,
    document: {
      querySelector: () => stale,
      createElement: () => {
        const listeners = {};
        const script = { listeners, addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: name => { delete listeners[name]; }, remove() { this.removed = true; } };
        return script;
      }, head: { appendChild: script => nodes.push(script) },
    },
  });
  vm.runInContext(`var mediaPipeScriptPromise=null, mediaPipeSessionPromise=null, mediaPipePendingResult=null;
    const MEDIAPIPE_SELFIE_SEGMENTATION_SCRIPT='https://example.test/engine.js';
    const MEDIAPIPE_SELFIE_SEGMENTATION_ASSET_ROOT='https://example.test/';\n${functions}`, context);
  return { context, nodes, stale };
}

test('failed WebGL script is removed and next attempt loads a fresh element', async () => {
  const { context, nodes, stale } = setup();
  const first = vm.runInContext('loadMediaPipeSelfieSegmentationScript()', context);
  nodes[0].listeners.error();
  await assert.rejects(first, /불러오지/);
  assert.equal(stale.removed, true);
  assert.equal(nodes[0].removed, true);
  const second = vm.runInContext('loadMediaPipeSelfieSegmentationScript()', context);
  assert.equal(nodes.length, 2);
  context.window.SelfieSegmentation = function Engine() {};
  nodes[1].listeners.load();
  assert.equal(await second, context.window.SelfieSegmentation);
});

test('failed inference closes poisoned session and releases pending request for retry', async () => {
  const { context } = setup();
  let closed = false;
  context.session = { send: () => Promise.reject(new Error('WebGL context lost')), close: () => { closed = true; } };
  vm.runInContext('mediaPipeSessionPromise=Promise.resolve(session)', context);
  await assert.rejects(vm.runInContext('requestMediaPipeSegmentation(session, {}, null)', context), /context lost/);
  assert.equal(closed, true);
  assert.equal(vm.runInContext('mediaPipeSessionPromise', context), null);
  assert.equal(vm.runInContext('mediaPipePendingResult', context), null);
});

test('local BG Remove opens without loading unrelated AI prompt settings', () => {
  const node = () => ({ style: {}, focus() {} });
  const dom = new Proxy({}, { get(target, key) { return target[key] ||= node(); } });
  const context = vm.createContext({ dom, images: [{ src: 'data:image/png;base64,test' }], bgRemoveState: {},
    readBackgroundRemoveLocalEngine: () => 'webgl', resolveBackgroundRestoreSourceSrc: item => item.src,
    readBackgroundBoundarySetting() {}, readCustomBackgroundSettings() {}, setBackgroundRemoveGalleryButtonVisible() {},
    updateBackgroundRemoveEngineUi() {}, updateBackgroundBoundaryControl() {}, updateCustomBackgroundControls() {},
    closeBgRemoveSaveChoice() {}, setBgRemoveProgress() {}, ensureBackgroundRemoveModalVisible: () => { dom.bgRemoveModal.style.display = 'flex'; },
  });
  vm.runInContext(source.slice(source.indexOf('function openBackgroundRemoveEditor(index, mode)'), source.indexOf('async function openDirectBackgroundMaskEditor()')), context);
  vm.runInContext('openBackgroundRemoveEditor(0, "local")', context);
  assert.equal(dom.bgRemoveModal.style.display, 'flex');
  assert.equal(dom.bgRemovePreview.src, 'data:image/png;base64,test');
});

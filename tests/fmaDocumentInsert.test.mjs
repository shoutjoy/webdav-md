import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const host = readFileSync('mdpro/js/internal-image-app.js', 'utf8');
const child = readFileSync('mdpro/Apps/fmaviewer/js/integrations/mdViewerBridge.js', 'utf8');
const preview = readFileSync('mdpro/Apps/fmaviewer/js/gallery/preview.js', 'utf8');
const insert = readFileSync('mdpro/imageDB/image_insert.js', 'utf8');
const dataUrl = 'data:image/png;base64,aGVsbG8=';

function harness({ blob = false, missingApi = false } = {}) {
  const sourceWindow = {};
  const calls = [];
  const input = { dispatchEvent() {} };
  const global = { openImageInsertModal: () => calls.push('open'), setImageInsertStatus() {} };
  const context = vm.createContext({
    global, state: { frame: { contentWindow: sourceWindow } },
    document: { getElementById: () => input }, Event: class {},
    close: () => calls.push('close'),
    isEditMode: false, toggleMode: mode => calls.push(mode),
    bridge: () => null, showStatus: message => calls.push(message),
    imageInsertCurrentDataUrl: '', imageInsertCurrentFileName: '',
    clearImageInsertInternalSavedState() {}, setImageInsertPreview: value => calls.push(value),
    renderImageInsertInternalInfo() {}, setImageInsertStatus() {},
    fetch: async url => { assert.equal(url, 'blob:photo'); return { ok: true, blob: async () => ({}) }; },
    FileReader: class { readAsDataURL() { this.result = dataUrl; this.onload(); } }
  });
  vm.runInContext(insert.slice(insert.indexOf('function applyImageInsertDataUrl('), insert.indexOf('function revokeImageInsertGalleryObjectUrls(')), context);
  if (!missingApi) global.applyImageInsertDataUrl = context.applyImageInsertDataUrl;
  const helpers = host.slice(host.indexOf('    async function imageToDataUrl('), host.indexOf('    async function openCrop('))
    + host.slice(host.indexOf('    async function openImageInsertFromViewer('), host.indexOf('    function insertImageUrl('))
    + host.slice(host.indexOf('    async function handleMessage('), host.indexOf('    function bindElectronOpen('));
  vm.runInContext(helpers, context);
  return { context, calls, sourceWindow, input, src: blob ? 'blob:photo' : dataUrl };
}

for (const blob of [false, true]) {
  test(`FMA document button transfers selected ${blob ? 'blob' : 'chat data URL'} photo into IMG`, async () => {
    const h = harness({ blob });
    let event;
    const parent = { postMessage: data => { event = { data, source: h.sourceWindow }; } };
    const childContext = vm.createContext({ global: { parent, images: [{ src: 'wrong-photo', path: 'first.png' }, { src: h.src, path: 'portrait.png' }], currentIndex: 0 }, fileName: value => value });
    vm.runInContext(child.slice(child.indexOf('    function currentImagePayload('), child.indexOf('    function getImageCount(')), childContext);
    const action = preview.match(/bridge\.sendAction\("(fmaviewer-send-to-mdpro-img)", idx\)/)[1];
    childContext.sendAction(action, 1);
    await h.context.handleMessage(event);
    assert.equal(h.context.imageInsertCurrentDataUrl, dataUrl);
    assert.equal(h.context.imageInsertCurrentFileName, 'portrait.png');
    assert.equal(h.input.value, dataUrl);
    assert.deepEqual(h.calls.slice(0, 3), ['close', 'edit', 'open']);
    assert.ok(h.calls.includes(dataUrl));
  });
}

test('legacy FMA insert action remains supported', async () => {
  const h = harness();
  await h.context.handleMessage({ source: h.sourceWindow, data: { type: 'fmaviewer-open-image-insert', image: { src: dataUrl, name: 'legacy.png' } } });
  assert.equal(h.context.imageInsertCurrentFileName, 'legacy.png');
});

test('another iframe cannot trigger document image insertion', async () => {
  const h = harness();
  await h.context.handleMessage({ source: {}, data: { type: 'fmaviewer-send-to-mdpro-img', image: { src: dataUrl } } });
  assert.equal(h.calls.length, 0);
  assert.equal(h.context.imageInsertCurrentDataUrl, '');
});

test('missing IMG API reports an error and keeps FMA open', async () => {
  const h = harness({ missingApi: true });
  await h.context.handleMessage({ source: h.sourceWindow, data: { type: 'fmaviewer-send-to-mdpro-img', image: { src: dataUrl } } });
  assert.equal(h.calls.length, 1);
  assert.match(h.calls[0], /문서 이미지 삽입 기능/);
});

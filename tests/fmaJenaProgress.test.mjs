import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const chat = readFileSync('mdpro/Apps/fmaviewer/js/ai/aiJena.js', 'utf8');
const local = readFileSync('mdpro/Apps/fmaviewer/js/image/lemonadeSettings.js', 'utf8');
const progressCode = chat.slice(chat.indexOf('function setAiJenaProgress('), chat.indexOf('async function requestAiJenaImage('));
const waitingCode = local.slice(local.indexOf('    window.waitForFmaLemonadeIdle ='), local.indexOf('    window.requestFmaLemonadeImage ='));

test('pending progress displays elapsed time, never a fabricated 92 percent, and finishes at 100 only after completion', () => {
  let tick, now = 1000, cleared = 0;
  const attributes = new Map();
  const classes = new Set();
  const track = { setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
  const dom = { aiJenaProgressText: {}, aiJenaProgressPercent: {}, aiJenaProgressBar: { style: {}, parentElement: track,
    classList: { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } } } };
  const context = vm.createContext({ dom, aiJenaState: {}, Date: { now: () => now }, clearInterval() { cleared++; }, window: { setInterval: callback => { tick = callback; return 1; } } });
  vm.runInContext(progressCode, context);
  context.startAiJenaProgress(false);
  assert.equal(dom.aiJenaProgressPercent.innerText, '0:00');
  assert.ok(classes.has('indeterminate'));
  assert.equal(attributes.has('aria-valuenow'), false);
  now += 240000;
  context.setAiJenaRequestPhase('서버 응답 대기');
  tick();
  assert.equal(dom.aiJenaProgressPercent.innerText, '4:00');
  assert.match(dom.aiJenaProgressText.innerText, /서버 응답 대기/);
  assert.equal(dom.aiJenaProgressPercent.innerText.includes('92'), false);
  context.finishAiJenaProgress(100, '완료');
  assert.equal(dom.aiJenaProgressPercent.innerText, '100%');
  assert.equal(classes.has('indeterminate'), false);
  assert.equal(attributes.get('aria-valuenow'), '100');
  assert.ok(cleared >= 2);
});

function waitingHarness(healths, status = 200) {
  let calls = 0;
  const window = {};
  const context = vm.createContext({ window, Date, DOMException, AbortSignal,
    setTimeout: callback => { queueMicrotask(callback); return 1; }, clearTimeout() {},
    fetch: async () => { calls++; return { ok: status === 200, status, json: async () => healths.shift() }; } });
  vm.runInContext(waitingCode, context);
  return { window, calls: () => calls };
}

test('server busy health is polled before any new edit is submitted, including another image model', async () => {
  const { window, calls } = waitingHarness([
    { all_models_loaded: [{ type: 'image', model_name: 'Other-Flux', is_busy: true }] },
    { all_models_loaded: [{ recipe: 'sd-cpp', status: 'in_use' }] },
    { all_models_loaded: [{ type: 'image', is_busy: false }] }
  ]);
  const phases = [];
  await window.waitForFmaLemonadeIdle('local', undefined, phase => phases.push(phase));
  assert.equal(calls(), 3);
  assert.equal(phases.length, 2);
  assert.match(phases[0], /이전 Lemonade/);
});

test('busy wait cancellation exits without another server request', async () => {
  const controller = new AbortController();
  const { window, calls } = waitingHarness([{ all_models_loaded: [{ type: 'image', is_busy: true }] }]);
  await assert.rejects(window.waitForFmaLemonadeIdle('local', controller.signal, () => controller.abort()), { name: 'AbortError' });
  assert.equal(calls(), 1);
});

test('health authentication failure does not blindly submit an edit', async () => {
  const { window, calls } = waitingHarness([], 401);
  await assert.rejects(window.waitForFmaLemonadeIdle('local'), /HTTP 401/);
  assert.equal(calls(), 1);
});

test('unknown health response does not submit work into an unverified server queue', async () => {
  const { window } = waitingHarness([{}]);
  await assert.rejects(window.waitForFmaLemonadeIdle('local'), /상태를 확인/);
});

test('local request downsizes oversized references and aligned mask without changing stored originals', async () => {
  const canvases = [];
  const context = vm.createContext({ aiJenaState: { mode: 'clothes' }, DOMException,
    getMdproSettingsHost: () => ({ localStorage: { getItem: () => '512x512' } }),
    loadUpscaleImage: async () => ({ naturalWidth: 1024, naturalHeight: 2048 }),
    document: { createElement: () => { const ctx = { drawImage() {} }; const canvas = { getContext: () => ctx,
      toDataURL: () => 'data:image/png;base64,resized', ctx }; canvases.push(canvas); return canvas; } }
  });
  vm.runInContext(chat.slice(chat.indexOf('async function prepareAiJenaLocalImages('), chat.indexOf('async function requestAiJenaImage(')), context);
  const input = [{ type: 'image', mime_type: 'image/jpeg', data: 'original' }, { type: 'image', mime_type: 'image/png', data: 'mask' }, { type: 'text', text: 'hair' }];
  const result = await context.prepareAiJenaLocalImages(input);
  assert.equal(canvases.length, 2);
  for (const canvas of canvases) { assert.equal(canvas.width, 256); assert.equal(canvas.height, 512); }
  assert.equal(canvases[0].ctx.imageSmoothingEnabled, true);
  assert.equal(canvases[1].ctx.imageSmoothingEnabled, false);
  assert.equal(result[0].data, 'resized');
  assert.equal(input[0].data, 'original');
  assert.equal(input[1].data, 'mask');
  assert.equal(result[2], input[2]);
});

test('local reference preparation never enlarges small images and respects cancellation', async () => {
  const context = vm.createContext({ aiJenaState: { mode: 'edit' }, DOMException,
    getMdproSettingsHost: () => ({ localStorage: { getItem: () => null } }),
    loadUpscaleImage: async () => ({ naturalWidth: 256, naturalHeight: 256 }), document: { createElement: () => { throw new Error('should not create canvas'); } }
  });
  vm.runInContext(chat.slice(chat.indexOf('async function prepareAiJenaLocalImages('), chat.indexOf('async function requestAiJenaImage(')), context);
  const original = { type: 'image', mime_type: 'image/png', data: 'original' };
  const result = await context.prepareAiJenaLocalImages([original]);
  assert.equal(result[0], original);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(context.prepareAiJenaLocalImages([original], controller.signal), { name: 'AbortError' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup(edge) {
  const listeners = new Map();
  const timers = new Map();
  const classList = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(name => values.add(name)), remove: (...names) => names.forEach(name => values.delete(name)), contains: name => values.has(name) };
  };
  const panel = { classList: classList(), style: {}, getBoundingClientRect: () => ({ left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 }) };
  let captured = false;
  const capture = { dataset: { panelEdge: edge }, setPointerCapture: () => { captured = true; }, hasPointerCapture: () => captured, releasePointerCapture: () => { captured = false; } };
  const target = { closest: selector => {
    if (selector === '[data-panel-edge]') return edge ? capture : null;
    if (selector === '.webdav-explorer-bar, .mdpro-stage-bar') return capture;
    if (selector === '.webdav-explorer-panel, .mdpro-stage') return panel;
    return null;
  } };
  const document = { body: { classList: classList() }, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener() {}, querySelector: () => null };
  const window = { innerWidth: 1000, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
  let cleanup;
  const source = readFileSync(new URL('../src/usePanelWindows.js', import.meta.url), 'utf8')
    .replace("import { useEffect } from 'react';", '')
    .replace('export default function', 'function');
  vm.runInNewContext(`${source}\nusePanelWindows();`, {
    document, window, useEffect: callback => { cleanup = callback(); },
    setTimeout: (callback, delay) => { assert.equal(delay, 2500); timers.set(1, callback); return 1; },
    clearTimeout: id => timers.delete(id),
  });
  return {
    panel, cleanup,
    fire: (name, x = 100, y = 100) => listeners.get(name)({ target, button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault() {} }),
    hold: () => { for (const callback of timers.values()) callback(); timers.clear(); },
  };
}

test('title bar moves only after a 2.5 second hold', () => {
  const app = setup();
  app.fire('pointerdown');
  app.fire('pointermove', 104, 100);
  assert.equal(app.panel.style.left, undefined);
  app.hold();
  app.fire('pointermove', 150, 130);
  assert.equal(app.panel.style.left, '150px');
  assert.equal(app.panel.style.top, '130px');
  app.fire('pointerup');
  assert.equal(app.panel.classList.contains('is-panel-ready'), false);
  app.cleanup();
});

test('early release, movement, and cancellation cancel the hold', () => {
  for (const cancel of ['pointerup', 'pointercancel', 'pointermove']) {
    const app = setup();
    app.fire('pointerdown');
    app.fire(cancel, 130, 130);
    app.hold();
    app.fire('pointermove', 160, 160);
    assert.equal(app.panel.style.left, undefined);
    assert.equal(app.panel.classList.contains('is-panel-holding'), false);
    app.cleanup();
  }
});

test('top, bottom, and right corner handles resize immediately', () => {
  for (const [edge, expected] of [
    ['top', { top: '120px', height: '280px', width: '400px' }],
    ['bottom', { top: '100px', height: '320px', width: '400px' }],
    ['top-right', { top: '120px', height: '280px', width: '450px' }],
    ['bottom-right', { top: '100px', height: '320px', width: '450px' }],
  ]) {
    const app = setup(edge);
    app.fire('pointerdown');
    app.fire('pointermove', 150, 120);
    for (const [key, value] of Object.entries(expected)) assert.equal(app.panel.style[key], value, `${edge}: ${key}`);
    app.cleanup();
  }
});

test('corner resize respects minimum size and viewport bounds', () => {
  const app = setup('bottom-right');
  app.fire('pointerdown');
  app.fire('pointermove', -1000, -1000);
  assert.equal(app.panel.style.width, '240px');
  assert.equal(app.panel.style.height, '160px');
  app.fire('pointermove', 2000, 2000);
  assert.equal(app.panel.style.width, '900px');
  assert.equal(app.panel.style.height, '700px');
  app.cleanup();
});

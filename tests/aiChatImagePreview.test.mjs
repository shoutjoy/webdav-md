import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const chat = readFileSync('mdpro/AI_App/aiChat/ai-chat.js', 'utf8');
const css = readFileSync('mdpro/AI_App/aiChat/ai-chat.css', 'utf8');
function setup(width = 320, height = 240) {
  const node = () => ({ style: {}, events: {}, children: [],
    addEventListener(name, fn) { this.events[name] = fn; },
    appendChild(child) { this.children.push(child); }, setAttribute() {},
    setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {} });
  const root = { innerWidth: 1200, innerHeight: 900, events: {},
    addEventListener(name, fn) { this.events[name] = fn; }, removeEventListener(name) { delete this.events[name]; } };
  const dialog = node();
  dialog.getBoundingClientRect = () => {
    const left = parseFloat(dialog.style.left), top = parseFloat(dialog.style.top);
    const width = parseFloat(dialog.style.width), height = parseFloat(dialog.style.height);
    return { left, top, width, height, right: left + width, bottom: top + height };
  };
  const header = node();
  header.getBoundingClientRect = () => ({ height: 48 });
  const image = Object.assign(node(), { naturalWidth: width, naturalHeight: height });
  const ctx = vm.createContext({ root, document: { createElement: node } });
  vm.runInContext(chat.slice(chat.indexOf('  function bindImagePreviewGeometry('), chat.indexOf('  function openGeneratedImagePreview(')), ctx);
  ctx.bindImagePreviewGeometry(dialog, header, image);
  return { root, dialog, header, image };
}
function gesture(surface, dx, dy, button = 0) {
  const event = { button, pointerId: 1, clientX: 300, clientY: 300, target: {}, preventDefault() {} };
  surface.events.pointerdown(event);
  surface.events.pointermove({ ...event, clientX: 300 + dx, clientY: 300 + dy });
  surface.events.pointerup(event);
}

test('initial preview uses natural dimensions plus window chrome; oversized image stays unscaled in a scrolling viewport', () => {
  const { dialog } = setup();
  assert.equal(dialog.style.width, '338px');
  assert.equal(dialog.style.height, '306px');
  const large = setup(4096, 2048);
  assert.equal(large.dialog.style.width, '1184px');
  assert.equal(large.dialog.style.height, '884px');
  assert.match(css, /\.ai-chat-image-preview-viewport > img \{[^}]*width: auto;[^}]*height: auto;[^}]*max-width: none/);
  assert.match(css, /\.ai-chat-image-preview-viewport \{[^}]*overflow: auto/);
});

test('header drag is bounded and ignores action buttons; late image load preserves user geometry', () => {
  const { dialog, header, image, root } = setup();
  gesture(header, -9999, 9999);
  assert.equal(dialog.style.left, '8px');
  assert.equal(dialog.style.top, '586px');
  image.events.load();
  assert.equal(dialog.style.left, '8px');
  header.events.pointerdown({ button: 0, target: { closest: () => ({}) } });
  header.events.pointermove({ pointerId: 1, clientX: 999, clientY: 999 });
  assert.equal(dialog.style.left, '8px');
  root.innerWidth = 300;
  root.innerHeight = 200;
  root.events.resize();
  assert.equal(dialog.style.width, '284px');
  assert.equal(dialog.style.height, '184px');
  dialog.events.close();
  assert.equal(root.events.resize, undefined);
});

for (const [index, dx, dy, expected] of [
  [0, 0, -40, [338, 346]], [1, 0, 40, [338, 346]],
  [2, -40, 0, [378, 306]], [3, 40, 0, [378, 306]], [4, 40, 40, [378, 346]]
]) {
  test(`resize handle ${['north', 'south', 'west', 'east', 'southeast'][index]} adjusts the expected edges`, () => {
    const { dialog } = setup();
    assert.equal(dialog.children.length, 5);
    gesture(dialog.children[index], dx, dy);
    assert.equal(parseFloat(dialog.style.width), expected[0]);
    assert.equal(parseFloat(dialog.style.height), expected[1]);
  });
}

test('resize cannot shrink below usable size or grow off screen', () => {
  const { dialog } = setup();
  gesture(dialog.children[4], -9999, -9999);
  assert.equal(dialog.style.width, '240px');
  assert.equal(dialog.style.height, '160px');
  gesture(dialog.children[4], 9999, 9999);
  const rect = dialog.getBoundingClientRect();
  assert.equal(rect.right, 1192);
  assert.equal(rect.bottom, 892);
});

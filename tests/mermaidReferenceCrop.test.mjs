import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('reference crop maps scaled reverse drags to source pixels and exports without selection marks', () => {
  const elements = [], draws = [], applied = [];
  function element(tag) {
    const item = { tag, children:[], handlers:{}, style:{}, clientWidth:524, clientHeight:424,
      naturalWidth:1000, naturalHeight:800,
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      setAttribute() {}, addEventListener(name, callback) { this.handlers[name] = callback; },
      getBoundingClientRect() { return { left:0, top:0, width:500, height:400 }; },
      setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {},
      getContext() { return { clearRect() {}, drawImage(...args) { draws.push(args); }, fillRect() {}, strokeRect() {} }; },
      toDataURL() { return 'data:image/png;cropped'; },
      toBlob(callback) { callback({ size:100 }); }
    };
    elements.push(item); return item;
  }
  const doc = { createElement:element, head:element('head'), body:element('body') };
  const popup = { document:doc, addEventListener() {}, close() {} };
  const context = { window:{ open:()=>popup }, alert() {}, File:class { constructor(parts, name, options) { this.name=name; this.type=options.type; } } };
  vm.createContext(context);
  vm.runInContext(readFileSync('mdpro/js/mermaid/mermaid-editor/reference-crop.js','utf8'), context);
  context.openMermaidReferenceCrop({ dataUrl:'data:image/png;original', name:'photo.jpg' }, file => { applied.push(file); return true; });
  const source = elements.find(item => item.tag === 'img');
  const canvas = elements.find(item => item.tag === 'canvas');
  const button = text => elements.find(item => item.textContent === text);
  source.onload();
  const event = (x,y) => ({ button:0, pointerId:1, clientX:x, clientY:y, preventDefault() {} });
  canvas.handlers.pointerdown(event(400,300)); canvas.handlers.pointermove(event(100,50)); canvas.handlers.pointerup(event(100,50));
  assert.equal(button('선택 영역 자르기').disabled, false);
  button('선택 영역 자르기').onclick();
  assert.deepEqual(draws.at(-1).slice(1), [200,100,600,500,0,0,600,500]);
  assert.equal(source.src, 'data:image/png;cropped');
  source.naturalWidth=600; source.naturalHeight=500; source.onload();
  assert.equal(button('선택 영역 자르기').disabled, true);
  button('참고 이미지에 적용').onclick();
  assert.equal(applied[0].name, 'photo-crop.png');
  assert.equal(applied[0].type, 'image/png');
  assert.equal(draws.at(-1).length, 3); // Clean source image, never the decorated selection canvas.
  button('원본 복원').onclick();
  assert.equal(source.src, 'data:image/png;original');
});

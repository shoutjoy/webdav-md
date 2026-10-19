import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/mermaid/mermaid_render.js', import.meta.url), 'utf8');
const start = source.indexOf('function fitMermaidNodeLabels');
const end = source.indexOf('function expandMermaidSvgBounds', start);
const fitSource = source.slice(start, end);

function element(attributes = {}) {
  return {
    attributes: { ...attributes },
    style: {},
    getAttribute(name) { return this.attributes[name] ?? null; },
    setAttribute(name, value) { this.attributes[name] = String(value); }
  };
}

test('long Korean and English Mermaid label expands its rectangle and foreignObject together', () => {
  const label = {
    style: {},
    scrollWidth: 286,
    offsetWidth: 286,
    getBoundingClientRect() { return { width: 286 }; }
  };
  const rect = element({ x: '-100', width: '200' });
  const foreignObject = element({ x: '-100', width: '200' });
  foreignObject.firstElementChild = label;
  foreignObject.querySelector = () => label;
  const node = element();
  node.querySelector = selector => selector === 'foreignObject' ? foreignObject : selector === 'rect' ? rect : null;
  const svg = {
    querySelectorAll(selector) { return selector === 'g.node' ? [node] : []; }
  };

  const context = { result: null };
  vm.runInNewContext(`${fitSource}\nresult = fitMermaidNodeLabels;`, context);
  context.result(svg);

  assert.equal(rect.getAttribute('width'), '322');
  assert.equal(foreignObject.getAttribute('width'), '322');
  assert.equal(rect.getAttribute('x'), '-161');
  assert.equal(foreignObject.getAttribute('x'), '-161');
  assert.equal(label.style.whiteSpace, 'nowrap');
  assert.equal(node.getAttribute('data-mdv-label-fitted'), '1');
});


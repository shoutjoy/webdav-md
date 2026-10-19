import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('../mdpro/js/export/pdf-export.js');
require('../mdpro/js/export/pdf-math-preserve.js');
const { pdfSplitText, cloneTextSlice } = globalThis.PdfExport.__test;
const { svgLength } = globalThis.PdfMathPreserve.__test;

// Minimal DOM for testing all possible pagination boundaries, including inside a formula.
function text(value) {
  return { nodeType: 3, nodeValue: value, ownerDocument: document };
}
const document = { createTextNode: text };
function element(tag, children = [], math = false) {
  return {
    nodeType: 1, tag, childNodes: children, ownerDocument: document,
    classList: { contains: name => math && name === 'pdf-math-preserved' },
    appendChild(node) { this.childNodes.push(node); },
    cloneNode(deep) { return element(tag, deep ? children.map(child => child.nodeType === 3 ? text(child.nodeValue) : child.cloneNode(true)) : [], math); }
  };
}
function mathCount(node) {
  return !node || node.nodeType !== 1 ? 0 : Number(node.classList.contains('pdf-math-preserved')) + node.childNodes.reduce((count, child) => count + mathCount(child), 0);
}

test('every page split retains each formula exactly once with all surrounding prose', () => {
  const formula = element('span', [element('img')], true);
  const paragraph = element('p', [text('앞 문장 '), formula, text(' 뒤 문장 '), formula.cloneNode(true), text(' 마지막')]);
  const original = pdfSplitText(paragraph);
  assert.equal(original, '앞 문장 \ufffc 뒤 문장 \ufffc 마지막');
  for (let boundary = 1; boundary < original.length; boundary++) {
    const first = cloneTextSlice(paragraph, 0, boundary);
    const second = cloneTextSlice(paragraph, boundary, original.length);
    assert.equal(pdfSplitText(first) + pdfSplitText(second), original, 'prose at boundary ' + boundary);
    assert.equal(mathCount(first) + mathCount(second), 2, 'formula at boundary ' + boundary);
  }
});

test('nested fraction and subscript markup is an indivisible pagination object', () => {
  const formula = element('span', [element('span', [text('fraction numerator')]), element('span', [text('fraction denominator with indices')])], true);
  const paragraph = element('p', [text('A'), formula, text('B')]);
  assert.equal(pdfSplitText(paragraph), 'A\ufffcB');
  const slice = cloneTextSlice(paragraph, 1, 2);
  assert.equal(slice.childNodes[0].childNodes.length, 2);
  assert.equal(slice.childNodes[0].childNodes[1].childNodes[0].nodeValue, 'fraction denominator with indices');
});

test('SVG size conversion preserves formula aspect ratio at different font sizes', () => {
  assert.equal(svgLength('12ex', 16), 96);
  assert.equal(svgLength('3ex', 16), 24);
  assert.equal(svgLength('2em', 18), 36);
  assert.equal(svgLength('144px', 16), 144);
  assert.throws(() => svgLength('invalid', 16), /수식 크기/);
});

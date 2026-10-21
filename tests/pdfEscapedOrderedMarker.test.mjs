import assert from 'node:assert/strict';
import test from 'node:test';

import '../mdpro/js/export/pdf-export.js';

const { normalizeEscapedOrderedMarkers } = globalThis.PdfExport.__test;

function element(tagName, children = [], classes = []) {
  const classNames = new Set(classes);
  return {
    nodeType: 1,
    tagName,
    childNodes: children,
    classList: { contains(name) { return classNames.has(name); } }
  };
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

test('PDF export removes numbered-dot escapes from prose but preserves code and math', () => {
  const headingText = text(String.raw`1\. 교육산업의 존재론적 질문`);
  const codeText = text(String.raw`const label = "1\. literal";`);
  const mathText = text(String.raw`1\. x`);
  const root = element('MAIN', [
    element('H3', [headingText]),
    element('PRE', [element('CODE', [codeText])]),
    element('MJX-CONTAINER', [mathText])
  ]);

  normalizeEscapedOrderedMarkers(root);

  assert.equal(headingText.nodeValue, '1. 교육산업의 존재론적 질문');
  assert.equal(codeText.nodeValue, String.raw`const label = "1\. literal";`);
  assert.equal(mathText.nodeValue, String.raw`1\. x`);
});

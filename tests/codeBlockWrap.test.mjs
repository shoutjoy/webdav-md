import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appStyles = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');
const pdfExport = readFileSync(new URL('../mdpro/js/export/pdf-export.js', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('view-mode code blocks wrap instead of creating a horizontal scrollbar', () => {
  const rule = appStyles.match(/\.markdown-body pre\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(rule, /overflow-x:\s*visible/);
  assert.match(rule, /white-space:\s*pre-wrap/);
  assert.match(rule, /overflow-wrap:\s*anywhere/);
  assert.match(rule, /word-break:\s*break-word/);
  assert.doesNotMatch(rule, /overflow-x:\s*auto/);
});

test('printed and PDF-exported code blocks preserve wrapping', () => {
  assert.match(appStyles, /#print-root pre code\s*\{[^}]*white-space:\s*pre-wrap !important/s);
  assert.match(pdfExport, /\.pdf-page-content pre code\{[^']*white-space:pre-wrap!important/);
});

test('shared and React preview surfaces use the same wrapping behavior', () => {
  assert.match(shellStyles, /\.share-markdown pre\s*\{[^}]*white-space:pre-wrap/);
  assert.match(shellStyles, /\.markdown-preview pre\s*\{[^}]*white-space:pre-wrap/);
});

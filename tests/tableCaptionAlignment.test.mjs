import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const htmlSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');

test('table caption insertion defaults to left alignment and exposes all alignment controls', () => {
  assert.match(appSource, /tableAlignment:\s*'left'/);
  assert.match(appSource, /if \(ui\.mode === 'table'\) \{\s*captionInsertState\.tableAlignment = 'left';/s);
  assert.match(htmlSource, /id="table-caption-alignment-buttons"/);
  assert.match(appSource, /\{ id: 'left', label: '왼쪽' \}/);
  assert.match(appSource, /\{ id: 'center', label: '가운데' \}/);
  assert.match(appSource, /\{ id: 'right', label: '오른쪽' \}/);
});

test('table caption output preserves the selected alignment while legacy captions remain left aligned', () => {
  assert.match(appSource, /tbl-caption-align-' \+ normalizeCaptionAlignment\(alignment\)/);
  assert.match(cssSource, /\.markdown-body \.tbl-caption\s*\{[^}]*text-align:\s*left;/s);
  assert.match(cssSource, /\.tbl-caption\.tbl-caption-align-center\s*\{\s*text-align:\s*center;/);
  assert.match(cssSource, /\.tbl-caption\.tbl-caption-align-right\s*\{\s*text-align:\s*right;/);
});

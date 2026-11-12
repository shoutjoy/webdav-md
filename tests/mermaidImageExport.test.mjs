import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = p => readFileSync(new URL('../mdpro/' + p, import.meta.url), 'utf8');
const editor = load('js/mermaid/mermaid-editor/app.js').replace(/\r\n/g, '\n');
const helper = load('js/mermaid/mermaid-editor/image-export.js');
const html = load('index.html');
test('all editor image actions render current code and use the shared serializer', () => {
  for (const action of ['sendRenderedSvgToImageInsert', 'sendRenderedPngToImageInsert', 'downloadSVG', 'downloadPNG']) {
    assert.ok(editor.includes('async function ' + action + '() {\n  await render();'));
  }
  assert.match(editor, /MermaidEditorExport.serialize/);
  assert.doesNotMatch(editor, /createSvgExportClone/);
});
test('shared exporter measures HTML label runs and emits standalone XML', () => {
  assert.match(helper, /createRange\(\)/);
  assert.match(helper, /getScreenCTM\(\)/);
  assert.match(helper, /matrix.inverse\(\)/);
  assert.match(helper, /new XMLSerializer\(\)/);
  assert.match(helper, /querySelector\('parsererror'\)/);
  assert.match(helper, /stroke: 'none'/);
});
test('editor export waits for fonts, caps PNG dimensions and separates preview zoom', () => {
  assert.match(editor, /await document.fonts.ready/);
  assert.match(editor, /8192 \/ Math.max\(size.width, size.height\)/);
  assert.match(editor, /ctx.imageSmoothingQuality = 'high'/);
  assert.match(editor, /let width = viewBox && viewBox.width/);
});
test('parent and editor load helper before callers and refresh iframe cache', () => {
  assert.ok(html.indexOf('image-export.js') < html.indexOf('src="./imageDB/image_insert.js'));
  const frame = load('js/mermaid/mermaid-editor/index.html');
  assert.ok(frame.indexOf('image-export.js') < frame.indexOf('src="app.js'));
  assert.match(html, /mermaid-editor\/index.html\?v=20261110-me-ai-1/);
});

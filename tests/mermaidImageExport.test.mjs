import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editorJs = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/app.js', import.meta.url), 'utf8');
const editorHtml = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/index.html', import.meta.url), 'utf8');
const mdproHtml = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

test('SVG image insertion exports a fixed-size standalone clone', () => {
  assert.match(editorJs, /function createSvgExportClone\(svgEl\)/);
  assert.match(editorJs, /svgClone\.setAttribute\('width', String\(size\.width\)\)/);
  assert.match(editorJs, /svgClone\.setAttribute\('height', String\(size\.height\)\)/);
  assert.match(editorJs, /svgClone\.style\.maxWidth = 'none'/);
  assert.match(editorJs, /sendRenderedSvgToImageInsert[\s\S]*createSvgExportClone\(svg\)/);
});

test('SVG and PNG preserve rendered Mermaid HTML labels instead of rebuilding them', () => {
  assert.match(editorJs, /function inlineMermaidHtmlLabelStyles\(sourceSvg, exportSvg\)/);
  assert.match(editorJs, /querySelectorAll\('foreignObject, foreignObject \*'\)/);
  assert.match(editorJs, /window\.getComputedStyle\(sourceNode\)/);
  assert.doesNotMatch(editorJs, /replaceForeignObjectsWithSvgText\(svgEl, svgClone\)/);
});

test('exports include the same preview background and high-quality smoothing', () => {
  assert.match(editorJs, /function addMermaidPreviewBackground\(sourceSvg, exportSvg\)/);
  assert.match(editorJs, /data-mdv-export-background/);
  assert.match(editorJs, /ctx\.imageSmoothingQuality = 'high'/);
});

test('PNG insertion rasterizes the same export clone at HiDPI resolution', () => {
  assert.match(editorJs, /const exported = createSvgExportClone\(svgEl\)/);
  assert.match(editorJs, /Math\.max\(4, Number\(window\.devicePixelRatio\) \|\| 1\)/);
  assert.match(editorJs, /8192 \/ Math\.max\(size\.width, size\.height\)/);
});

test('both Mermaid iframe layers load the WYSIWYG exporter cache key', () => {
  assert.match(editorHtml, /app\.js\?v=20261020-wysiwyg-export-1/);
  assert.match(mdproHtml, /mermaid-editor\/index\.html\?v=20261020-wysiwyg-export-1/);
});

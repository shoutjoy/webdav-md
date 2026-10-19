import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');

test('PDF preview replaces live Mermaid wrappers with the shared high-resolution PNG renderer', () => {
  assert.match(app, /async function withPreparedMermaidExportViewer\(exportLabel, callback\)/);
  assert.match(app, /exportViewerContainer\.style\.setProperty\('left', '-100000px', 'important'\)/);
  assert.match(app, /document\.body\.classList\.add\('viewer-view-mode'\)/);
  assert.match(app, /renderMarkdown\(\{ force: true, skipMermaidHydration: true \}\)/);
  assert.match(app, /renderedSvgCount !== wrapperCount/);
  assert.match(app, /Mermaid rendering did not complete; raw source export was stopped/);
  assert.match(app, /async function createPdfRenderedElement\(\)/);
  assert.match(app, /MermaidTRT\.exportWrapperImage\(wrapper, 'png'\)/);
  assert.match(app, /clonedWrapper\.replaceWith\(figure\)/);
  assert.match(app, /renderedElement: pdfRenderedElement/);
  assert.match(app, /await window\.MermaidTRT\.renderIn\(viewer\)/);
  assert.match(app, /withPreparedMermaidExportViewer\('PDF export'/);
  assert.match(app, /withPreparedMermaidExportViewer\('DOCX export'/);
});

test('PDF Mermaid images preserve aspect ratio and avoid page splitting', () => {
  assert.match(app, /pdf-mermaid-rendered-image/);
  assert.match(app, /break-inside:avoid;page-break-inside:avoid/);
  assert.match(app, /max-height:250mm/);
  assert.match(app, /width:auto;height:auto;max-width:100%;max-height:250mm;margin:0 auto;object-fit:contain/);
});

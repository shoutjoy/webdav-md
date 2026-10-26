import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../mdpro/js/mermaid/mermaid_render.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

test('fixed view controls expose SVG and PNG image insertion beside fit', () => {
  assert.match(source, /controls\.appendChild\(button\('맞춤'[\s\S]*controls\.appendChild\(button\('SVG'[\s\S]*controls\.appendChild\(button\('PNG'/);
  assert.match(source, /openMermaidWrapperInImageInsert\(wrapper, 'svg'\)/);
  assert.match(source, /openMermaidWrapperInImageInsert\(wrapper, 'png'\)/);
});

test('view SVG preserves rendered labels and PNG safely recreates their measured layout', () => {
  assert.match(source, /function inlineMermaidExportLabelStyles\(sourceSvg, exportSvg\)/);
  assert.match(source, /querySelectorAll\('foreignObject, foreignObject \*'\)/);
  assert.match(source, /function replaceMermaidHtmlLabelsForPng\(sourceSvg, exportSvg\)/);
  assert.match(source, /wrapMermaidExportLabel\(part\.textContent, Math\.max\(10, width - paddingX\), font\)/);
  assert.match(source, /replaceMermaidHtmlLabelsForPng\(sourceSvg, exported\.svg\)/);
  assert.match(source, /Math\.max\(8, Number\(global\.devicePixelRatio\) \|\| 1\)/);
  assert.match(source, /text\.style\.setProperty\('stroke', 'none', 'important'\)/);
  assert.match(source, /tspan\.style\.setProperty\('stroke-width', '0', 'important'\)/);
  assert.match(source, /context\.imageSmoothingQuality = 'high'/);
});

test('DOCX can request the same PNG renderer used by the view button', () => {
  assert.match(source, /exportWrapperImage: exportMermaidWrapperImage/);
  assert.match(indexHtml, /mermaid_render\.js\?v=20261026-docx-labels-1/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../mdpro/js/mermaid/mermaid_render.js', import.meta.url), 'utf8');

test('fixed Mermaid controls keep the existing controls and add a block theme toggle after fit', () => {
  const fixedControls = source.slice(
    source.indexOf('function addFixedMermaidControls'),
    source.indexOf('function copyMermaidSource')
  );

  assert.match(fixedControls, /button\('−', '고정형 다이어그램 축소'/);
  assert.match(fixedControls, /trt-mermaid-fixed-scale/);
  assert.match(fixedControls, /button\('\+', '고정형 다이어그램 확대'/);
  assert.match(fixedControls, /button\('맞춤', '문서 너비에 맞는 기본 크기'/);
  assert.ok(
    fixedControls.indexOf("button('맞춤'") < fixedControls.indexOf("'trt-mermaid-theme-toggle'"),
    '테마 버튼은 맞춤 버튼 뒤에 있어야 합니다.'
  );
});

test('individual themes use a serialized queue, separate cache and retained presentation',()=>{
 assert.match(source,/function setWrapperMermaidTheme/);
 assert.match(source,/enqueueMermaidWork/);
 assert.match(source,/data-mermaid-theme-override/);
 assert.match(source,/readMermaidSvgCache\(source, next\)/);
 assert.match(source,/pre\.__mdvMermaidPresentation/);
 assert.match(source,/isolateCachedMermaidIds/);
 assert.match(source,/setBlockTheme: setWrapperMermaidTheme/);
});
test('theme control describes its per-diagram action accessibly',()=>{
 assert.match(source,/이 도표만 라이트 모드로 전환/);
 assert.match(source,/button\.setAttribute\('aria-label', button\.title\)/);
});

test('document Mermaid rendering matches the ME preview layout contract', () => {
  assert.match(source, /theme:\s*dark \? 'dark' : 'default'/);
  assert.match(source, /flowchart:\s*\{ useMaxWidth: true, htmlLabels: true \}/);
  assert.match(source, /primaryColor:\s*'#111827'[\s\S]*background:\s*'#0b1220'/);
  assert.doesNotMatch(source, /wrappingWidth|markdownAutoWrap/);
  assert.doesNotMatch(source, /function expandMermaidSvgBounds/);
  assert.doesNotMatch(source, /foreignObject\.setAttribute\('width'/);
  assert.doesNotMatch(source, /foreignObject,foreignObject>div\{overflow:visible/);
});

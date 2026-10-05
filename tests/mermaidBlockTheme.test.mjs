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

test('Mermaid block theme rerenders only the selected wrapper and uses theme-specific cache entries', () => {
  assert.match(source, /async function setMermaidBlockTheme\(wrapper, theme\)/);
  assert.match(source, /wrapper\.setAttribute\('data-mermaid-theme', nextTheme\)/);
  assert.match(source, /global\.mermaid\.run\(\{ nodes: \[canvas\] \}\)/);
  assert.match(source, /resolvedTheme \+ ':' \+ value\.length/);
  assert.match(source, /code\.setAttribute\('data-mermaid-theme', themeOverride\)/);
});

test('Mermaid theme toggle exposes an icon and an accessible light or dark action label', () => {
  assert.match(source, /button\.textContent = nextTheme === 'light' \? '☀' : '☾'/);
  assert.match(source, /button\.setAttribute\('aria-label', button\.title\)/);
  assert.match(source, /Mermaid를 .*'라이트' : '다크'.*테마로 보기/);
});

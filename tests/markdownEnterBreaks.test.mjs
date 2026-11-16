import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function runtime() {
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(readFileSync(new URL('../mdpro/vendor/marked/marked.umd.js', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../mdpro/js/math_render/math_render.js', import.meta.url), 'utf8'), context);
  return context;
}

test('single Enter separates AI data rows and bold step titles in sync and async document rendering', async () => {
  const { MathRender, marked } = runtime();
  const source = '집단 A: 70, 75\n집단 B: 65, 70\n집단 C: 85, 82\n\n**1단계 — 집단 평균**\n집단 합은 각각 365, 343, 429이다.';
  for (const html of [MathRender.renderMarkdownSafeSync(marked, source), await MathRender.renderMarkdownSafe(marked, source)]) {
    assert.match(html, /집단 A: 70, 75<br>\s*집단 B: 65, 70<br>\s*집단 C: 85, 82/);
    assert.match(html, /<strong>1단계 — 집단 평균<\/strong><br>\s*집단 합/);
    assert.equal((html.match(/<p>/g) || []).length, 2);
  }
  assert.equal(marked.defaults.breaks, false, 'do not mutate global parser defaults');
});

test('parser owns hard breaks, code, tables and lists; multiline math stays protected', () => {
  const { MathRender, marked } = runtime();
  const source = '이미 명시한 줄  \n다음 줄\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- 첫 항목\n- 다음 항목\n\n$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$';
  const html = MathRender.renderMarkdownSync(marked, source);
  assert.match(html, /이미 명시한 줄<br>\s*다음 줄/);
  assert.doesNotMatch(html, /<br>\s*<br>/);
  assert.match(html, /<code[^>]*>const a = 1;\nconst b = 2;\n<\/code>/);
  assert.match(html, /<table>/);
  assert.equal((html.match(/<li>/g) || []).length, 2);
  assert.ok(html.includes('a &amp;= b \\\\\nc &amp;= d'));
  assert.doesNotMatch(html, /MATHSEG/);
});

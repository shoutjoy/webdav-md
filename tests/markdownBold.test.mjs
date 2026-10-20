import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function loadMarkdownBold() {
  const source = await readFile(new URL('../mdpro/js/Markdown_bold.js', import.meta.url), 'utf8');
  const context = { module: { exports: {} } };
  vm.runInNewContext(source, context);
  return context.module.exports;
}

test('bold can span inline code while preserving its backticks', async () => {
  const { preprocessBold } = await loadMarkdownBold();
  assert.equal(
    preprocessBold('**볼드 사이에 `code()` 같은 특수문자**'),
    '<b>볼드 사이에 `code()` 같은 특수문자</b>',
  );
});

test('bold markers inside inline and fenced code remain untouched', async () => {
  const { preprocessBold } = await loadMarkdownBold();
  assert.equal(preprocessBold('`**not bold**`와 **bold**'), '`**not bold**`와 <b>bold</b>');
  assert.equal(
    preprocessBold('```js\nconst value = "**not bold**";\n```\n**bold**'),
    '```js\nconst value = "**not bold**";\n```\n<b>bold</b>',
  );
});

test('statistical significance math is protected while surrounding bold still renders', async () => {
  const { preprocessBold } = await loadMarkdownBold();
  const source = '* `<표 2>`의 \\(r \\pm 2SE\\)와 통계적 유의성(\\(*p<.05, **p<.01, ***p<.001\\))을 확인하고 **독립된 상관관계 행렬 표(Correlation Matrix)가 반드시 수록**되어야 합니다.';
  assert.equal(
    preprocessBold(source),
    '* `<표 2>`의 \\(r \\pm 2SE\\)와 통계적 유의성(\\(*p<.05, **p<.01, ***p<.001\\))을 확인하고 <b>독립된 상관관계 행렬 표(Correlation Matrix)가 반드시 수록</b>되어야 합니다.',
  );
});

test('double-escaped TeX delimiters are also protected from bold preprocessing', async () => {
  const { preprocessBold } = await loadMarkdownBold();
  const source = String.raw`유의성(\\(*p<.05, **p<.01, ***p<.001\\)) **결과**`;
  assert.equal(
    preprocessBold(source),
    String.raw`유의성(\\(*p<.05, **p<.01, ***p<.001\\)) <b>결과</b>`,
  );
});

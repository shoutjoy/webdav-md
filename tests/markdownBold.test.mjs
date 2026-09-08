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

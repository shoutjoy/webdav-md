import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function loadFunction(name) {
  const source = await readFile(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);

  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let end = bodyStart;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') depth -= 1;
    if (depth === 0) break;
  }

  const context = {};
  vm.runInNewContext(`${source.slice(start, end + 1)}; this.result = ${name};`, context);
  return context.result;
}

test('bullet nesting alternates markers by indentation depth', async () => {
  const getBulletMarkerByIndent = await loadFunction('getBulletMarkerByIndent');
  assert.equal(getBulletMarkerByIndent(0), '-');
  assert.equal(getBulletMarkerByIndent(2), '*');
  assert.equal(getBulletMarkerByIndent(4), '+');
});

test('indenting an ordered item restarts the nested list and closes the outer numbering gap', async () => {
  const renumber = await loadFunction('renumberNumberedSiblingsAfterIndent');
  const markdown = ['1. first', '2. second', '3. third', '4. fourth'].join('\n');
  const lineStart = markdown.indexOf('2. second');
  const result = renumber(markdown, lineStart, 0, '  1. second');

  assert.equal(result.replacement, ['  1. second', '2. third', '3. fourth'].join('\n'));
});

test('ordered renumbering preserves deeper nested descendants', async () => {
  const renumber = await loadFunction('renumberNumberedSiblingsAfterIndent');
  const markdown = ['1. first', '2. second', '  1. child', '3. third'].join('\n');
  const lineStart = markdown.indexOf('2. second');
  const result = renumber(markdown, lineStart, 0, '  1. second');

  assert.equal(result.replacement, ['  1. second', '  1. child', '2. third'].join('\n'));
});

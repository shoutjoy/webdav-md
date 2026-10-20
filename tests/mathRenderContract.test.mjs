import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('math rendering contract is linked and preserves every mandatory rule', async () => {
  const [contract, agents, readme] = await Promise.all([
    readFile(new URL('docs/MATH_RENDER_RULES.md', root), 'utf8'),
    readFile(new URL('AGENTS.md', root), 'utf8'),
    readFile(new URL('README.md', root), 'utf8'),
  ]);

  assert.match(contract, /MDPRO-MATH-RENDER-CONTRACT/);
  for (let number = 1; number <= 13; number += 1) {
    assert.match(contract, new RegExp(`M-${String(number).padStart(2, '0')}\\.`));
  }
  for (const required of [
    String.raw`\(*p<.05, **p<.01, ***p<.001\)`,
    String.raw`(\(\beta = .792\))`,
    'result$points',
    '<m:oMath>',
    'tests/markdownMathPlaceholders.test.mjs',
    'tests/markdownBold.test.mjs',
    'tests/docxMermaidExport.test.mjs',
  ]) {
    assert.ok(contract.includes(required), `contract must include ${required}`);
  }
  assert.match(agents, /docs\/MATH_RENDER_RULES\.md/);
  assert.match(agents, /M-01 through M-13/);
  assert.match(readme, /MDPRO-MATH-RENDER-CONTRACT/);
});

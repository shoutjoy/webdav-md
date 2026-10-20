import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import MarkdownIt from 'markdown-it';

async function loadSpecialTrt() {
  const window = {};
  vm.runInNewContext(
    await readFile(new URL('../mdpro/trt/special_trt.js', import.meta.url), 'utf8'),
    { window },
  );
  return window.specialTRT;
}

test('table cells remove repeated Markdown escapes without leaving a visible backslash', async () => {
  const trt = await loadSpecialTrt();
  const source = String.raw`| 변수명 | 직원경험 | 직무배태성 |
| --- | ---: | ---: |
| 직원몰입 | 0.904\\** | 0.966\\** |`;
  const prepared = trt.prepareForRender(source);
  const html = new MarkdownIt().render(prepared);

  assert.ok(prepared.includes('0.904**'));
  assert.ok(prepared.includes('0.966**'));
  assert.doesNotMatch(prepared, /0\.(?:904|966)\\/);
  assert.doesNotMatch(html, /0\.(?:904|966)\\/);
});

test('code and TeX delimiters keep their backslashes', async () => {
  const trt = await loadSpecialTrt();
  const source = String.raw`| 값 | 설명 |
| --- | --- |
| \(\sqrt{AVE}\) | \`0.904\\**\` |`;
  const prepared = trt.prepareForRender(source);

  assert.ok(prepared.includes(String.raw`\(\sqrt{AVE}\)`));
  assert.ok(prepared.includes(String.raw`\`0.904\\**\``));
});

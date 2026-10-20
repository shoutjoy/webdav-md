import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';

async function load() {
  const window = {};
  vm.runInNewContext(await readFile(new URL('../mdpro/js/math_render/math_render.js', import.meta.url), 'utf8'), { window });
  vm.runInNewContext(await readFile(new URL('../mdpro/AI_App/aiChat/ai-chat-markdown.js', import.meta.url), 'utf8'), { window });
  const parser = new MarkdownIt({ html: true });
  window.marked = { parse: text => parser.render(text) };
  return window;
}

test('R member access inside code never consumes subsequent math', async () => {
  const root = await load();
  for (const code of ['`nmds_result$points`', '``nmds_result$points `literal` ``', '```r\nnmds_result$points\n```', '~~~r\nnmds_result$points\n~~~']) {
    const source = code + '\n\n좌표 $x_i$ 및 $y_i$';
    for (const html of [root.MathRender.renderMarkdownSync(root.marked, source), root.AIChatMarkdown.toHtml(source)]) {
      assert.match(html, /<code[^>]*>nmds_result\$points/);
      assert.ok(html.includes('$x_i$'));
      assert.ok(html.includes('$y_i$'));
      assert.doesNotMatch(html, /MATHSEG/);
    }
  }
});

test('documents and Jena retain quoted placeholders and intentional deletion', async () => {
  const root = await load();
  const source = '시스템은 "~~와 관련성을 보일 가능성이 높다", "~~의 경향성을 시사한다". ~~취소선~~';
  for (const html of [root.MathRender.renderMarkdownSync(root.marked, source), root.AIChatMarkdown.toHtml(source)]) {
    assert.match(html, /~~와 관련성을/);
    assert.match(html, /~~의 경향성을/);
    assert.equal((html.match(/<s>/g) || []).length, 1);
    assert.match(html, /<s>취소선<\/s>/);
  }
});

test('math commands survive Markdown in headings and expressions', async () => {
  const root = await load();
  const html = root.AIChatMarkdown.toHtml('### Correlation $\\neq$ Causation\n\n$\\alpha_i * x_i$ and \\(x_1\\)');
  assert.match(html, /\$\\neq\$/);
  assert.match(html, /\$\\alpha_i \* x_i\$/);
  assert.match(html, /\$x_1\$/);
  assert.doesNotMatch(html, /MATHSEG|<em>/);
});

test('code and quoted intentional deletion stay unchanged', async () => {
  const root = await load();
  const text = '`"~~예시"`\n```text\n"~~예시"\n```\n"~~취소선~~"';
  assert.equal(root.MathRender.prepareMarkdown(text), text);
});

test('ordinary parenthetical words remain text in documents and Jena tables', async () => {
  const root = await load();
  const sentence = '성취감, 학습 통제감(Self-Efficacy), 개념의 명확한 이해. (→ 동기 부여 및 몰입 유도)';
  const source = '| 고객 그룹 | 핵심 니즈 |\n| --- | --- |\n| 학생 | ' + sentence + ' |';
  assert.equal(root.MathRender.prepareMarkdown(source), source);
  for (const html of [root.MathRender.renderMarkdownSync(root.marked, source), root.AIChatMarkdown.toHtml(source)]) {
    assert.ok(html.includes(sentence));
    assert.match(html, /<table>/);
    assert.doesNotMatch(html, /\\\(|\$|MATHSEG/);
  }
  for (const text of ['(Self-Efficacy),', '(cost/benefit).', '(A/B testing).', '(pre-test).', '[Self-Efficacy]']) {
    assert.equal(root.MathRender.prepareMarkdown(text), text);
  }
});

test('explicit math and legacy mathematical expressions still render', async () => {
  const root = await load();
  assert.equal(root.MathRender.prepareMarkdown('(x-y).'), '\\(x-y\\).');
  assert.equal(root.MathRender.prepareMarkdown('[x^2]'), '\\[x^2\\]');
  for (const source of ['$x-y$', '\\(x-y\\)', '$\\sin(x)$']) {
    const html = root.MathRender.renderMarkdownSync(root.marked, source);
    assert.match(html, /\$.*\$/);
    assert.doesNotMatch(html, /MATHSEG/);
  }
});

test('malformed AI math wrappers drop only decorative boundary ampersands', async () => {
  const root = await load();
  const source = String.raw`**직원경험 ↔ 직무배태성 (\\(&r = .966&\\)):** 공유분산 \\(&r^2&\\) 및 $&\\sqrt{\\text{AVE}}&$`;

  for (const html of [root.MathRender.renderMarkdownSync(root.marked, source), root.AIChatMarkdown.toHtml(source)]) {
    assert.ok(html.includes('$r = .966$'), html);
    assert.ok(html.includes('$r^2$'));
    assert.ok(html.includes('$\\sqrt{\\text{AVE}}$'));
    assert.doesNotMatch(html, /[($]\s*&|&\s*[)$]/);
    assert.doesNotMatch(html, /MATHSEG/);
  }
});

test('valid TeX alignment ampersands remain untouched', async () => {
  const root = await load();
  const source = String.raw`$$\begin{aligned}a &= b \\ c &= d\end{aligned}$$`;
  const html = root.MathRender.renderMarkdownSync(root.marked, source);
  assert.ok(html.includes(String.raw`a &amp;= b \\ c &amp;= d`), html);
});

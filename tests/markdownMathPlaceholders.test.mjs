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

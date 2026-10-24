import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';

async function load() {
  const window = {};
  vm.runInNewContext(await readFile(new URL('../mdpro/js/math_render/math_render.js', import.meta.url), 'utf8'), { window });
  vm.runInNewContext(await readFile(new URL('../mdpro/AI_App/aiChat/ai-chat-markdown.js', import.meta.url), 'utf8'), { window });
  vm.runInNewContext(await readFile(new URL('../mdpro/js/Markdown_bold.js', import.meta.url), 'utf8'), { window });
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

test('report significance cells and numeric labels survive Smart Bold and every Markdown entry point', async () => {
  const root = await load();
  const source = '| item | sig_star | ipa_label | estimate |\n| --- | --- | --- | --- |\n'
    + [1, 2, 3].map(n => '| ' + n + ' | ' + '*'.repeat(n) + ' | ' + n + '*'.repeat(n) + ' | .42' + '*'.repeat(n) + ' |').join('\n');
  for (const input of [source, root.MarkdownBold.preprocessBold(source)]) {
    for (const html of [root.MathRender.renderMarkdownSync(root.marked, input), await root.MathRender.renderMarkdownSafe(root.marked, input), root.AIChatMarkdown.toHtml(input)]) {
      const literal = html.replace(/&#42;/g, '*');
      for (const n of [1, 2, 3]) {
        assert.ok(literal.includes('<td>' + '*'.repeat(n) + '</td>'), literal);
        assert.ok(literal.includes('<td>' + n + '*'.repeat(n) + '</td>'), literal);
        assert.ok(literal.includes('<td>.42' + '*'.repeat(n) + '</td>'), literal);
      }
      assert.doesNotMatch(html, /<(?:b|i|strong|em)>|MATHSEG|MDPRO_OPAQUE/);
    }
  }
});

test('significance legends preserve stars without changing emphasis, code, math or horizontal rules', async () => {
  const root = await load();
  const source = '**굵게** *기울임* ***둘 다*** **2024**\n\n'
    + '유의성: *p<.05, **p<.01, ***p<.001; 값 -2.3*, .42**.\n\n'
    + '`1*** | **p<.01`\n\n```text\n*** | 1***\n```\n\n***\n\n'
    + String.raw`$x_i * y_i$ 및 \(*p<.05, **p<.01, ***p<.001\)`;
  const html = root.MathRender.renderMarkdownSync(root.marked, root.MarkdownBold.preprocessBold(source));
  const literal = html.replace(/&#42;/g, '*');
  assert.ok(literal.includes('*p&lt;.05, **p&lt;.01, ***p&lt;.001'), literal);
  assert.ok(literal.includes('값 -2.3*, .42**.'), literal);
  assert.match(html, /<b>굵게<\/b>/);
  assert.match(html, /<em>기울임<\/em>/);
  assert.match(html, /<b><i>둘 다<\/i><\/b>/);
  assert.match(html, /<b>2024<\/b>/);
  assert.match(html, /<code>1\*\*\* \| \*\*p&lt;\.01<\/code>/);
  assert.match(html, /<code class="language-text">\*\*\* \| 1\*\*\*/);
  assert.match(html, /<hr>/);
  assert.ok(html.includes('$x_i * y_i$'));
  assert.doesNotMatch(html, /MATHSEG|MDPRO_OPAQUE/);
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

test('math inside ordinary parentheses does not expose nested dollar delimiters', async () => {
  const root = await load();
  const source = String.raw`하위차원 적재치(\(\beta\)): 물리적 환경(\(\beta = .792\)), 적재치 제곱합 (\(\sum \beta^2\)):`;
  const prepared = root.MathRender.prepareMarkdown(source);
  assert.ok(prepared.includes(String.raw`($\beta$)`), prepared);
  assert.ok(prepared.includes(String.raw`($\beta = .792$)`), prepared);
  assert.ok(prepared.includes(String.raw`($\sum \beta^2$)`), prepared);
  assert.doesNotMatch(prepared, /\\\(\$/);

  const html = root.MathRender.renderMarkdownSync(root.marked, source);
  assert.ok(html.includes(String.raw`($\beta$)`), html);
  assert.ok(html.includes(String.raw`($\sum \beta^2$)`), html);
  assert.doesNotMatch(html, /\\\(\$|\$\\\)/);
  assert.doesNotMatch(html, /MATHSEG/);
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

test('single-tilde variable ranges survive parsers that accept single-tilde deletion', async () => {
  const root = await load();
  const rows = [
    ['insa', '강사인사_지도관리', 'a1–a4', 'insa_i1~insa_i4, insa_p1~insa_p4'],
    ['parn', '학부모_의사소통', 'b1–b4', 'parn_i5~parn_i8, parn_p5~parn_p8'],
    ['oper', '운영방침_결정', 'c1–c4', 'oper_i9~oper_i12, oper_p9~oper_p12'],
    ['work', '문서생성_업무구조화', 'd1–d4', 'work_i13~work_i16, work_p13~work_p16'],
    ['resp', '검증_책임적활용', 'e1–e4', 'resp_i17~resp_i20, resp_p17~resp_p20'],
  ];
  const source = '| 영역 코드 | 구성개념 | 문항 | 중요도·실행도 변수 |\n| --- | --- | --- | --- |\n'
    + rows.map(row => '| ' + row.join(' | ') + ' |').join('\n');
  const parse = root.marked.parse;
  root.marked.parse = text => {
    // Unlike markdown-it, the production Marked parser also accepts ~text~.
    assert.doesNotMatch(text, /(^|[^~])~(?!~)/);
    return parse(text);
  };
  for (const html of [
    root.MathRender.renderMarkdownSync(root.marked, source),
    await root.MathRender.renderMarkdownSafe(root.marked, source),
    root.AIChatMarkdown.toHtml(source),
  ]) {
    assert.match(html, /<table>/);
    for (const row of rows) assert.ok(html.includes(row[3]), html);
    assert.doesNotMatch(html, /<(?:del|s)>|MATHSEG/);
  }
});

test('range protection preserves deletion, code, math, escapes and URL tildes', async () => {
  const root = await load();
  const source = String.raw`1~4, 5~8; ~~삭제~~; \~표시\~; $a~b$; `
    + '`a~b~c`\n~~~text\na~b~c\n~~~\n'
    + '[링크](https://example.com/~user/a~b) <span title="a~b~c">범위</span>';
  const html = root.MathRender.renderMarkdownSync(root.marked, source);
  assert.ok(html.includes('1~4, 5~8'));
  assert.match(html, /<s>삭제<\/s>/);
  assert.ok(html.includes('~표시~'));
  assert.ok(html.includes('$a~b$'));
  assert.match(html, /<code>a~b~c<\/code>/);
  assert.match(html, /<code class="language-text">a~b~c/);
  assert.ok(html.includes('href="https://example.com/~user/a~b"'));
  assert.ok(html.includes('title="a~b~c"'));
  assert.doesNotMatch(html, /MATHSEG/);
});

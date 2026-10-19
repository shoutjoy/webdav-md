import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/export/html-export.js', import.meta.url), 'utf8');

function setup({ dark = false, documentTheme = null, sheets = [], fetch } = {}) {
  const original = '<div class="markdown-body"><p>본문 &amp; 한글</p><pre><code>&lt;code&gt;</code></pre></div>';
  const clone = {
    outerHTML: original, style: { removeProperty() {} },
    classList: { remove() {} }, removeAttribute() {}, querySelectorAll() { return []; }
  };
  const rendered = {
    cloneNode: () => clone, querySelectorAll: () => [],
    closest: () => documentTheme === null ? null : { classList: { contains: name => name === `document-${documentTheme}-mode` } }
  };
  const document = {
    baseURI: 'http://localhost/mdpro/',
    documentElement: { classList: { contains: () => dark }, getAttribute: () => '' },
    querySelectorAll: () => sheets
  };
  const window = { document, fetch };
  vm.runInNewContext(source, { window, URL });
  return { build: () => window.HtmlExport.buildExportHtml({ content: '# 본문', renderedElement: rendered }), original };
}

test('stylesheet cascade stays in DOM order when downloads finish in reverse order', async () => {
  let releaseFirst;
  const first = new Promise(resolve => { releaseFirst = resolve; });
  const sheets = [
    { tagName: 'LINK', href: 'http://localhost/first.css' },
    { tagName: 'STYLE', outerHTML: '<style>/* middle */</style>' },
    { tagName: 'LINK', href: 'http://localhost/last.css' }
  ];
  const { build } = setup({ sheets, fetch: async url => {
    if (url.endsWith('first.css')) await first;
    else releaseFirst();
    return { ok: true, text: async () => url.endsWith('first.css') ? '/* first */' : '/* last */' };
  } });
  const { html } = await build();
  assert.ok(html.indexOf('/* first */') < html.indexOf('/* middle */'));
  assert.ok(html.indexOf('/* middle */') < html.indexOf('/* last */'));
  assert.ok(html.indexOf('/* last */') < html.indexOf('id="mdviewer-export-styles"'));
});

for (const [dark, documentTheme, expected] of [[false, null, 'light'], [true, null, 'dark'], [true, 'light', 'light'], [false, 'dark', 'dark']]) {
  test(`export uses ${expected} document theme with app dark=${dark}, override=${documentTheme}`, async () => {
    const { build, original } = setup({ dark, documentTheme });
    const { html } = await build();
    assert.ok(html.includes(original), 'full rendered content is preserved');
    assert.match(html, new RegExp(`color-scheme:${expected}`));
    assert.ok(html.includes(`background:${expected === 'light' ? '#ffffff' : '#0f172a'}!important`));
  });
}

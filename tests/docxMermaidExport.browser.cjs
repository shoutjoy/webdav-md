// Uses the production Mermaid bundle supplied through PV_MERMAID_ENGINE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const MarkdownIt = require('markdown-it');
const JSZip = require('jszip');

(async () => {
  const browser = await chromium.launch({headless: true,
    ...(process.env.PV_TEST_BROWSER ? {executablePath: process.env.PV_TEST_BROWSER} : {})});
  try {
    const page = await browser.newPage();
    await page.route('http://docx.test/**', route => route.fulfill({body: '<!doctype html><body></body>', contentType: 'text/html'}));
    await page.goto('http://docx.test/');
    await page.addScriptTag({path: process.env.PV_MERMAID_ENGINE});
    await page.addScriptTag({path: path.resolve('mdpro/js/mermaid/mermaid_render.js')});
    await page.addScriptTag({path: require.resolve('jszip/dist/jszip.min.js')});
    await page.addScriptTag({path: path.resolve('mdpro/js/extendFiles/docx-export.js')});
    const sources = [
      'flowchart LR\nA["<div>인사관리</div>"] --> B["중요도"]',
      'flowchart TD\nC["수행 수준"] --> D["운영관리"]'
    ];
    const markdown = '설명\n\n' + sources.map(source => '```mermaid\n' + source + '\n```').join('\n\n');
    const html = new MarkdownIt({html: true}).render(markdown);
    await page.evaluate(({markdown, html}) => {
      document.body.innerHTML = '<div id="viewer-container" class="hidden" style="display:none"><div id="fixture"></div></div>';
      window.viewer = document.getElementById('fixture');
      window.currentMarkdown = markdown;
      window.renderMarkdown = async () => { viewer.innerHTML = html; };
      window.syncCurrentMarkdownFromEditor = () => {};
      window.loadOptionalScript = async () => {};
      window.getRenderedHtmlForDocxExport = () => viewer.innerHTML;
      window.resolveDocxExportImage = async () => null;
      window.exportedSvgLabels = [];
      const serialize = XMLSerializer.prototype.serializeToString;
      XMLSerializer.prototype.serializeToString = function (node) {
        if (node.querySelectorAll) exportedSvgLabels.push(Array.from(node.querySelectorAll('tspan')).map(span => span.textContent).join(' '));
        return serialize.call(this, node);
      };
    }, {markdown, html});
    const app = fs.readFileSync('mdpro/js/app.js', 'utf8');
    await page.addScriptTag({content: app.slice(app.indexOf('async function withPreparedMermaidExportViewer('), app.indexOf('async function exportCurrentDocumentAsDocx('))});
    const bytes = await page.evaluate(async () => {
      const blob = await createCurrentDocumentDocxBlob();
      if (document.getElementById('viewer-container').getAttribute('style') !== 'display:none') throw new Error('layout not restored');
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const zip = await JSZip.loadAsync(Buffer.from(bytes));
    assert.match(await page.evaluate(() => exportedSvgLabels.join(' ')), /인사관리/);
    assert.match(await page.evaluate(() => exportedSvgLabels.join(' ')), /수행 수준/);
    const xml = await zip.file('word/document.xml').async('string');
    assert.equal((xml.match(/<w:drawing>/g) || []).length, 2);
    assert.ok(xml.includes('&lt;div&gt;인사관리&lt;/div&gt;'));
    const images = Object.keys(zip.files).filter(name => /^word\/media\/.*\.png$/.test(name));
    assert.equal(images.length, 2);
    const proof = path.resolve('../check/docx-mermaid-proof');
    fs.mkdirSync(proof, {recursive: true});
    fs.writeFileSync(path.join(proof, 'mermaid-export.docx'), Buffer.from(bytes));
    for (const name of images) {
      const png = await zip.file(name).async('nodebuffer');
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.ok(png.readUInt32BE(16) > 100);
      fs.writeFileSync(path.join(proof, path.basename(name)), png);
    }
    await page.evaluate(() => {
      MermaidTRT.exportWrapperImage = async () => { throw new Error('fixture PNG failure'); };
    });
    await assert.rejects(page.evaluate(() => createCurrentDocumentDocxBlob()), /도표 1.*fixture PNG failure/);
    assert.equal(await page.evaluate(() => document.getElementById('viewer-container').getAttribute('style')), 'display:none');
    assert.equal(await page.evaluate(() => currentMarkdown), markdown);
    console.log('PASS: real Mermaid → PNG → DOCX, two diagrams + sources, failure and layout restoration. Proof: ' + proof);
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});

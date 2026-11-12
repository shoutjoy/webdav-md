const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../mdpro');
const output = path.resolve(__dirname, process.env.ME_EXPORT_ARTIFACT_DIR || '../artifacts/me-export-20261108');
const source = fs.readFileSync(path.join(__dirname, 'fixtures/me-factor-analysis.mmd'), 'utf8');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/artifacts/me-export-20261108/') ? path.join(output, path.basename(pathname)) : path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && !file.startsWith(output + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'text/plain' });
      res.end(err ? '' : data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/js/mermaid/mermaid-editor/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.MermaidEditorExport && document.querySelector('#render svg'));
    await page.evaluate(async code => { editor.value = code; await render(); await document.fonts.ready; }, source);
    const svgDownload = page.waitForEvent('download');
    await page.evaluate(() => downloadSVG());
    await (await svgDownload).saveAs(path.join(output, 'factor-analysis.svg'));
    const pngDownload = page.waitForEvent('download');
    await page.evaluate(() => downloadPNG());
    await (await pngDownload).saveAs(path.join(output, 'factor-analysis.png'));
    await page.evaluate(async () => {
      const messages = [];
      const original = window.postMessage;
      window.postMessage = message => messages.push(message);
      try { await sendRenderedSvgToImageInsert(); await sendRenderedPngToImageInsert(); }
      finally { window.postMessage = original; }
      if (!messages.some(m => m.type === 'mdv-open-mermaid-svg-in-image-insert' && m.dataUrl.startsWith('data:image/svg+xml')) ||
          !messages.some(m => m.type === 'mdv-open-mermaid-png-in-image-insert' && m.dataUrl.startsWith('data:image/png'))) throw Error('Image handoff failed');
    });
    const result = await page.evaluate(async () => {
      const svg = renderDiv.querySelector('svg');
      const before = svg.outerHTML;
      const serialized = serializeRenderedSvg(svg);
      const xml = new DOMParser().parseFromString(serialized, 'image/svg+xml');
      if (xml.querySelector('parsererror,foreignObject')) throw Error('Invalid or HTML-dependent SVG');
      const texts = Array.from(xml.querySelectorAll('text'));
      if (!texts.some(t => t.textContent.includes('Parallel Analysis'))) throw Error('Lost label');
      if (texts.some(t => t.style.stroke !== 'none')) throw Error('Inherited text stroke');
      const fonts = [...new Set(texts.map(t => t.style.fontSize))];
      if (fonts.length < 2) throw Error('Lost inline font size');
      const box = svg.viewBox.baseVal;
      previewScale = 1.52; applyPreviewScale();
      const zoomed = getSvgExportSize(svg);
      if (zoomed.width !== Math.ceil(box.width) || zoomed.height !== Math.ceil(box.height)) throw Error('Zoom leaked into export');
      const scaled = serializeRenderedSvg(svg);
      if (svg.outerHTML !== before) throw Error('Source SVG modified');
      // Compare exported native label geometry with the actual source HTML layout.
      const host = document.createElement('div'); host.innerHTML = scaled; document.body.appendChild(host);
      const exported = host.querySelector('svg');
      let overflow = 0;
      exported.querySelectorAll('.node').forEach(node => {
        const shape = node.querySelector('rect,polygon,circle,ellipse');
        if (!shape) return;
        const bounds = shape.getBoundingClientRect();
        node.querySelectorAll('text').forEach(t => {
          const r = t.getBoundingClientRect();
          if (r.left < bounds.left - 2 || r.right > bounds.right + 2) overflow++;
        });
      });
      host.remove();
      if (overflow) throw Error('Label exceeds node bounds: ' + overflow);
      return { width: Math.ceil(box.width), height: Math.ceil(box.height), labels: texts.length, fonts, overflow };
    });
    const pngBytes = fs.readFileSync(path.join(output, 'factor-analysis.png'));
    result.pngWidth = pngBytes.readUInt32BE(16); result.pngHeight = pngBytes.readUInt32BE(20);
    assert.ok(result.pngHeight <= 8192 && result.pngWidth > result.width);
    await page.evaluate(async () => { editor.value = 'graph TD\n A[한글 기본] --> B[Theme]'; await render(); });
    const lightFill = await page.locator('#render .node rect').first().evaluate(e => getComputedStyle(e).fill);
    await page.evaluate(async () => { previewDarkMode = true; applyPreviewThemeUI(); await render(); });
    const darkFill = await page.locator('#render .node rect').first().evaluate(e => getComputedStyle(e).fill);
    assert.notEqual(lightFill, darkFill);
    await page.evaluate(async code => { previewDarkMode = false; applyPreviewThemeUI(); editor.value = code; await render(); }, source);
    await page.evaluate(() => { previewScale = 0.7; applyPreviewScale(); });
    await page.screenshot({ path: path.join(output, 'me-light-preview.png') });
    // Open the actual saved SVG, then render the actual saved PNG in Chrome.
    await page.goto(`http://127.0.0.1:${server.address().port}/artifacts/me-export-20261108/factor-analysis.svg`);
    assert.equal(await page.locator('parsererror').count(), 0);
    await page.screenshot({ path: path.join(output, 'saved-svg.png') });
    await page.goto(`http://127.0.0.1:${server.address().port}/artifacts/me-export-20261108/factor-analysis.png`);
    await page.screenshot({ path: path.join(output, 'saved-png.png') });
    result.pageErrors = errors;
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(result);
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

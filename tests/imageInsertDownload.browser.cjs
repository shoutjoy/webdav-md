const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../mdpro');
const output = path.resolve(__dirname, '../artifacts/image-insert-download-20261108');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    if (req.url === '/download-fixture.png') { res.writeHead(200, {'Content-Type':'image/png'}); return res.end(fs.readFileSync(path.join(output, 'mermaid-dn.png'))); }
    let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => { res.writeHead(err ? 404 : 200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(err ? '' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR:', error.message); });
    await page.addInitScript(() => {
      const property = Object.getOwnPropertyDescriptor(window, 'onload');
      Object.defineProperty(window, 'onload', { configurable: true, get() { return property.get.call(window); }, set(fn) { property.set.call(window, async function (event) { try { await fn.call(this, event); } finally { window.testAppReady = true; } }); } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.MermaidTRT && typeof downloadImageInsertToPc === 'function' && typeof db !== 'undefined' && db, null, { timeout: 60000 });
    console.log('App ready');
    await page.evaluate(async () => {
      localStorage.setItem('md_viewer_mermaid_display_mode', 'fixed');
      updateContent('```mermaid\ngraph TD\n A[한글 Download] --> B[PNG 파일]\n```');
      document.getElementById('viewer-container').classList.remove('hidden');
      document.body.classList.add('viewer-view-mode');
      await renderMarkdown({ force: true, skipMermaidHydration: true });
      await MermaidTRT.renderIn(document.getElementById('viewer'));
    });
    const dn = page.locator('.trt-mermaid-fixed-download');
    await dn.waitFor({ state: 'visible' });
    assert.equal(await dn.evaluate(e => e.previousElementSibling.textContent), 'PNG');
    const dnDownload = page.waitForEvent('download');
    await dn.click();
    await (await dnDownload).saveAs(path.join(output, 'mermaid-dn.png'));
    await page.waitForFunction(() => !document.querySelector('.trt-mermaid-fixed-download').disabled);
    const bytes = fs.readFileSync(path.join(output, 'mermaid-dn.png'));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(await page.locator('#image-insert-modal').isVisible(), false);
    // Reproduce the reported tainted-canvas failure with the app's actual SVG action.
    await page.locator('.trt-mermaid-fixed-export').filter({ hasText: /^SVG$/ }).click();
    await page.locator('#img-insert-preview').waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(async () => (await (await fetch(document.getElementById('img-insert-url').value)).text()).includes('foreignObject')));
    for (const format of ['png', 'jpeg']) {
      const pending = page.waitForEvent('download');
      await page.locator('#img-insert-topc').click();
      await page.locator('#img-insert-download-format select').selectOption(format);
      await page.locator('#img-insert-download-format [type="submit"]').click();
      await (await pending).saveAs(path.join(output, 'mermaid-html-label.' + format));
    }
    await page.evaluate(() => closeImageInsertModal());
    // Existing PNG action continues to open image insertion.
    await page.locator('.trt-mermaid-fixed-export').filter({ hasText: /^PNG$/ }).click();
    await page.locator('#image-insert-modal').waitFor({ state: 'visible' });
    await page.locator('#img-insert-preview').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#img-insert-topc').evaluate(e => e.previousElementSibling.id), 'img-insert-gallery-toggle');
    const dataUrl = 'data:image/png;base64,' + bytes.toString('base64');
    async function chooseFormat(format = 'png') {
      const dialog = page.locator('#img-insert-download-format');
      await dialog.waitFor({ state: 'visible' });
      await dialog.locator('select').selectOption(format);
      await dialog.locator('[type="submit"]').click();
    }
    await page.evaluate(data => applyImageInsertDataUrl(data, '한글 도표.png'), dataUrl);
    let downloadPromise = page.waitForEvent('download');
    await page.locator('#img-insert-topc').click();
    await chooseFormat();
    let download = await downloadPromise;
    assert.equal(download.suggestedFilename(), '한글 도표.png');
    await download.saveAs(path.join(output, 'topc.png'));
    assert.deepEqual(fs.readFileSync(path.join(output, 'topc.png')), bytes);
    for (const format of ['jpeg', 'svg']) {
      downloadPromise = page.waitForEvent('download');
      await page.locator('#img-insert-topc').click();
      await chooseFormat(format);
      download = await downloadPromise;
      assert.equal(download.suggestedFilename(), '한글 도표.' + format);
      await download.saveAs(path.join(output, 'topc.' + format));
      const saved = fs.readFileSync(path.join(output, 'topc.' + format));
      if (format === 'jpeg') { assert.equal(saved[0], 255); assert.equal(saved[1], 216); }
      else { assert.match(saved.toString(), /<svg/); assert.match(saved.toString(), /data:image\/png;base64/); }
    }
    const svgSource = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect x="20" y="10" width="40" height="30" fill="red"/></svg>';
    await page.evaluate(source => applyImageInsertDataUrl('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source), '원본.svg'), svgSource);
    for (const format of ['png', 'jpeg', 'svg']) {
      downloadPromise = page.waitForEvent('download');
      await page.locator('#img-insert-topc').click();
      await chooseFormat(format);
      download = await downloadPromise;
      assert.equal(download.suggestedFilename(), '원본.' + format);
      await download.saveAs(path.join(output, 'svg-source.' + format));
    }
    assert.equal(fs.readFileSync(path.join(output, 'svg-source.svg'), 'utf8'), svgSource);
    assert.equal(fs.readFileSync(path.join(output, 'svg-source.png')).readUInt32BE(16), 100);
    const white = await page.evaluate(async data => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 60;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }, 'data:image/jpeg;base64,' + fs.readFileSync(path.join(output, 'svg-source.jpeg')).toString('base64'));
    assert.ok(white[0] > 245 && white[1] > 245 && white[2] > 245);
    await page.evaluate(data => applyImageInsertDataUrl(data, '한글 도표.png'), dataUrl);
    // Download stored originals without encoding/recompression.
    await page.evaluate(async () => { await saveImageInsertToInternalDb(); });
    assert.match(await page.locator('#img-insert-url').inputValue(), /^internal:\/\//);
    downloadPromise = page.waitForEvent('download');
    await page.locator('#img-insert-topc').click();
    await chooseFormat();
    download = await downloadPromise;
    await download.saveAs(path.join(output, 'topc-internal.png'));
    assert.deepEqual(fs.readFileSync(path.join(output, 'topc-internal.png')), bytes);
    // URL input takes priority over the previous upload; failures do not save stale images.
    await page.locator('#img-insert-url').fill('/download-fixture.png');
    downloadPromise = page.waitForEvent('download');
    await page.locator('#img-insert-topc').click();
    await chooseFormat();
    await (await downloadPromise).saveAs(path.join(output, 'topc-url.png'));
    assert.deepEqual(fs.readFileSync(path.join(output, 'topc-url.png')), bytes);
    await page.locator('#img-insert-url').fill('/missing-image.png');
    await page.locator('#img-insert-topc').click();
    await chooseFormat();
    await page.waitForFunction(() => document.getElementById('img-insert-status').textContent.includes('HTTP 404'));
    assert.equal(await page.locator('#img-insert-topc').isDisabled(), false);
    await page.locator('#img-insert-download-format [data-cancel]').click();
    await page.locator('#img-insert-url').fill(dataUrl);
    await page.evaluate(() => setImageInsertStatus('다운로드와 크게보기 검증 완료', false));
    await page.screenshot({ path: path.join(output, 'insert-topc.png') });
    await page.locator('#img-insert-topc').click();
    await page.screenshot({ path: path.join(output, 'format-selection.png') });
    await page.locator('#img-insert-download-format [data-cancel]').click();
    assert.deepEqual(errors, []);
    const result = { directPngDownload: true, pngInsertPreserved: true, pngSvgJpegSelection: true, svgToPngAndJpeg: true, mermaidForeignObjectToPngAndJpeg: true, jpegWhiteBackground: true, svgOriginalBytes: true, topcOriginalBytes: true, internalOriginalBytes: true, urlOriginalBytes: true, httpFailureHandled: true, pageErrors: errors, pngWidth: bytes.readUInt32BE(16), pngHeight: bytes.readUInt32BE(20) };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(result);
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

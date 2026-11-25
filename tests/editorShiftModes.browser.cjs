const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '../mdpro');
const output = path.resolve(__dirname, '../artifacts/editor-shift-inline-footer-20261125');

(async () => {
    const server = http.createServer((req, res) => {
        const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        fs.readFile(file, (error, bytes) => {
            res.writeHead(error ? 404 : 200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream' });
            res.end(error ? '' : bytes);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    fs.mkdirSync(output, { recursive: true });
    const results = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        await page.route('**/marked/marked.min.js', route => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'vendor/marked/marked.umd.js')) }));
        await page.addInitScript(() => {
            localStorage.setItem('md_viewer_indb_enabled', 'true');
            const descriptor = Object.getOwnPropertyDescriptor(window, 'onload');
            Object.defineProperty(window, 'onload', {
                configurable: true,
                get() { return descriptor.get.call(window); },
                set(fn) { descriptor.set.call(window, async function (event) { try { await fn.call(this, event); } finally { window.testAppReady = true; } }); },
            });
        });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => window.testAppReady && document.querySelector('#editor-shift-float[data-mode]')).catch(async error => {
            console.log(await page.evaluate(() => ({ ready: window.testAppReady, bar: document.getElementById('editor-shift-float')?.outerHTML, app: typeof syncEditorShiftFloatPosition })));
            await page.screenshot({ path: path.join(output, 'failure.png') });
            throw error;
        });
        const bar = page.locator('#editor-shift-float');
        const button = bar.locator('.editor-shift-orientation');
        const buttonsBefore = await bar.locator('button').count();
        assert.equal(buttonsBefore, 9);
        const fixture = '# 배치 모드 확인\n\n가로·세로·하단바를 바꾸어도 이 문장은 유지됩니다.';
        await page.evaluate(text => updateContent(text), fixture);
        const check = async (mode, docked) => {
            await page.waitForFunction(mode => document.getElementById('editor-shift-float').dataset.mode === mode, mode);
            // Narrow footers scroll horizontally; every control must remain reachable.
            const controls = docked ? page.locator('#footer-zoom-font button:visible, #footer-zoom-font input:visible') : bar.locator('button');
            for (const control of await controls.all()) {
                await control.scrollIntoViewIfNeeded();
                if (docked) await control.evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
                const r = await control.boundingBox();
                const { width, height } = page.viewportSize();
                assert.ok(r && r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.x + r.width <= width + 1 && r.y + r.height <= height + 1);
                const hitResult = await control.evaluate(el => {
                    const r = el.getBoundingClientRect();
                    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                    return { ok: hit === el || el.contains(hit), rect: r.toJSON(), hit: hit?.outerHTML.slice(0, 500), scroll: document.getElementById('footer-zoom-font').scrollLeft };
                });
                assert.ok(hitResult.ok, 'footer control covered: ' + await control.getAttribute('title') + ' ' + JSON.stringify(hitResult));
            }
            await page.evaluate(() => {
                document.getElementById('footer-zoom-font').scrollLeft = 0;
                document.getElementById('app-status-footer').firstElementChild.scrollLeft = 0;
            });
            const state = await bar.evaluate(el => {
                const r = el.getBoundingClientRect();
                return {
                    mode: el.dataset.mode, parent: el.parentElement.id,
                    direction: getComputedStyle(el).flexDirection, position: getComputedStyle(el).position,
                    bounds: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
                    buttons: [...el.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { label: b.title, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; }),
                };
            });
            assert.equal(state.parent, docked ? 'editor-shift-footer-slot' : 'drop-zone');
            assert.equal(state.direction, mode === 'vertical' ? 'column' : 'row');
            assert.equal(state.position, docked ? 'static' : 'fixed');
            assert.equal(state.buttons.length, buttonsBefore);
            results.push({ viewport: page.viewportSize(), ...state });
        };
        const measureSpace = () => page.evaluate(() => {
            const rect = document.getElementById('content-viewport').getBoundingClientRect();
            const view = document.getElementById('viewer-container').getBoundingClientRect();
            return {
                footerHeight: document.getElementById('app-status-footer').getBoundingClientRect().height,
                zoomHeight: document.getElementById('footer-zoom-font').getBoundingClientRect().height,
                editorHeight: rect.height, viewerHeight: view.height,
                padding: getComputedStyle(document.getElementById(isEditMode ? 'content-viewport' : 'viewer-container')).paddingBottom,
            };
        });
        const checkNoExtraSpace = async () => {
            await button.click(); // footer → horizontal
            const before = await measureSpace();
            await button.click(); // horizontal → vertical
            await button.click(); // vertical → footer
            const after = await measureSpace();
            assert.deepEqual(after, before, 'docking uses the existing footer height and preserves document space');
            assert.equal(await bar.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
            assert.equal(await bar.evaluate(el => el.parentElement.parentElement.id), 'footer-zoom-font');
            results.push({ noExtraSpace: true, viewport: page.viewportSize(), before, after });
        };
        await check('footer', true);
        await checkNoExtraSpace();
        await check('footer', true);
        await page.screenshot({ path: path.join(output, 'desktop-footer.png') });
        await page.reload();
        await page.waitForFunction(() => window.testAppReady && document.querySelector('#editor-shift-float[data-mode="footer"]'));
        await check('footer', true);
        await page.evaluate(text => updateContent(text), fixture);
        await button.click();
        await check('horizontal', false);
        await page.screenshot({ path: path.join(output, 'desktop-horizontal.png') });
        await button.click();
        await check('vertical', false);
        await page.screenshot({ path: path.join(output, 'desktop-vertical.png') });
        await button.click();
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await check('footer', true);
        await page.screenshot({ path: path.join(output, 'desktop-dark-footer.png') });
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            await checkNoExtraSpace();
            await check('footer', true);
            await page.evaluate(() => { if (!isEditMode) toggleMode('edit'); });
            await check('footer', true);
            await page.evaluate(() => toggleMode('view'));
            await check('footer', true);
            await page.screenshot({ path: path.join(output, `mobile-${width}-footer.png`) });
        }
        await page.evaluate(() => applyEditorShiftControlSize('xlarge'));
        await checkNoExtraSpace();
        await check('footer', true);
        await page.screenshot({ path: path.join(output, 'mobile-320-xlarge-footer.png') });
        await page.evaluate(() => applyEditorShiftControlSize('normal'));
        // The footer handle detaches the same controls and keeps drag working.
        const drag = bar.locator('.editor-shift-drag');
        await drag.scrollIntoViewIfNeeded();
        const rect = await drag.boundingBox();
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await page.mouse.move(30, 350, { steps: 5 });
        await page.mouse.up();
        await check('horizontal', false);
        assert.equal(await page.evaluate(() => editorTextarea.value), fixture, 'mode switching preserves the document');
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(results, null, 2));
        console.log(`PASS: ${results.length} checks, inline footer without lost document space, 9 reachable controls, reload, view/edit, footer undocking, document preserved`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../mdpro');
const output = path.resolve(__dirname, '../artifacts/r-members-20261126');
const rows = [
    ['CA()', '이원분할표에 대한 대응분석 수행'], ['chisq.test()', '카이제곱 독립성 검정'],
    ['prop.table()', '행 또는 열의 조건부 응답비율 계산'], ['fit$eig', '차원별 고유값 및 설명력'],
    ['fit$row$coord', '행 범주의 주좌표'], ['fit$col$coord', '열 범주의 주좌표'],
    ['contrib', '각 차원에 대한 범주별 기여도'], ['cos2', '각 범주가 해당 차원에 의해 표현되는 정도'],
    ['fviz_ca_biplot()', '행과 열의 대응분석 지도 생성'], ['fviz_contrib()', '차원별 범주 기여도 시각화']
];
const source = '| 함수 | 기능 |\n| --- | --- |\n' + rows.map(row => '| ' + row.join(' | ') + ' |').join('\n')
    + '\n\n일반 인라인: \\(\\beta = .792\\)\n\n이중 이스케이프: \\\\(\\\\beta = .792\\\\)'
    + '\n\n괄호 안 수식: (\\(\\beta = .792\\))\n\n통계 유의성: \\(*p<.05, **p<.01, ***p<.001\\)'
    + '\n\n합계: \\(\\sum \\beta_i^2\\)\n\n분수: \\(\\text{AVE}=\\frac{2.7069}{4}=0.677\\)'
    + '\n\n코드와 수식: `result$points` 다음 값은 $x_i$이다.\n\n**굵게** (Self-Efficacy), (A/B testing), (→ 동기 부여)'
    + '\n\n$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$';

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        let popupDocument = '';
        const context = await browser.newContext({ viewport: { width: 1450, height: 1100 } });
        await context.addInitScript(() => {
            localStorage.setItem('md_viewer_indb_enabled', 'true');
            const property = Object.getOwnPropertyDescriptor(window, 'onload');
            Object.defineProperty(window, 'onload', {
                configurable: true,
                get() { return property.get.call(window); },
                set(fn) { property.set.call(window, async function (event) { try { await fn.call(this, event); } finally { window.testAppReady = true; } }); }
            });
        });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.hostname === 'r-members.test' && url.pathname === '/r-member-pv-fixture.html') return route.fulfill({ contentType: 'text/html', body: popupDocument });
            let file;
            if (url.hostname === 'r-members.test') file = path.join(root, decodeURIComponent(url.pathname));
            else if (url.href.includes('marked/marked.min.js')) file = path.join(root, 'vendor/marked/marked.umd.js');
            else if (url.href.includes('mathjax')) file = path.join(root, 'vendor/mathjax/tex-mml-svg.min.js');
            else if (url.hostname === 'unpkg.com' && url.pathname.includes('lucide')) return route.fulfill({ contentType: 'text/javascript', body: 'window.lucide={createIcons(){}};' });
            else return route.abort();
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ path: file, contentType: ({ '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://r-members.test/index.html', { waitUntil: 'load' });
        await page.waitForFunction(() => window.testAppReady && window.InDbStorage?.getDatabase());
        await page.evaluate(async text => {
            updateContent(text);
            if (isEditMode) toggleMode('view');
        }, source);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#viewer mjx-container')).filter(node => !node.closest('mjx-assistive-mml')).length === 8).catch(async error => {
            console.log(await page.evaluate(() => ({ math: document.querySelectorAll('#viewer mjx-container').length, html: document.getElementById('viewer').innerHTML.slice(0, 3000), mathJax: typeof window.MathJax?.typesetPromise })));
            throw error;
        });
        const inspect = element => ({
            rows: Array.from(element.querySelectorAll('table tbody tr')).map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim())),
            tableMath: element.querySelectorAll('table mjx-container').length,
            math: Array.from(element.querySelectorAll('mjx-container')).filter(node => !node.closest('mjx-assistive-mml')).length,
            errors: element.querySelectorAll('[data-mjx-error],mjx-merror').length,
            tokens: /@@(?:MATHSEG|RMEMBER)_/.test(element.textContent),
            code: element.querySelector('code')?.textContent,
            bold: Array.from(element.querySelectorAll('b,strong')).some(node => node.textContent === '굵게')
        });
        const main = await page.locator('#viewer').evaluate(inspect);
        assert.deepEqual(main.rows, rows);
        assert.equal(main.tableMath, 0); assert.equal(main.math, 8); assert.equal(main.errors, 0); assert.equal(main.tokens, false);
        assert.equal(main.code, 'result$points'); assert.equal(main.bold, true);
        await page.screenshot({ path: path.join(output, 'main.png') });
        // Serve the production PV document via navigation: document.write into
        // an intercepted about:blank popup stalls in this headless harness.
        popupDocument = await page.evaluate(() => getPreviewPopupDocumentHtml());
        const popup = page.waitForEvent('popup');
        await page.evaluate(() => { previewPopupWindow = window.open('/r-member-pv-fixture.html', 'r-member-pv'); });
        const pv = await popup;
        await pv.waitForLoadState('load');
        await page.evaluate(() => updatePreviewPopupContent());
        await pv.waitForFunction(() => Array.from(document.querySelectorAll('#pv-pages mjx-container')).filter(node => !node.closest('mjx-assistive-mml')).length === 8).catch(async error => {
            console.log(await pv.evaluate(() => ({ math: document.querySelectorAll('mjx-container').length, pageMath: document.querySelectorAll('#pv-pages mjx-container').length, body: document.documentElement?.outerHTML.slice(-1800) })));
            throw error;
        });
        const preview = await pv.locator('#pv-pages').evaluate(inspect);
        assert.deepEqual(preview, main);
        await pv.screenshot({ path: path.join(output, 'pv.png') });
        const originalPreserved = await page.evaluate(text => currentMarkdown === text && editorTextarea.value === text, source);
        assert.equal(originalPreserved, true); assert.deepEqual(errors, []);
        const result = { main, preview, originalPreserved, errors, mathJax: 'bundled real MathJax SVG; CDN URL served locally by browser route' };
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../mdpro'), output = path.resolve(root, '../artifacts/mermaid-custom2-20261125');
const code = 'xychart-beta\n title "Monthly Revenue"\n x-axis [Jan, Feb, Mar, Apr, May, Jun]\n y-axis "Revenue (USD)" 0 --> 10000\n bar [5000, 6200, 7800, 5500, 8900, 9200]\n line [5000, 6200, 7800, 5500, 8900, 9200]';
(async () => {
    const server = http.createServer((req, res) => {
        const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html'));
        if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
        fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm' })[path.extname(file)] || 'application/octet-stream' }); res.end(error ? '' : bytes); });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    fs.mkdirSync(output, { recursive: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
        page.on('pageerror', e => console.log('PAGE ERROR', e.message));
        await page.addInitScript(() => {
            localStorage.setItem('md_viewer_mermaid_display_mode', 'fixed'); localStorage.setItem('md_viewer_indb_enabled', 'true');
            const p = Object.getOwnPropertyDescriptor(window, 'onload'); Object.defineProperty(window, 'onload', { configurable: true, get() { return p.get.call(window); }, set(fn) { p.set.call(window, async function (e) { try { await fn.call(this, e); } finally { window.testAppReady = true; } }); } });
        });
        await page.route('**/marked/marked.min.js', route => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'vendor/marked/marked.umd.js')) }));
        await page.route('**/dist/mermaid.min.js', route => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(process.env.MERMAID_TEST_SCRIPT || path.resolve(root, '../../check/pv-mermaid-proof/mermaid.min.js')) }));
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => window.testAppReady && window.MermaidAppearanceCustom2 && window.InDbStorage?.getDatabase());
        const wrapper = page.locator('#viewer .trt-mermaid-wrapper');
        const labels = page.locator('#viewer [data-mdpro-value-labels] text');
        const custom = page.locator('.trt-mermaid-custom'), custom2 = page.locator('.trt-mermaid-custom2');
        const showCode = async value => {
            await page.evaluate(value => { updateContent('```mermaid\n' + value + '\n```'); if (isEditMode) toggleMode('view'); }, value);
            await page.waitForFunction(() => document.querySelector('#viewer .trt-mermaid-wrapper svg'));
        };
        const open = async () => {
            await wrapper.getByRole('button', { name: '도표 스타일 조절', exact: true }).click();
            const floating = wrapper.getByRole('button', { name: '플로팅', exact: true });
            if (await floating.count()) await floating.click();
            for (const fold of await page.locator('.trt-custom-section-fold').all()) if (!await fold.evaluate(el => el.open)) await fold.locator('summary').first().click();
            const xy=custom2.locator('details').filter({has:page.locator('summary').filter({hasText:'XY 막대 숫자 추가'})}).last();if(await xy.count())await xy.evaluate(e=>{e.open=true;});
        };
        await showCode(code); await open();
        const controls = await custom.locator('button,input,select,textarea,summary').all();
        for (const control of controls) assert.ok(await control.getAttribute('title'), await control.getAttribute('aria-label'));
        await custom.getByRole('button', { name: 'XY 막대 전체 선택', exact: true }).hover();
        assert.match(await custom.getByRole('button', { name: 'XY 막대 전체 선택', exact: true }).getAttribute('title'), /축·배경/);
        await custom.getByRole('button', { name: 'XY 막대 전체 선택', exact: true }).click();
        await custom.getByLabel('새 도구 이름', { exact: true }).fill('매출 막대 색');
        await custom.getByRole('button', { name: '하단에 도구 추가', exact: true }).click();
        await custom.getByLabel('매출 막대 색 조절값', { exact: true }).fill('#3377bb'); await custom.getByLabel('매출 막대 색 조절값', { exact: true }).dispatchEvent('change');
        await page.waitForFunction(() => document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom.rules.length === 6);
        const elementCount = await wrapper.evaluate(w => MermaidAppearanceCustom.elements(w.querySelector('svg')).length);
        await custom2.getByLabel('숫자 항목 이름', { exact: true }).fill('월별 매출');
        assert.equal(await custom2.getByLabel('숫자를 가져올 코드', { exact: true }).locator('option').count(), 1);
        assert.deepEqual(await custom2.getByLabel('표시할 숫자 항목', { exact: true }).locator('option').allTextContents(), ['1 · 5000', '2 · 6200', '3 · 7800', '4 · 5500', '5 · 8900', '6 · 9200']);
        await custom2.getByRole('button', { name: '막대 위에 숫자 추가', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('#viewer [data-mdpro-value-labels] text').length === 6);
        assert.deepEqual(await labels.allTextContents(), ['5,000', '6,200', '7,800', '5,500', '8,900', '9,200']);
        const placement = await wrapper.evaluate(w => {
            const bars = [...w.querySelectorAll('.bar-plot-0 rect')], labels = [...w.querySelectorAll('[data-mdpro-value-labels] text')];
            return labels.map((el, i) => { const r = el.getBoundingClientRect(), b = bars[i].getBoundingClientRect(); return { center: (r.left + r.right) / 2, barCenter: (b.left + b.right) / 2, bottom: r.bottom, barTop: b.top }; });
        });
        for (const p of placement) { assert.ok(Math.abs(p.center - p.barCenter) < 1); assert.ok(p.bottom < p.barTop, JSON.stringify(p)); }
        await custom.getByRole('button', { name: '선택 해제', exact: true }).click();
        await page.locator('.trt-mermaid-appearance-panel').getByRole('button', { name: '닫기', exact: true }).click();
        await wrapper.locator('.trt-mermaid-canvas').screenshot({ path: path.join(output, 'monthly-default.png') });
        await wrapper.getByRole('button', { name: '도표 스타일 조절', exact: true }).click();
        const repeated = await wrapper.evaluate(w => {
            const svg = w.querySelector('svg'), source = w.dataset.mermaidOriginalSource, config = w.__mdvMermaidAppearance.custom2;
            MermaidAppearanceCustom2.apply(svg, source, config); const first = svg.getAttribute('viewBox');
            MermaidAppearanceCustom2.apply(svg, source, config);
            return { stable: first === svg.getAttribute('viewBox'), count: svg.querySelectorAll('[data-mdpro-value-labels] text').length };
        });
        assert.deepEqual(repeated, { stable: true, count: 6 });
        assert.equal(await wrapper.evaluate(w => MermaidAppearanceCustom.elements(w.querySelector('svg')).length), elementCount);
        assert.equal(await page.evaluate(() => MermaidAppearanceSource.blocks(editorTextarea.value)[0].code.trim()), code);
        const set = async (label, value) => { const input = custom2.getByLabel('월별 매출 ' + label, { exact: true }); await input.fill(value); await input.dispatchEvent('change'); await page.waitForFunction(() => !document.querySelector('.trt-mermaid-custom2 input').disabled); };
        await set('글자 크기', '22'); await set('글자색', '#aa2255'); await set('세로 이동', '-6');
        await set('앞에 붙일 글자', '$'); await set('뒤에 붙일 글자', ' USD');
        assert.equal(await labels.first().textContent(), '$5,000 USD');
        await page.screenshot({ path: path.join(output, 'monthly-controls.png') });
        const exported = await wrapper.evaluate(async w => ({ svg: (await MermaidTRT.exportWrapperImage(w, 'svg')).dataUrl, png: (await MermaidTRT.exportWrapperImage(w, 'png')).dataUrl }));
        const svgText = decodeURIComponent(exported.svg.slice(exported.svg.indexOf(',') + 1));
        assert.match(svgText, /\$5,000 USD/); fs.writeFileSync(path.join(output, 'monthly.svg'), svgText);
        fs.writeFileSync(path.join(output, 'monthly.png'), Buffer.from(exported.png.split(',')[1], 'base64'));
        const saved = await wrapper.evaluate(async w => { await MermaidAppearanceSource.apply(w); return editorTextarea.value; });
        assert.match(saved, /"custom2"/); assert.match(saved, /bar \[5000, 6200, 7800, 5500, 8900, 9200\]/);
        await page.reload(); await page.waitForFunction(() => window.testAppReady && window.MermaidAppearanceCustom2 && window.InDbStorage?.getDatabase());
        await page.evaluate(text => { updateContent(text); if (isEditMode) toggleMode('view'); }, saved);
        await page.waitForFunction(() => document.querySelectorAll('#viewer [data-mdpro-value-labels] text').length === 6);
        assert.equal(await labels.first().textContent(), '$5,000 USD');
        await open();
        await custom2.getByRole('button', { name: '숫자 항목 삭제', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('#viewer [data-mdpro-value-labels] text'));
        assert.equal(await wrapper.evaluate(w => w.__mdvMermaidAppearance.custom.rules.length), 6);
        const horizontal = 'xychart-beta horizontal\n x-axis [A,B,C]\n y-axis "Value" -100 --> 100\n line [1,2,3]\n bar [-20,0,40]\n bar [50,60,70]';
        await showCode(horizontal); await open();
        assert.equal(await custom2.getByLabel('숫자를 가져올 코드', { exact: true }).locator('option').count(), 2);
        await custom2.getByRole('button', { name: '막대 위에 숫자 추가', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('#viewer [data-mdpro-value-labels] text').length === 3).catch(async error => {
            console.log(await wrapper.evaluate(w => ({ error: w.querySelector('svg').dataset.mdproValueLabelError, items: w.__mdvMermaidAppearance.custom2, bars: [...w.querySelectorAll('[class*="bar-plot-"]')].map(el => [el.getAttribute('class'), el.querySelectorAll('rect').length, el.innerHTML.slice(0, 600)]) })));
            throw error;
        });
        assert.deepEqual(await labels.allTextContents(), ['-20', '0', '40']);
        const negative = await wrapper.evaluate(w => {
            const bar = w.querySelector('.bar-plot-1 rect').getBoundingClientRect(), label = w.querySelector('[data-mdpro-value-labels] text').getBoundingClientRect();
            return { barRight: bar.right, labelLeft: label.left };
        });
        assert.ok(negative.labelLeft > negative.barRight);
        await custom2.getByLabel('숫자를 가져올 코드', { exact: true }).selectOption('1');
        await custom2.getByLabel('표시할 숫자 항목', { exact: true }).selectOption(['0', '2']);
        await custom2.getByRole('button', { name: '막대 위에 숫자 추가', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('#viewer [data-mdpro-value-labels] text').length === 5);
        assert.deepEqual(await labels.allTextContents(), ['-20', '0', '40', '50', '70']);
        const guarded = await wrapper.evaluate(w => {
            const svg = w.querySelector('svg'), source = w.dataset.mermaidOriginalSource, config = w.__mdvMermaidAppearance.custom2;
            const stale = MermaidAppearanceCustom2.apply(svg, source + '\n%% changed', config);
            const blank = svg.querySelectorAll('[data-mdpro-value-labels] text').length;
            MermaidAppearanceCustom2.apply(svg, source, config);
            const v = svg.viewBox.baseVal;
            const fits = [...svg.querySelectorAll('[data-mdpro-value-labels] text')].every(el => { const b = el.getBBox(); return b.x >= v.x && b.y >= v.y && b.x + b.width <= v.x + v.width && b.y + b.height <= v.y + v.height; });
            return { stale, blank, fits, restored: svg.querySelectorAll('[data-mdpro-value-labels] text').length };
        });
        assert.deepEqual(guarded, { stale: 0, blank: 0, fits: true, restored: 5 });
        await wrapper.evaluate(w => MermaidTRT.setBlockTheme(w, 'dark'));
        assert.equal(await labels.first().evaluate(el => getComputedStyle(el).fill), await wrapper.locator('svg text').first().evaluate(el => getComputedStyle(el).fill));
        await page.screenshot({ path: path.join(output, 'horizontal.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await custom2.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, 'mobile.png') });
        await page.setViewportSize({ width: 1500, height: 1050 });
        await showCode('flowchart LR\n A[Start] --> B[End]'); await open();
        assert.ok(await custom2.getByRole('button', { name: '막대 위에 숫자 추가', exact: true }).isDisabled());
        fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ tooltips: controls.length, monthlyLabels: 6, placement, existingCustomPreserved: true, sourceReload: true, svgPng: true, repeated, guarded, negativeZero: true, horizontalMultiSeriesSubset: true, darkAutoColor: true, mobile: true }, null, 2));
        console.log('PASS: tooltips, six actual monthly labels/geometry, existing custom, formatting, SVG/PNG, source reload, removal, horizontal multi-series subset, mobile');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

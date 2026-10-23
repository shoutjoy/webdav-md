const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const MarkdownIt = require('markdown-it');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PV_TEST_BROWSER ? { executablePath: process.env.PV_TEST_BROWSER } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width:1440, height:1000 } });
    const css = fs.readFileSync(path.join(__dirname, '../mdpro/css/style.css'), 'utf8');
    await context.route('**/*', route => {
      const url = route.request().url();
      return route.fulfill({ contentType:url.endsWith('.css') ? 'text/css' : url.includes('.js') ? 'text/javascript' : 'text/html', body:url.endsWith('.css') ? css : url.includes('.js') ? '' : '<!doctype html><link rel="stylesheet" href="/css/style.css"><body></body>' });
    });
    const parent = await context.newPage();
    await parent.goto('http://pv-fixture.test/');
    await parent.addScriptTag({ content: 'var previewPopupWindow=null;var previewPopupScale=1;var previewPopupWidthScale=1;var previewPopupFontSize=16;' });
    await parent.addScriptTag({ path:path.join(__dirname, '../mdpro/js/UI_PV/editpv.js') });
    const popupHtml = await parent.evaluate(() => getPreviewPopupDocumentHtml());
    const popupEvent = parent.waitForEvent('popup');
    await parent.evaluate(() => {
      previewPopupWindow = window.open('', 'pv-regression');
    });
    const popup = await popupEvent;
    // Image and math loaders are outside this table/layout fixture. Keep the
    // actual popup HTML, controls, inline handlers and CSS without external scripts.
    await popup.setContent(popupHtml.replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*rel="stylesheet"[^>]*>/g, ''));
    await popup.addStyleTag({content:css.replace(/^@import[^;]+;/gm, '')});
    await popup.waitForSelector('#pv-content', {state:'attached'});
    await popup.setViewportSize({ width:1440, height:1000 });
    const expected = Array.from({length:80}, (_, i) => {
      const row = ['item_'+i, '', '', '', '', ''];
      if (i !== 12) row[1 + (Math.floor(i / 4) % 5)] = (0.959 - i / 1000).toFixed(3);
      return row;
    });
    const markdown = '|source|MR1|MR4|MR2|MR3|MR5|\n|---|---|---|---|---|---|\n'+expected.map(row=>'|'+row.join('|')+'|').join('\n');
    const html = '<p style="height:850px;margin:0">빈 셀 표 페이지 경계 회귀 검증</p>'+new MarkdownIt().render(markdown);
    const render = async () => parent.evaluate(html => {
      const doc = previewPopupWindow.document;
      const content = doc.getElementById('pv-content');
      content.innerHTML = html;
      previewPopupRenderPaginatedPages(content);
    }, html);
    await render();
    const rows = () => popup.evaluate(() => Array.from(document.querySelectorAll('#pv-pages tbody > tr'), row => Array.from(row.cells, cell => cell.textContent.trim())));
    assert.deepEqual(await rows(), expected);
    const pageCount = await popup.locator('.pv-page').count();
    assert.ok(pageCount >= 3);
    const controls = await popup.locator('#pv-toolbar button').allTextContents();
    assert.equal(controls[controls.indexOf('2페이지 보기') + 1], '매트릭스보기');
    for (const label of ['렌더 편집','표','행추가','열추가','원본 노트에 반영','내보내기','인쇄','닫기']) assert.ok(controls.includes(label));
    async function rects() {
      return popup.evaluate(() => Array.from(document.querySelectorAll('.pv-page'), page => {
        const r = page.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
      }));
    }
    await popup.locator('#pv-two-page-toggle').click();
    const two = await rects();
    assert.ok(two[1].x > two[0].right && Math.abs(two[1].y - two[0].y) < 2);
    assert.ok(two[2].y >= two[0].bottom);
    assert.equal(await popup.locator('#pv-two-page-toggle').getAttribute('aria-pressed'), 'true');
    await render();
    assert.deepEqual(await rows(), expected, 'Re-pagination in two-page mode must preserve empty columns');
    assert.equal(await popup.locator('.pv-page').count(), pageCount);
    if (process.env.PV_PROOF_DIR) {
      fs.mkdirSync(process.env.PV_PROOF_DIR, {recursive:true});
      await popup.screenshot({path:path.join(process.env.PV_PROOF_DIR, 'two-pages.png')});
    }
    await popup.locator('#pv-matrix-toggle').click();
    const matrix = await rects();
    assert.ok(Math.abs(matrix[2].y - matrix[0].y) < 2, 'Matrix shows at least three pages in a row at desktop width');
    assert.ok(matrix.every(r => r.x >= 0 && r.right <= 1441));
    assert.equal(await parent.evaluate(() => getPreviewPopupPageLayout()), 'matrix');
    await render();
    assert.deepEqual(await rows(), expected);
    assert.equal(await popup.locator('.pv-page').count(), pageCount);
    if (process.env.PV_PROOF_DIR) await popup.screenshot({path:path.join(process.env.PV_PROOF_DIR, 'matrix.png')});
    // Screen layout must not change print paper size or impose a grid on print.
    await popup.emulateMedia({ media:'print' });
    const print = await popup.evaluate(() => ({ display:getComputedStyle(document.getElementById('pv-pages')).display, zoom:getComputedStyle(document.querySelector('.pv-page')).zoom, width:document.querySelector('.pv-page').getBoundingClientRect().width }));
    assert.equal(print.display, 'block');
    assert.equal(Number(print.zoom), 1);
    assert.ok(Math.abs(print.width - 210 * 96 / 25.4) < 2);
    await popup.emulateMedia({ media:'screen' });
    await popup.setViewportSize({ width:700, height:900 });
    await popup.waitForFunction(() => Number(document.getElementById('pv-pages').style.getPropertyValue('--pv-layout-columns')) === 2);
    const narrow = await rects();
    assert.ok(narrow.every(r => r.x >= 0 && r.right <= 701));
    await popup.locator('#pv-matrix-toggle').click();
    assert.equal(await popup.evaluate(() => document.body.dataset.pvPageLayout), 'single');
    const single = await rects();
    assert.ok(single[1].y > single[0].y);
    assert.deepEqual(await rows(), expected);
    // Windowed -> maximized -> narrow -> restored: only the PV viewport
    // should scroll, and it must always fill the area below the toolbar.
    for (const size of [{width:1100,height:820},{width:1844,height:1018},{width:700,height:900},{width:1100,height:820}]) {
      await popup.setViewportSize(size);
      const shell = await popup.evaluate(() => {
        const viewport=document.getElementById('pv-viewport'),toolbar=document.getElementById('pv-toolbar');
        const v=viewport.getBoundingClientRect(),t=toolbar.getBoundingClientRect();
        return {window:{width:innerWidth,height:innerHeight},viewport:{left:v.left,right:v.right,top:v.top,bottom:v.bottom},
          toolbar:{right:t.right,bottom:t.bottom},outerOverflow:document.documentElement.scrollHeight-innerHeight,
          scrollable:viewport.scrollHeight>viewport.clientHeight};
      });
      assert.ok(Math.abs(shell.viewport.right-size.width)<=1,JSON.stringify(shell));
      assert.ok(Math.abs(shell.viewport.bottom-size.height)<=1,JSON.stringify(shell));
      assert.ok(Math.abs(shell.viewport.top-shell.toolbar.bottom)<=1,JSON.stringify(shell));
      assert.ok(shell.outerOverflow<=1,JSON.stringify(shell));
      assert.ok(shell.scrollable);
    }
    await popup.mouse.move(650,500);
    await popup.mouse.wheel(0,650);
    await popup.waitForFunction(() => document.getElementById('pv-viewport').scrollTop>100);
    assert.equal(await popup.evaluate(() => document.scrollingElement.scrollTop),0,'Wheel scrolling must not move the outer document');
    await popup.locator('#pv-viewport').evaluate(viewport=>{viewport.scrollTop=0;});
    // Single-page zoom must reserve its scaled width and height in the layout;
    // transforms alone left overlapping pages and an unreachable left edge.
    await popup.locator('#pv-pages').evaluate(pages=>pages.style.setProperty('--pv-page-scale','1.6'));
    const enlarged=await rects();
    assert.ok(enlarged[0].x>=0);
    assert.ok(enlarged[1].y>=enlarged[0].bottom);
    await popup.locator('#pv-pages').evaluate(pages=>pages.style.setProperty('--pv-page-scale','1'));
    if (process.env.PV_PROOF_DIR) {
      await popup.setViewportSize({width:1844,height:1018});
      await popup.locator('.pv-page').nth(1).evaluate(page=>page.scrollIntoView({block:'start'}));
      await popup.screenshot({path:path.join(process.env.PV_PROOF_DIR,'pv-resized-full-window.png')});
    }
    console.log('Actual PV popup passed: sparse Markdown cells, page boundaries, two-page/matrix clicks, resize, persistence, print width, toolbar preservation. Pages:', pageCount);
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

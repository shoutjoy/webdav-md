// Run with Playwright available in NODE_PATH: node tests/pvTablePagination.browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PV_TEST_BROWSER ? { executablePath: process.env.PV_TEST_BROWSER } : {}) });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>
      #content { width:680px;height:250px;overflow:hidden }
      table { width:100%;border-collapse:collapse;font:14px Arial }
      th,td { border:1px solid #789;padding:6px;height:22px }
    </style><div id="content"></div>`);
    const source = fs.readFileSync(path.join(__dirname, '../mdpro/js/UI_PV/editpv.js'), 'utf8');
    const layoutSource = source.slice(source.indexOf('const PREVIEW_PV_PAGE_LAYOUT_STORAGE_KEY'), source.indexOf('const PREVIEW_PV_HEADER_SCALE_STORAGE_KEY'));
    await page.addScriptTag({ content: layoutSource });
    await page.addScriptTag({ content: source.slice(source.indexOf('function previewPopupFindWordBoundary('), source.indexOf('function previewPopupSplitPreformatted(')) });
    const result = await page.evaluate(() => {
      const content = document.getElementById('content');
      const headers = '<thead><tr>' + ['Latent','Item','Est','SE','std','Z','CR','AVE'].map(x => `<th>${x}</th>`).join('') + '</tr></thead>';
      const group = (name, span = '4') => Array.from({ length:4 }, (_, i) => '<tr>' +
        (i === 0 ? `<td rowspan="${span}">${name}</td>` : '') + `<td>${name}_i${i}</td><td>1.048</td><td>0.092</td><td>0.907</td><td>11.426***</td>` +
        (i === 0 ? `<td rowspan="${span}">0.952</td><td rowspan="${span}">0.833</td>` : '') + '</tr>').join('');
      function split(html) {
        const root = document.createElement('div'); root.innerHTML = html;
        const table = root.firstElementChild;
        const original = table.outerHTML;
        const parts = previewPopupSplitTableRows(table, content);
        if (table.outerHTML !== original) throw new Error('Source table was modified');
        return parts;
      }
      const parts = split(`<table><caption>Results</caption>${headers}<tbody>${group('oper')}${group('work')}</tbody><tfoot><tr><td colspan="8">End</td></tr></tfoot></table>`);
      const widths = parts.map(part => {
        content.appendChild(part);
        const sizes = Array.from(part.tHead.rows[0].cells, cell => cell.getBoundingClientRect().width);
        part.remove(); return sizes;
      });
      // No partial merged group can be placed in the remaining space.
      const filler = document.createElement('div'); filler.style.height = '120px'; content.appendChild(filler);
      const blocked = split(`<table>${headers}<tbody>${group('oper')}${group('work')}</tbody></table>`);
      filler.remove();
      const zero = split(`<table>${headers}<tbody>${group('oper', '0')}</tbody><tbody>${group('work', '0')}</tbody></table>`);
      const nested = split(`<table>${headers}<tbody>${group('oper').replace('oper_i0', 'oper_i0<table><tbody><tr><td>nested</td></tr></tbody></table>')}${group('work')}</tbody></table>`);
      return {
        rowCounts: parts.map(p => p.tBodies[0].rows.length),
        firstCells: parts.map(p => p.tBodies[0].rows[0].cells[0].textContent),
        headers: parts.map(p => p.tHead.rows[0].cells.length),
        captions: parts.map(p => !!p.caption), footers: parts.map(p => !!p.tFoot), widths,
        blocked: blocked === null,
        zero: zero.map(p => p.tBodies[0].rows.length),
        nested: nested.map(p => Array.from(p.querySelectorAll('tbody > tr')).filter(r => r.closest('table') === p).length)
      };
    });
    assert.deepEqual(result.rowCounts, [4, 4]);
    assert.deepEqual(result.firstCells, ['oper', 'work']);
    assert.deepEqual(result.headers, [8, 8]);
    assert.deepEqual(result.captions, [true, false]);
    assert.deepEqual(result.footers, [false, true]);
    assert.ok(result.blocked);
    assert.deepEqual(result.zero, [4, 4]);
    assert.deepEqual(result.nested, [4, 4]);
    result.widths[0].forEach((width, i) => assert.ok(Math.abs(width - result.widths[1][i]) < 1));
    console.log('PV table browser regression passed:', JSON.stringify(result));
    // Exercise the complete pagination path, not only the width helper.
    await page.addScriptTag({ content: source.slice(source.indexOf('function previewPopupSplitPreformatted('), source.indexOf('function applyPreviewPopupViewport(')) });
    await page.addScriptTag({ content: `
      var previewPopupWindow = window;
      var previewPopupScale = 1;
      function isPreviewPopupAlive() { return true; }
      function getPreviewPopupPageMargins() { return {top:0,right:0,bottom:0,left:0}; }
      function previewPopupApplyPageMarginState() {}
    ` });
    await page.addStyleTag({ content: '.pv-page{width:680px;height:400px;margin:16px;background:white}.pv-page-content{width:100%;height:100%;overflow:hidden}' });
    const wide = await page.evaluate(() => {
      const pages = document.createElement('div'); pages.id = 'pv-pages'; document.body.appendChild(pages);
      const root = document.createElement('div');
      const names = ['n_profiles','EEV','EEI','EEE','EII','VVI','VII','VVV','final','sig','extra1','extra2'];
      root.innerHTML = '<table><thead><tr>' + names.map(n => '<th>'+n+'</th>').join('') + '</tr></thead><tbody>' +
        Array.from({length:5}, (_, r) => '<tr><td>'+(r+1)+'</td>'+names.slice(1).map((_, c) => '<td>'+(-1858.048 - r - c).toFixed(3)+'</td>').join('')+'</tr>').join('')+'</tbody></table><p>AFTER TABLE</p>';
      const original = root.innerHTML;
      previewPopupRenderPaginatedPages(root);
      const tables = Array.from(pages.querySelectorAll('table'));
      return {
        count: tables.length,
        headers: tables.flatMap(t => Array.from(t.tHead.rows[0].cells, c => c.textContent)),
        first: tables.map(t => t.tHead.rows[0].cells[0].textContent),
        fits: tables.every(t => t.getBoundingClientRect().right <= t.closest('.pv-page-content').getBoundingClientRect().right + 1 && t.scrollWidth <= 681),
        after: pages.textContent.includes('AFTER TABLE'), unchanged: root.innerHTML === original,
        rows: tables.map(t => t.tBodies[0].rows.length)
      };
    });
    assert.ok(wide.count > 1);
    for (const name of ['EEV','EEI','EEE','EII','VVI','VII','VVV','final','sig','extra1','extra2']) assert.ok(wide.headers.includes(name), name);
    assert.ok(wide.first.every(name => name === 'n_profiles'));
    assert.ok(wide.fits);
    assert.ok(wide.after && wide.unchanged);
    assert.ok(wide.rows.every(count => count === 5));
    console.log('PV full pagination wide table passed:', JSON.stringify(wide));
    const sizing = await page.evaluate(() => {
      const content = document.getElementById('content');
      content.style.width = '500px';
      function check(count) {
        const source = document.createElement('table');
        source.style.fontSize = '16px';
        source.innerHTML = '<thead><tr>'+Array.from({length:count}, (_,i) => '<th>H'+i+'</th>').join('')+'</tr></thead><tbody><tr>'+Array.from({length:count}, () => '<td>-1858.048</td>').join('')+'</tr></tbody>';
        const original = source.outerHTML;
        const parts = previewPopupFitTableWidth(source, content);
        return { count: parts.length, unchanged: source.outerHTML === original, sizes: parts.map(part => {
          content.appendChild(part);
          const value = {width:part.scrollWidth, font:parseFloat(getComputedStyle(part).fontSize)};
          part.remove(); return value;
        }) };
      }
      return { narrow: check(2), moderate: check(6), wide: check(14) };
    });
    assert.equal(sizing.narrow.count, 1);
    assert.equal(sizing.narrow.sizes[0].font, 16);
    assert.equal(sizing.moderate.count, 1);
    assert.ok(sizing.moderate.sizes[0].font < 16);
    assert.ok(sizing.wide.count > 1);
    for (const value of Object.values(sizing)) {
      assert.ok(value.unchanged);
      assert.ok(value.sizes.every(size => size.width <= 501 && size.font >= 11));
    }
    console.log('PV table sizing passed:', JSON.stringify(sizing));
    const sparse = await page.evaluate(() => {
      const root = document.createElement('div');
      const expected = Array.from({length:20}, (_, i) => {
        const cells = ['item_'+i, '', '', '', '', ''];
        cells[1 + Math.floor(i / 4)] = (0.959 - i / 100).toFixed(3);
        return cells;
      });
      expected.splice(9, 0, ['all_empty', '', '', '', '', '']);
      root.innerHTML = '<p style="height:350px;margin:0">Before sparse table</p><table><thead><tr>'+['source','MR1','MR4','MR2','MR3','MR5'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+expected.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
      const original = root.innerHTML;
      previewPopupRenderPaginatedPages(root);
      const actual = Array.from(document.querySelectorAll('#pv-pages table tbody > tr'), row => Array.from(row.cells, c => c.textContent));
      return {expected, actual, unchanged: root.innerHTML === original};
    });
    assert.deepEqual(sparse.actual, sparse.expected, 'Sparse table must retain every empty cell and column on every page');
    assert.ok(sparse.unchanged);
    console.log('PV sparse table full pagination passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

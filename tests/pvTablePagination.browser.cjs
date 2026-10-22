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
    await page.addScriptTag({ content: source.slice(source.indexOf('function previewPopupFits('), source.indexOf('function previewPopupSplitPreformatted(')) });
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
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

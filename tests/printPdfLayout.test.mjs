import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const appStyles = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');
const pdfSource = readFileSync(new URL('../mdpro/js/export/pdf-export.js', import.meta.url), 'utf8');
require('../mdpro/js/export/pdf-export.js');
const pdfExport = globalThis.PdfExport;

test('print output is a single full-width column with readable code', () => {
  assert.match(appStyles, /\.markdown-body pre\s*\{[^}]*font-weight:\s*600 !important/s);
  assert.match(appStyles, /#print-root \.markdown-body\s*\{[^}]*column-count:\s*1 !important/s);
  assert.match(appStyles, /#print-root pre code \*\s*\{[^}]*color:\s*#0f172a !important/s);
  assert.match(appStyles, /#print-root pre\s*\{[^}]*background:\s*#f1f5f9 !important/s);
  assert.match(appStyles, /#print-root table\s*\{[^}]*break-inside:\s*auto/s);
});

test('mobile print DOM remains mounted until the browser finishes printing', () => {
  const printFunction = appSource.slice(
    appSource.indexOf('function printPage()'),
    appSource.indexOf('\nfunction revokeObjectUrls')
  );
  assert.match(printFunction, /matchMedia\('print'\)/);
  assert.match(printFunction, /addEventListener\('afterprint', cleanup/);
  assert.doesNotMatch(printFunction, /setTimeout\(cleanup,\s*1000\)/);
  assert.match(printFunction, /setTimeout\(cleanup,\s*300000\)/);
});

test('PDF export unwraps pre-paginated A4 sheets and enforces one column', () => {
  assert.match(pdfSource, /querySelectorAll\(':scope > \.a4-sheet'\)/);
  assert.match(pdfSource, /querySelector\(':scope > \.a4-view-content'\)/);
  assert.match(pdfSource, /\.pdf-page-content\{[^']*column-count:1!important/);
  assert.match(pdfSource, /\.pdf-page-content pre code,\.pdf-page-content pre code \*\{[^']*font-weight:inherit!important/);
});

test('PDF preview fits an A4 page to narrow screens', () => {
  const narrowZoom = pdfExport.__test.previewFitZoom(360);
  assert.ok(narrowZoom > 0.4 && narrowZoom < 0.5);
  assert.equal(pdfExport.__test.previewFitZoom(1400), 0.75);
  assert.match(pdfSource, /<option value="fit" selected>화면 맞춤<\/option>/);
  assert.match(pdfSource, /zoom:var\(--pdf-preview-zoom,1\)/);
});

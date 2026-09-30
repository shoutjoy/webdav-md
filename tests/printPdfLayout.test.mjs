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

test('print output disables multi-column layout and keeps readable code', () => {
  assert.match(appStyles, /@page\s*\{\s*size:\s*A4 portrait;\s*margin:\s*15mm;/s);
  assert.match(appStyles, /\.markdown-body pre\s*\{[^}]*font-weight:\s*600 !important/s);
  assert.match(appStyles, /#print-root \.markdown-body\s*\{[^}]*column-count:\s*auto !important/s);
  assert.match(appStyles, /#print-root pre code \*\s*\{[^}]*color:\s*#0f172a !important/s);
  assert.match(appStyles, /#print-root pre\s*\{[^}]*background:\s*#f1f5f9 !important/s);
  assert.match(appStyles, /#print-root table\s*\{[^}]*break-inside:\s*auto/s);
  assert.match(appStyles, /#print-root \.a4-sheet\s*\{[^}]*width:\s*100% !important[^}]*height:\s*auto !important[^}]*overflow:\s*visible !important[^}]*column-count:\s*auto !important/s);
  assert.match(appStyles, /#print-root \.a4-view-content\s*\{[^}]*width:\s*100% !important[^}]*height:\s*auto !important[^}]*overflow:\s*visible !important[^}]*column-count:\s*auto !important/s);
  assert.match(appStyles, /#print-root \.a4-sheet:last-child\s*\{[^}]*page-break-after:\s*auto/s);
  assert.doesNotMatch(appStyles, /#print-root [^{]*\.a4-sheet[^{]*\{[^}]*height:\s*(?:210|297)mm !important/s);
});

test('mobile print DOM remains mounted until the browser finishes printing', () => {
  const printFunction = appSource.slice(
    appSource.indexOf('function printPage()'),
    appSource.indexOf('\nfunction revokeObjectUrls')
  );
  assert.match(printFunction, /await renderMarkdown\(\{ force: true \}\)/);
  assert.match(printFunction, /await waitForPrintLayout\(\)/);
  assert.match(printFunction, /classList\.add\('printing-active'\);\s*await waitForPrintLayout\(\)/s);
  assert.doesNotMatch(printFunction, /setTimeout\(async \(\) =>/);
  assert.match(printFunction, /matchMedia\('print'\)/);
  assert.match(printFunction, /addEventListener\('afterprint', cleanup/);
  assert.doesNotMatch(printFunction, /setTimeout\(cleanup,\s*1000\)/);
  assert.match(printFunction, /setTimeout\(cleanup,\s*300000\)/);
});

test('PDF export unwraps pre-paginated A4 sheets and enforces one column', () => {
  assert.match(pdfSource, /querySelectorAll\(':scope > \.a4-sheet'\)/);
  assert.match(pdfSource, /querySelector\(':scope > \.a4-view-content'\)/);
  assert.match(pdfSource, /\.pdf-page-content\{[^']*column-count:auto!important/);
  assert.match(pdfSource, /\.pdf-page-content pre code,\.pdf-page-content pre code \*\{[^']*font-weight:inherit!important/);
  assert.match(pdfSource, /classList\.contains\('a4-atomic-content'\)/);
  assert.match(pdfSource, /\.pdf-page-content \.a4-atomic-content\{[^']*max-height:none!important[^']*overflow:visible!important/);
});

test('PDF preview fits an A4 page to narrow screens', () => {
  const narrowZoom = pdfExport.__test.previewFitZoom(360);
  assert.ok(narrowZoom > 0.4 && narrowZoom < 0.5);
  assert.equal(pdfExport.__test.previewFitZoom(1400), 0.75);
  assert.match(pdfSource, /<option value="fit" selected>화면 맞춤<\/option>/);
  assert.match(pdfSource, /zoom:var\(--pdf-preview-zoom,1\)/);
});

test('PDF canvas clone converts Mermaid HTML labels to native SVG text', () => {
  const foreignObject = {
    textContent: 'fallback',
    querySelectorAll(selector) {
      assert.equal(selector, 'p');
      return [{ textContent: '  First node  ' }, { textContent: '' }, { textContent: 'Second node' }];
    }
  };
  assert.deepEqual(pdfExport.__test.mermaidLabelLines(foreignObject), ['First node', 'Second node']);
  assert.match(pdfSource, /querySelectorAll\('\.trt-mermaid-wrapper svg foreignObject'\)/);
  assert.match(pdfSource, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'text'\)/);
  assert.match(pdfSource, /replaceMermaidForeignObjectsWithSvgText\(clonedPreview\)/);
});

test('PDF save confirms, reports progress, and supports cancellation', () => {
  assert.equal(pdfExport.__test.clampPdfProgress(-20), 0);
  assert.equal(pdfExport.__test.clampPdfProgress(51.6), 52);
  assert.equal(pdfExport.__test.clampPdfProgress(140), 100);
  assert.match(pdfSource, /data-pdf-confirm hidden role="dialog"/);
  assert.match(pdfSource, /id="pdf-export-confirm-title">PDF로 변환하겠습니다\.<\/h3>/);
  assert.match(pdfSource, /data-pdf-confirm-ok>확인<\/button>/);
  assert.match(pdfSource, /data-pdf-progress-track[^>]*role="progressbar"/);
  assert.match(pdfSource, /data-pdf-progress-value>0%/);
  assert.match(pdfSource, /data-pdf-cancel>중지<\/button>/);
  assert.match(pdfSource, /state\.exportJob\.cancelled = true/);
  assert.match(pdfSource, /throwIfPdfCancelled\(job\)/);
  assert.match(pdfSource, /updatePdfProgress\(state, 100, 'PDF 파일을 저장하고 있습니다…'\)/);
});

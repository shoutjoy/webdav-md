import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function getEmbeddedHtmlDocumentCode(');
const end = source.indexOf('function hydrateEmbeddedHtmlPreviews(', start);
const context = { window: {} };
vm.runInNewContext(source.slice(start, end), context);

test('recognizes only complete HTML documents inside code blocks', () => {
    const complete = '<!DOCTYPE html><html lang="ko"><head></head><body>ok</body></html>';
    assert.equal(context.getEmbeddedHtmlDocumentCode({ textContent: complete }), complete);
    assert.equal(context.getEmbeddedHtmlDocumentCode({ textContent: '<div>fragment</div>' }), null);
    assert.equal(context.getEmbeddedHtmlDocumentCode({ textContent: '<html><body>unfinished' }), null);
});

test('accepts a complete document beginning with the html element', () => {
    const complete = '  <html><body>hello</body></html>  ';
    assert.equal(context.getEmbeddedHtmlDocumentCode({ textContent: complete }), complete.trim());
    assert.equal(context.getEmbeddedHtmlDocumentCode(null), null);
});

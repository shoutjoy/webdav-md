import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const bridgeSource = fs.readFileSync(new URL('../mdpro/js/webdav-host-bridge.js', import.meta.url), 'utf8');
const renderableStart = source.indexOf('function getRenderableHtmlDocument(');
const renderableEnd = source.indexOf('function setHtmlDocumentMode(', renderableStart);
const renderableContext = {
    window: {},
    isEditMode: true,
    toggleMode(mode, options) {
        renderableContext.lastMode = { mode, options };
    },
    renderMarkdown(options) {
        renderableContext.lastRender = options;
    }
};
vm.runInNewContext(source.slice(renderableStart, renderableEnd), renderableContext);
const start = source.indexOf('function getEmbeddedHtmlDocumentCode(');
const end = source.indexOf('function hydrateEmbeddedHtmlPreviews(', start);
const context = { window: {} };
vm.runInNewContext(source.slice(start, end), context);

test('recognizes complete HTML documents even when they are opened as text files', () => {
    const complete = '<!doctype html><html lang="ko"><head></head><body>player</body></html>';
    assert.equal(renderableContext.getRenderableHtmlDocument(complete, '붙여넣은 텍스트.txt'), complete);
    assert.equal(renderableContext.getRenderableHtmlDocument('plain text', 'notes.txt'), null);
});

test('opens detected HTML documents in rendered view mode', () => {
    const complete = '<!doctype html><html><body>preview</body></html>';
    renderableContext.lastMode = null;
    assert.equal(renderableContext.openRenderableHtmlDocumentInView(complete, 'preview.txt'), true);
    assert.equal(renderableContext.lastMode?.mode, 'view');
    assert.equal(renderableContext.lastMode?.options?.skipScrollSync, true);

    renderableContext.lastMode = null;
    assert.equal(renderableContext.openRenderableHtmlDocumentInView('# Markdown', 'notes.md'), false);
    assert.equal(renderableContext.lastMode, null);
});

test('WebDAV embedded startup preserves rendered HTML view mode', () => {
    assert.match(bridgeSource, /getRenderableHtmlDocument\(currentDocumentText\(\), hostDocument\.fileName\)/);
    assert.match(bridgeSource, /if \(!rendersAsHtml && editButton/);
});

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

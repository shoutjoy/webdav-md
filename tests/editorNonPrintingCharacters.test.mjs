import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mdCommentSource = readFileSync(new URL('../mdpro/js/md-comment.js', import.meta.url), 'utf8');
const mdCommentModule = { exports: {} };
vm.runInNewContext(mdCommentSource, { module: mdCommentModule, exports: mdCommentModule.exports });
const MDComment = mdCommentModule.exports;
const page = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const style = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');
const codeMirror = readFileSync(new URL('../mdpro/js/editor/codemirror-prototype.mjs', import.meta.url), 'utf8');
const a4Pages = readFileSync(new URL('../mdpro/js/a4-pages.js', import.meta.url), 'utf8');
const a4Style = readFileSync(new URL('../mdpro/css/a4-pages.css', import.meta.url), 'utf8');

test('editor toolbar exposes a pressed-state non-printing character toggle', () => {
    assert.match(page, /id="btn-toggle-nonprinting"/);
    assert.match(page, /onclick="toggleNonPrintingCharacters\(\)"/);
    assert.match(page, /aria-pressed="false"/);
    assert.match(page, /Ctrl\+Shift\+P/);
});

test('mirror markup preserves source whitespace while adding visual markers', () => {
    const source = 'alpha beta\tgamma\nnext';
    const markup = MDComment.createHighlightMarkup(source, { showNonPrinting: true });

    assert.match(markup, /md-nonprinting-space"> <\/span>/);
    assert.match(markup, /md-nonprinting-tab">\t<\/span>/);
    assert.match(markup, /md-nonprinting-newline"><\/span>\n/);
    assert.equal((markup.match(/md-nonprinting-newline/g) || []).length, 2);
    assert.equal(markup.replace(/<span class="md-nonprinting-space"> <\/span>/g, ' ')
        .replace(/<span class="md-nonprinting-tab">\t<\/span>/g, '\t')
        .replace(/<span class="md-nonprinting-newline"><\/span>/g, ''), source);
});

test('non-printing markers compose with comment highlighting', () => {
    const markup = MDComment.createHighlightMarkup('a <!-- x y -->\n', { showNonPrinting: true });
    assert.match(markup, /class="md-editor-comment"/);
    assert.match(markup, /md-editor-comment">[\s\S]*md-nonprinting-space/);
    assert.match(markup, /md-nonprinting-newline/);
});

test('textarea and optional CodeMirror editor both style non-printing markers', () => {
    assert.match(style, /#viewer-edit-highlight \.md-nonprinting-space::after/);
    assert.match(style, /#btn-toggle-nonprinting\.is-active/);
    assert.match(codeMirror, /const nonPrintingDecorations = StateField\.define/);
    assert.match(codeMirror, /setNonPrintingCharacters/);
    assert.match(codeMirror, /cm-nonprinting-newline/);
    assert.match(codeMirror, /side: -1/);
});

test('A4 edit pages receive synchronized non-printing marker layers', () => {
    assert.match(a4Pages, /nonPrintingLayer\.className = 'a4-nonprinting-layer'/);
    assert.match(a4Pages, /window\.addEventListener\?\.\('mdpro:nonprinting-change', refreshAllNonPrintingPages\)/);
    assert.match(a4Pages, /refreshPageNonPrinting\(page\)/);
    assert.match(a4Style, /\.a4-nonprinting-layer\s*\{/);
    assert.match(a4Style, /\.a4-nonprinting-layer \.md-nonprinting-space::after/);
});

test('A4 editing exposes its active textarea to toolbar list commands', () => {
    assert.match(a4Pages, /function getActiveInput\(\)/);
    assert.match(a4Pages, /activeEditInput = input/);
    assert.match(a4Pages, /fitLongDocumentToContent, getActiveInput/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileCss = readFileSync(new URL('../mdpro/MobileUI/mobile-ui.css', import.meta.url), 'utf8');
const pageCss = readFileSync(new URL('../mdpro/css/a4-pages.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const cm6Js = readFileSync(new URL('../mdpro/js/editor/codemirror-prototype.mjs', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('continuous editing hides the inner textarea scrollbar and keeps the viewport scrollable', () => {
    assert.match(pageCss, /#content-viewport\.long-document-active #viewer-edit-ta\s*\{[^}]*overflow-y:\s*hidden\s*!important[^}]*scrollbar-width:\s*none/s);
    assert.match(pageCss, /#content-viewport\.long-document-active #viewer-edit-ta::-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
    assert.match(pageCss, /\.long-document-active:not\(\.hidden\)\s*\{[^}]*overflow-y:\s*auto\s*!important/s);
});

test('continuous CodeMirror editing has no inner scroll and requests sheet fitting after changes', () => {
    assert.match(cm6Js, /#content-viewport\.long-document-active \.md-cm6-prototype \.cm-scroller\{overflow:visible;min-height:0\}/);
    assert.match(cm6Js, /#content-viewport\.long-document-active \.md-cm6-prototype\{overflow:visible\}/);
    assert.match(cm6Js, /update\.docChanged \|\| Math\.abs\(contentHeight - lastMeasuredContentHeight\) > 1[\s\S]*mdpro:editor-geometry-change/);
    assert.match(appJs, /codeMirrorPrototype: '\.\/js\/editor\/codemirror-prototype\.mjs\?v=20261021-data-image-fold-4'/);
});

test('empty editors show a non-persistent writing prompt in textarea and CodeMirror modes', () => {
    const indexHtml = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
    assert.match(indexHtml, /id="viewer-edit-ta"[\s\S]*placeholder="생각을 입력하세요"/);
    assert.match(cm6Js, /editorPlaceholder\(textarea\.getAttribute\('placeholder'\) \|\| '생각을 입력하세요'\)/);
});

test('CodeMirror does not mount a gutter over the document and keeps inline image data expandable', () => {
    assert.doesNotMatch(cm6Js, /\bGutterMarker\b|\bgutter\s*\(/);
    assert.doesNotMatch(cm6Js, /dataImageGutter|cm-data-image-gutter|cm-gutters/);
    assert.match(cm6Js, /className = 'cm-data-image-fold'/);
    assert.match(cm6Js, /button\.addEventListener\('mousedown',[\s\S]*event\.stopPropagation\(\)[\s\S]*view\.dispatch/);
});

test('CodeMirror folds the complete HTML image tag so duplicated image attributes do not remain visible', () => {
    assert.match(cm6Js, /const DATA_IMAGE_HTML_TAG_RE = \/<img\\b\[\^>\]\*>\/gi/);
    assert.match(cm6Js, /while \(\(tagMatch = DATA_IMAGE_HTML_TAG_RE\.exec\(source\)\)\)[\s\S]*\.range\(from, to\)/);
    assert.match(cm6Js, /coveredRanges\.some\(range => from >= range\.from && to <= range\.to\)/);
    assert.match(cm6Js, /selection\.from > from && selection\.from < to/);
    assert.match(cm6Js, /coveredRanges\.push\(\{ from, to \}\);[\s\S]*if \(selection\.from > from && selection\.from < to\) continue/);
});

test('the complete HTML image toggles as one unit without a nested src fold', () => {
    assert.match(cm6Js, /function collapseExpandedDataImageTag\(event, view\)/);
    assert.match(cm6Js, /view\.dispatch\(\{ selection: \{ anchor: tagTo \}/);
    assert.match(cm6Js, /EditorView\.domEventHandlers\(\{[\s\S]*mousedown: collapseExpandedDataImageTag/);
    assert.match(indexHtml, /dataImageFold=20261021-unified-toggle-1/);
    assert.match(serviceWorker, /webdav-viewer-v17-unified-data-image-fold/);
});

test('mobile continuous editor expands the sheet and keeps scrolling outside the textarea', () => {
    assert.match(mobileCss, /#content-viewport\.long-document-active\s*\{[^}]*overflow-y:\s*auto\s*!important/s);
    assert.match(mobileCss, /#content-viewport\.long-document-active #editor-doc-wrap\s*\{[^}]*height:\s*max-content[^}]*overflow:\s*visible/s);
    assert.match(mobileCss, /#content-viewport\.long-document-active #viewer-edit-ta\s*\{[^}]*overflow-y:\s*hidden/s);
});

test('document jump controls target the editing viewport on all long documents', () => {
    const targetSelection = appJs.slice(appJs.indexOf('function getActiveScrollTarget()'), appJs.indexOf('\nfunction consumeScrollJumpLongPressClick('));
    assert.match(targetSelection, /if \(a4UsesViewport \|\| longDocumentUsesViewport\) return viewport;/);
    assert.doesNotMatch(targetSelection, /mobileContinuousEditor|textareaHasVisibleScroller/);
});

test('mobile view mode stays inside the dynamic viewport and preserves its scroll tail', () => {
    assert.match(mobileCss, /@supports \(height:\s*100dvh\)\s*\{[\s\S]*body\.mobile-ui-active\s*\{[^}]*height:\s*100dvh/s);
    assert.match(mobileCss, /body\.mobile-ui-active #viewer-container\s*\{[^}]*min-height:\s*0[^}]*padding:[^}]*--mobile-ui-dock-height[^}]*overscroll-behavior-y:\s*contain[^}]*-webkit-overflow-scrolling:\s*touch/s);
});

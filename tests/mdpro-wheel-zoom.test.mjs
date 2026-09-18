import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');
const a4StyleSource = readFileSync(new URL('../mdpro/css/a4-pages.css', import.meta.url), 'utf8');
const a4Source = readFileSync(new URL('../mdpro/js/a4-pages.js', import.meta.url), 'utf8');
const codeMirrorSource = readFileSync(new URL('../mdpro/js/editor/codemirror-prototype.mjs', import.meta.url), 'utf8');
const binding = source.slice(
    source.indexOf('function bindWheelZoomShortcuts()'),
    source.indexOf('function insertLiteralAtCursor('),
);

function bindAndDispatch(overrides = {}, insideDocument = true) {
    const calls = [];
    const listeners = {};
    const target = {
        nodeType: 1,
        closest: selector => insideDocument && selector === '#viewer-container, #content-viewport' ? {} : null,
    };
    const document = {
        addEventListener: (name, listener, options) => {
            listeners[name] = listener;
            calls.push(['bound', name, options]);
        },
    };
    const window = {};
    vm.runInNewContext(`(function () { ${binding}; bindWheelZoomShortcuts(); })()`, {
        window,
        document,
        adjustPageScale: delta => calls.push(['page', delta]),
        adjustFontSize: delta => calls.push(['font', delta]),
    });
    const event = {
        target,
        deltaY: -100,
        altKey: true,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: () => calls.push(['prevented']),
        ...overrides,
    };
    listeners.wheel(event);
    return calls.filter(call => call[0] !== 'bound');
}

test('Alt+wheel resizes document text and prevents document scrolling', () => {
    assert.deepEqual(bindAndDispatch(), [['prevented'], ['font', 1]]);
    assert.deepEqual(bindAndDispatch({ deltaY: 100 }), [['prevented'], ['font', -1]]);
});

test('wheel zoom shortcuts only run inside the document viewport', () => {
    assert.deepEqual(bindAndDispatch({}, false), []);
});

test('Ctrl or Meta combinations remain available to the browser', () => {
    assert.deepEqual(bindAndDispatch({ ctrlKey: true }), []);
    assert.deepEqual(bindAndDispatch({ metaKey: true }), []);
});

test('every edit surface follows the shared document font-size variable', () => {
    assert.match(styleSource, /#viewer-edit-ta,[\s\S]*font-size:\s*var\(--md-app-font-size, 16px\)/);
    assert.match(a4StyleSource, /\.a4-text, #a4-measure \{[^}]*font-size:\s*var\(--md-app-font-size, 16px\)/);
    assert.match(codeMirrorSource, /\.md-cm6-prototype\{[^}]*font-size:var\(--md-app-font-size,16px\)/);
});

test('A4 pagination is refreshed after a document font-size change', () => {
    assert.match(source, /dispatchEvent\(new CustomEvent\('mdpro:font-size-change'/);
    assert.match(a4Source, /addEventListener\?\.\('mdpro:font-size-change',[\s\S]*render\(caret\)/);
});

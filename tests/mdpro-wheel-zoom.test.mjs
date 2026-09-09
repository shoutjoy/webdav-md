import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
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

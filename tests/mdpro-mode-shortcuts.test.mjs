import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const shortcuts = source.slice(source.indexOf('// Ctrl + 1 for Edit mode'), source.indexOf('// Alt + 4 for toggling dark/light mode'));

function dispatch(overrides, isEditMode) {
    const calls = [];
    const e = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '1', code: 'Digit1', preventDefault: () => calls.push('preventDefault'), ...overrides };
    vm.runInNewContext(`(function () { ${shortcuts} })()`, { e, isEditMode, toggleMode: mode => calls.push(mode) });
    return calls;
}

test('Ctrl+1 enters edit and Ctrl+2 enters view', () => {
    assert.deepEqual(dispatch({ ctrlKey: true }, false), ['preventDefault', 'edit']);
    assert.deepEqual(dispatch({ ctrlKey: true, key: '2', code: 'Digit2' }, true), ['preventDefault', 'view']);
});

test('current mode is not toggled again', () => {
    assert.deepEqual(dispatch({ ctrlKey: true }, true), ['preventDefault']);
    assert.deepEqual(dispatch({ ctrlKey: true, key: '2', code: 'Digit2' }, false), ['preventDefault']);
});

test('old Alt shortcuts and extra modifiers do not switch modes', () => {
    for (const digit of ['1', '2']) {
        for (const modifiers of [{ altKey: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, shiftKey: true }, { ctrlKey: true, metaKey: true }, {}]) {
            assert.deepEqual(dispatch({ ...modifiers, key: digit, code: `Digit${digit}` }, digit === '2'), []);
        }
    }
});

test('mode button hints match shortcuts', () => {
    const html = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
    assert.match(html, /id="btn-edit" title="Ctrl\+1" aria-keyshortcuts="Control\+1"/);
    assert.match(html, /id="btn-view" title="Ctrl\+2" aria-keyshortcuts="Control\+2"/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const initSource = source.slice(
    source.indexOf('function initEditorShiftFloat(control)'),
    source.indexOf('function syncEditorShiftFloatPosition()'),
);

function makeClassList() {
    const values = new Set();
    return {
        toggle(name, enabled) { enabled ? values.add(name) : values.delete(name); },
        contains(name) { return values.has(name); },
    };
}

test('orientation button toggles every floating-bar control between a row and a column', () => {
    const listeners = {};
    const attrs = {};
    const toggle = {
        textContent: '',
        title: '',
        setAttribute(name, value) { attrs[name] = value; },
        addEventListener(name, listener) { listeners[name] = listener; },
    };
    const drag = { addEventListener() {} };
    const control = {
        dataset: {},
        classList: makeClassList(),
        querySelector(selector) {
            if (selector === '.editor-shift-orientation') return toggle;
            if (selector === '.editor-shift-drag') return drag;
            return null;
        },
    };
    const context = vm.createContext({
        control,
        window: { addEventListener() {}, removeEventListener() {} },
        editorShiftFloatPreferences: {},
        saveEditorShiftFloatPreferences() {},
        syncEditorShiftFloatPosition() {},
    });
    vm.runInContext(`${initSource}\ninitEditorShiftFloat(control);`, context);

    assert.equal(control.dataset.orientation, 'vertical');
    assert.equal(control.classList.contains('is-vertical'), true);
    assert.equal(toggle.textContent, '↔');
    assert.equal(attrs['aria-pressed'], 'true');

    listeners.click();
    assert.equal(control.dataset.orientation, 'horizontal');
    assert.equal(control.classList.contains('is-horizontal'), true);
    assert.equal(toggle.textContent, '↕');
    assert.equal(attrs['aria-label'], '세로 메뉴로 전환');
    assert.equal(attrs['aria-pressed'], 'false');

    listeners.click();
    assert.equal(control.dataset.orientation, 'vertical');
    assert.equal(control.classList.contains('is-vertical'), true);
});

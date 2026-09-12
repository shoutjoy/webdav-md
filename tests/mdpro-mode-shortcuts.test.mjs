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

test('edit to view mode restores the editor viewport instead of the caret position', () => {
    const toggleStart = source.indexOf('function toggleMode(mode)');
    const toggleEnd = source.indexOf('\nconst DEDICATED_LOCAL_VIEWER_EXTENSIONS', toggleStart);
    const toggleSource = source.slice(toggleStart, toggleEnd);
    const captureIndex = toggleSource.indexOf('const editScrollTarget = getActiveScrollTarget()');
    const hideIndex = toggleSource.indexOf("ec.classList.add('hidden')", captureIndex);

    assert.ok(captureIndex >= 0, 'editor scroll ratio should be captured');
    assert.ok(hideIndex > captureIndex, 'editor scroll ratio must be captured before the editor is hidden');
    assert.match(toggleSource, /getScrollRatio\(editScrollTarget\)/);
    assert.match(toggleSource, /setScrollRatio\(vc, editScrollRatio\)/);
    assert.doesNotMatch(toggleSource, /setScrollRatio\(vc, ratioFromCaret\)/);
});

test('heading shortcuts cover Ctrl+Alt+1 through Ctrl+Alt+5', () => {
    const handlerStart = source.indexOf('// Ctrl + Alt + 1, 2, 3, 4, 5 for Headings');
    const handlerEnd = source.indexOf('// Ctrl + 1 for Edit mode', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);
    assert.match(handler, /getHeadingShortcutLevel\(e\)/);

    const helperStart = source.indexOf('function getHeadingShortcutLevel(event)');
    const helperEnd = source.indexOf('\nfunction applyHeading(level)', helperStart);
    const helperSource = source.slice(helperStart, helperEnd);
    const context = {};
    vm.runInNewContext(`${helperSource}; this.getHeadingShortcutLevel = getHeadingShortcutLevel;`, context);
    for (let level = 1; level <= 5; level += 1) {
        assert.equal(context.getHeadingShortcutLevel({ ctrlKey: true, altKey: true, shiftKey: false, metaKey: false, code: `Digit${level}`, key: '' }), level);
    }
    assert.equal(context.getHeadingShortcutLevel({ ctrlKey: true, altKey: true, shiftKey: true, metaKey: false, code: 'Digit1' }), 0);
});

test('heading application enters edit mode when invoked from preview', () => {
    const applyStart = source.indexOf('function applyHeading(level)');
    const applyEnd = source.indexOf('\nfunction handleTableInsertion()', applyStart);
    const applySource = source.slice(applyStart, applyEnd);
    assert.match(applySource, /if \(!isEditMode\) toggleMode\('edit'\)/);
});

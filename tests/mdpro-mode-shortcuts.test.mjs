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

test('edit and view modes prioritize the visible caret and fall back to the viewport', () => {
    const toggleStart = source.indexOf('function toggleMode(mode, options)');
    const toggleEnd = source.indexOf('\nconst DEDICATED_LOCAL_VIEWER_EXTENSIONS', toggleStart);
    const toggleSource = source.slice(toggleStart, toggleEnd);
    const captureIndex = toggleSource.indexOf('const editScrollTarget = getActiveScrollTarget()');
    const hideIndex = toggleSource.indexOf("ec.classList.add('hidden')", captureIndex);

    assert.ok(captureIndex >= 0, 'editor scroll ratio should be captured');
    assert.ok(hideIndex > captureIndex, 'editor scroll ratio must be captured before the editor is hidden');
    assert.match(toggleSource, /getMarkdownLineFromEditorViewport\(editScrollTarget\)/);
    assert.match(toggleSource, /const visibleCaret = getVisibleEditorCaret\(editScrollTarget\)/);
    assert.match(toggleSource, /scrollViewerToMarkdownLine\(vc, editLineIndex, visibleCaret\)/);
    assert.match(toggleSource, /getMarkdownLineFromViewerViewport\(vc\)/);
    assert.match(toggleSource, /scrollEditorToMarkdownLine\(mappedLine, 'auto'\)/);
    assert.doesNotMatch(toggleSource, /restoreLastClickedTocPosition\(\)/);
});

test('CodeMirror caret is used only while it is visible in the editor viewport', () => {
    const start = source.indexOf('function getVisibleEditorCaret(scrollTarget)');
    const end = source.indexOf('\nfunction normalizeMarkdownLineForView(', start);
    const view = {
        state: { selection: { main: { head: 42 } } },
        coordsAtPos() { return { top: 180, bottom: 200 }; }
    };
    const context = {
        editorTextarea: { __mdCm6View: view },
        document: {},
        viewport: { getBoundingClientRect() { return { top: 100, bottom: 500 }; } }
    };
    vm.runInNewContext(`${source.slice(start, end)}; this.getCaret = getVisibleEditorCaret;`, context);
    assert.deepEqual({ ...context.getCaret(context.viewport) }, { position: 42, viewportOffset: 80 });
    view.coordsAtPos = () => ({ top: 900, bottom: 920 });
    assert.equal(context.getCaret(context.viewport), null);
});

test('view mode aligns the rendered paragraph to the same screen offset as the edit caret', () => {
    const matcherStart = source.indexOf('function normalizeMarkdownLineForView(line)');
    const matcherEnd = source.indexOf('\nfunction getMarkdownLineFromViewerViewport(', matcherStart);
    const scrollStart = source.indexOf('function scrollViewerToMarkdownLine(container, lineIndex, caret)');
    const scrollEnd = source.indexOf('\nfunction clampViewCopyFabPosition(', scrollStart);
    const paragraph = {
        textContent: 'Target paragraph',
        querySelectorAll() { return []; },
        getBoundingClientRect() { return { top: 700 }; }
    };
    const context = {
        viewer: { querySelectorAll() { return [paragraph]; } },
        editorTextarea: { value: '# First\n\nTarget paragraph\n\n# Last' },
        clamp01: value => Math.max(0, Math.min(1, value))
    };
    const container = {
        scrollTop: 300, scrollHeight: 2000, clientHeight: 400,
        getBoundingClientRect() { return { top: 100 }; }
    };
    vm.runInNewContext(`${source.slice(matcherStart, matcherEnd)}\n${source.slice(scrollStart, scrollEnd)}; this.scroll = scrollViewerToMarkdownLine;`, context);
    context.scroll(container, 2, { position: 10, viewportOffset: 150 });
    assert.equal(container.scrollTop, 750);
});

test('holding a document jump button for 1.5 seconds targets the current document', () => {
    const bindStart = source.indexOf('function bindScrollJumpLongPress()');
    const bindEnd = source.indexOf('\nfunction scrollToDocumentTop(', bindStart);
    const bindSource = source.slice(bindStart, bindEnd);
    const html = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

    assert.match(bindSource, /setTimeout\(function \(\) \{/);
    assert.match(bindSource, /}, 1500\)/);
    assert.match(bindSource, /scrollCurrentDocumentBoundary\(button\.dataset\.scrollJump, 'instant'\)/);
    assert.match(html, /data-scroll-jump="top"/);
    assert.match(html, /data-scroll-jump="bottom"/);
});

test('click and hold move only the visible mode document without switching modes', () => {
    const start = source.indexOf('function scrollCurrentDocumentBoundary(direction, behavior');
    const end = source.indexOf('\nfunction bindScrollJumpLongPress()', start);
    const editor = { scrollHeight: 1800, clientHeight: 600, scrollTop: 350, scrollTo({ top }) { this.scrollTop = top; } };
    const viewer = { scrollHeight: 3000, clientHeight: 600, scrollTop: 250, scrollTo({ top }) { this.scrollTop = top; } };
    let mode = 'view';
    const context = {
        getActiveScrollTarget() { return mode === 'edit' ? editor : viewer; }
    };
    vm.runInNewContext(`${source.slice(start, end)}; this.jump = scrollCurrentDocumentBoundary;`, context);

    context.jump('bottom', 'instant');
    assert.equal(viewer.scrollTop, 2400);
    assert.equal(editor.scrollTop, 350, 'holding in View mode must not move Edit');
    assert.equal(mode, 'view');
    context.jump('top');
    assert.equal(viewer.scrollTop, 0);
    mode = 'edit';
    context.jump('bottom', 'instant');
    assert.equal(editor.scrollTop, 1200);
    assert.equal(viewer.scrollTop, 0, 'holding in Edit mode must not move View');
    context.jump('top');
    assert.equal(editor.scrollTop, 0);
});

test('mouse hold fires after 1.5 seconds and suppresses its release click', () => {
    const start = source.indexOf('function consumeScrollJumpLongPressClick(event)');
    const end = source.indexOf('\nfunction scrollCurrentDocumentBoundary(', start);
    const bindStart = source.indexOf('function bindScrollJumpLongPress()');
    const bindEnd = source.indexOf('\nfunction scrollToDocumentTop(', bindStart);
    const handlers = {};
    const button = {
        dataset: { scrollJump: 'bottom' },
        addEventListener(name, listener) { handlers[name] = listener; }
    };
    let pending;
    const jumps = [];
    const context = {
        document: { querySelectorAll() { return [button]; } },
        window: {
            setTimeout(callback, delay) { pending = { callback, delay }; return 1; },
            clearTimeout() { pending = undefined; }
        },
        scrollCurrentDocumentBoundary(direction) { jumps.push(direction); }
    };
    vm.runInNewContext(`${source.slice(start, end)}\n${source.slice(bindStart, bindEnd)}; this.bind = bindScrollJumpLongPress; this.consume = consumeScrollJumpLongPressClick;`, context);
    context.bind();
    handlers.pointerdown({ button: 0 });
    assert.equal(pending.delay, 1500);
    handlers.pointerup();
    assert.equal(pending, undefined);
    assert.deepEqual(jumps, [], 'short click must not trigger editor jump');

    handlers.pointerdown({ button: 0 });
    pending.callback();
    handlers.pointerup();
    assert.deepEqual(jumps, ['bottom']);
    let prevented = false;
    assert.equal(context.consume({ currentTarget: button, preventDefault() { prevented = true; } }), true);
    assert.equal(prevented, true);
    assert.equal(context.consume({ currentTarget: button }), false, 'only the release click is suppressed');
});

test('document jump buttons use the editing viewport for continuous and A4 documents', () => {
    const helperStart = source.indexOf('function getActiveScrollTarget()');
    const helperEnd = source.indexOf('\nfunction scrollToDocumentTop(', helperStart);
    const helperSource = source.slice(helperStart, helperEnd);

    assert.match(helperSource, /syncEditModeStateFromDom\(\)/);
    assert.match(helperSource, /if \(a4UsesViewport \|\| longDocumentUsesViewport\) return viewport;/);
    assert.match(helperSource, /if \(viewerContainer\) return viewerContainer;/);
    assert.match(helperSource, /const target = getActiveScrollTarget\(\);/);
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

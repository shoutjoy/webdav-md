import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const follow = source.slice(source.indexOf('let realtimeDocFollowFrame = 0;'), source.indexOf('function applyRealtimeDocText(text)'));

test('stream following uses visible CodeMirror coordinates without resizing the sheet', () => {
    const frames = [];
    const viewport = {
        classList: { contains: () => true }, clientHeight: 500, scrollTop: 0,
        getBoundingClientRect: () => ({ top: 100 })
    };
    const editor = {
        style: { height: '900px' }, scrollTop: 12,
        get scrollHeight() { throw new Error('hidden source must not determine sheet height'); },
        __mdCm6View: {
            state: { doc: { length: 100 } },
            coordsAtPos(pos) { assert.equal(pos, 80); return { top: 650, bottom: 674 }; }
        }
    };
    const context = vm.createContext({
        editorTextarea: editor, isEditMode: true,
        document: { getElementById: () => viewport },
        requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
        cancelAnimationFrame() {}
    });
    vm.runInContext(follow, context);
    context.followRealtimeDocCaret(80);
    while (frames.length) frames.shift()();
    assert.equal(viewport.scrollTop, 190);
    assert.equal(editor.style.height, '900px');
    assert.equal(editor.scrollTop, 0);
});

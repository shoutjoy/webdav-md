import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const editorShell = readFileSync(new URL('../src/components/MdproEditor.jsx', import.meta.url), 'utf8');

const editStart = source.indexOf('function getCopyLineDownEdit(');
const editEnd = source.indexOf('\n\nwindow.openFindReplace', editStart);
const editContext = {};
vm.runInNewContext(`${source.slice(editStart, editEnd)}; this.getEdit = getCopyLineDownEdit;`, editContext);

function duplicate(value, selectionStart, selectionEnd = selectionStart) {
  const edit = editContext.getEdit(value, selectionStart, selectionEnd);
  return {
    value: value.slice(0, edit.insertAt) + edit.insertText + value.slice(edit.insertAt),
    selectionStart: edit.selectionStart,
    selectionEnd: edit.selectionEnd
  };
}

test('Shift+Alt+ArrowDown duplicates one line and keeps the caret column', () => {
  assert.deepEqual(duplicate('alpha\nbeta\ngamma', 8), {
    value: 'alpha\nbeta\nbeta\ngamma',
    selectionStart: 13,
    selectionEnd: 13
  });
});

test('selected lines are duplicated once below and the copied selection stays selected', () => {
  assert.deepEqual(duplicate('zero\none\ntwo\nthree', 5, 12), {
    value: 'zero\none\ntwo\none\ntwo\nthree',
    selectionStart: 13,
    selectionEnd: 20
  });
});

test('selection ending at the next line start does not duplicate that next line', () => {
  assert.deepEqual(duplicate('one\ntwo\nthree', 0, 4), {
    value: 'one\none\ntwo\nthree',
    selectionStart: 4,
    selectionEnd: 8
  });
});

test('last line duplication inserts content instead of an extra blank line', () => {
  assert.deepEqual(duplicate('one\ntwo', 5), {
    value: 'one\ntwo\ntwo',
    selectionStart: 9,
    selectionEnd: 9
  });
});

test('editor capture handler consumes the shortcut before CodeMirror handles it again', () => {
  const handlers = {};
  const inputRoot = {
    addEventListener(type, handler) { handlers[type] = handler; }
  };
  const editorTextarea = { parentElement: inputRoot };
  let copies = 0;
  const bindStart = source.indexOf('function bindEditorListKeyBehavior()');
  const bindEnd = source.indexOf('\nfunction bindWheelZoomShortcuts()', bindStart);
  const context = {
    editorTextarea,
    copyLineDown() { copies += 1; },
    handleEditorListEnterKey() { return false; },
    handleEditorListTabKey() { return false; },
    insertLiteralAtCursor() {}
  };
  vm.runInNewContext(`${source.slice(bindStart, bindEnd)}; this.bind = bindEditorListKeyBehavior;`, context);
  context.bind();

  const calls = [];
  handlers.keydown({
    target: editorTextarea,
    key: 'ArrowDown',
    code: 'ArrowDown',
    shiftKey: true,
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    isComposing: false,
    preventDefault() { calls.push('preventDefault'); },
    stopPropagation() { calls.push('stopPropagation'); }
  });

  assert.equal(copies, 1);
  assert.deepEqual(calls, ['preventDefault', 'stopPropagation']);
});

test('line-copy fix is cache-busted in the embedded editor', () => {
  assert.match(markup, /app\.js[^"\n]*lineCopy=20260922-1/);
  assert.match(editorShell, /MDPRO_URL[^\n]*lineCopy=20260922-1/);
});

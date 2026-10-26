import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../mdpro/js/Imagetool/link-image-modal.js', import.meta.url), 'utf8');
const extract = (name, next) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(`\nfunction ${next}(`));

function harness(cm, shared) {
  let text = 'before\nselected\nafter';
  const textarea = {
    selectionStart: 7, selectionEnd: 15, scrollTop: 42,
    get value() { return text; },
    set value(value) { text = value; },
    focus() {},
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    setRangeText(value, start, end) { text = text.slice(0, start) + value + text.slice(end); }
  };
  const edits = [];
  if (cm) textarea.__mdCm6View = {
    dispatch(edit) {
      edits.push(edit);
      const { from, to, insert } = edit.changes;
      text = text.slice(0, from) + insert + text.slice(to);
      textarea.setSelectionRange(edit.selection.anchor, edit.selection.anchor);
    }
  };
  const fields = {
    'input-display-text': { value: 'kge_분석요청 241120_arrange_report_v5.2.pdf' },
    'input-url': { value: 'kge_분석요청 241120_arrange_report_v5.2.pdf' },
    'input-link-new-window': { checked: true }
  };
  const context = {
    window: {}, editorTextarea: textarea, currentMarkdown: text,
    activeSidebarTab: '', performAutoSave() {}, renderTOC() {},
    document: {
      getElementById(id) { return fields[id] || null; },
      execCommand() { throw new Error('Native DOM insertion must not be used'); }
    }
  };
  vm.createContext(context);
  vm.runInContext(modal, context);
  vm.runInContext(extract('replaceEditorSelectionText', 'insertAtCursor'), context);
  vm.runInContext(extract('moveLineUp', 'moveLineDown') + extract('moveLineDown', 'copyLineDown'), context);
  const deps = {
    editorTextarea: textarea,
    getMode: () => 'link',
    onInserted(value) { context.currentMarkdown = value; }
  };
  if (shared) deps.replaceSelectionText = context.replaceEditorSelectionText;
  return { context, textarea, edits, fields, deps };
}

for (const [cm, shared, label] of [[true, true, 'app CodeMirror'], [false, true, 'app textarea'], [true, false, 'standalone CodeMirror'], [false, false, 'standalone textarea']]) {
  test(`${label}: inserted HTML link survives repeated line moves in both directions`, () => {
    const h = harness(cm, shared);
    const link = h.context.window.LinkImageModal.confirm(h.deps);
    const expected = `before\n${link}\nafter`;
    assert.match(link, /<a href="kge_분석요청 .*" target="_blank">/);
    assert.equal(h.textarea.value, expected);
    assert.equal(h.context.currentMarkdown, expected);
    assert.equal(h.textarea.scrollTop, 42);
    for (let i = 0; i < 4; i++) {
      h.context.moveLineDown();
      assert.equal(h.textarea.value, `before\nafter\n${link}`);
      h.context.moveLineUp();
      assert.equal(h.textarea.value, expected);
      assert.equal(h.context.currentMarkdown, expected);
    }
    if (cm) assert.equal(h.edits[0].userEvent, 'input');
  });
}

for (const mode of ['link', 'image', 'id']) {
  test(`${mode}: shared insertion preserves source and selected replacement`, () => {
    const h = harness(true, true);
    h.fields['input-link-new-window'].checked = false;
    h.deps.getMode = () => mode;
    const inserted = h.context.window.LinkImageModal.confirm(h.deps);
    assert.equal(h.textarea.value, `before\n${inserted}\nafter`);
    assert.ok(inserted.startsWith(mode === 'link' ? '[' : mode === 'image' ? '![' : '<div id'));
    assert.equal(h.textarea.selectionStart, 7 + inserted.length);
  });
}

test('app passes the shared document insertion function to the modal', () => {
  assert.match(extract('confirmModalInsert', 'adjustPageScale'), /replaceSelectionText: replaceEditorSelectionText/);
});

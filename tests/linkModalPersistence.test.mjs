import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import MarkdownIt from 'markdown-it';
import { saveFileVerified } from '../src/webdavMoveEngine.js';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../mdpro/js/Imagetool/link-image-modal.js', import.meta.url), 'utf8');
const extract = (name, next) => app.slice(app.indexOf(`function ${name}(`), app.indexOf(`\nfunction ${next}(`));

function harness(cm, shared) {
  let text = 'before\nselected\nafter';
  const notifications = [];
  const textarea = {
    selectionStart: 7, selectionEnd: 15, scrollTop: 42,
    get value() { return text; },
    set value(value) { text = value; },
    focus() {},
    dispatchEvent(event) { notifications.push({ type: event.type, bubbles: event.bubbles, content: text }); },
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
    Event,
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
  return { context, textarea, edits, fields, deps, notifications };
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

for (const cm of [true, false]) {
  test(`${cm ? 'CodeMirror' : 'textarea'} publishes inserted source immediately before save, then reloads verified bytes`, async () => {
    const h = harness(cm, true);
    const inserted = h.context.window.LinkImageModal.confirm(h.deps);
    assert.equal(h.notifications.length, 1);
    assert.equal(h.notifications[0].type, 'input');
    assert.equal(h.notifications[0].bubbles, true);
    assert.equal(h.notifications[0].content, h.textarea.value);
    let savedBytes;
    const client = {
      async putFileContents(path, content) { savedBytes = new TextEncoder().encode(content); return true; },
      async getFileContents() { return new TextDecoder().decode(savedBytes); }
    };
    await saveFileVerified(client, '/link.md', h.notifications[0].content);
    const reopened = harness(cm, true);
    reopened.textarea.value = await client.getFileContents();
    assert.equal(reopened.textarea.value, `before\n${inserted}\nafter`);
    const rendered = new MarkdownIt({ html: true }).render(reopened.textarea.value);
    assert.match(rendered, /href="kge_분석요청 241120_arrange_report_v5.2.pdf" target="_blank"/);
  });
}

test('autosave reads the current editor even when the input debounce has not fired', () => {
  const h = harness(true, true);
  vm.runInContext(extract('syncCurrentMarkdownFromEditor', 'markPersistedState'), h.context);
  vm.runInContext(extract('performAutoSave', 'setLiveRenderInEditMode'), h.context);
  h.context.db = null;
  h.context.currentMarkdown = 'stale source without link';
  h.textarea.value = '<a href="report.pdf" target="_blank">report.pdf</a>';
  h.context.performAutoSave();
  assert.equal(h.context.currentMarkdown, h.textarea.value);
});

test('ordinary file links with spaces remain clickable after save and Markdown reparse', () => {
  const h = harness(true, true);
  h.fields['input-link-new-window'].checked = false;
  const inserted = h.context.window.LinkImageModal.confirm(h.deps);
  assert.match(inserted, /kge_분석요청%20241120/);
  const rendered = new MarkdownIt().render(h.notifications[0].content);
  assert.match(rendered, /<a href="kge_/);
  assert.match(rendered, /%20241120_arrange_report_v5\.2.pdf/);
  assert.match(rendered, />kge_분석요청 241120_arrange_report_v5\.2.pdf<\/a>/);
});

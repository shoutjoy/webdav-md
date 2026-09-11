import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

async function createHarness(markdown, caret) {
  const source = await readFile(new URL('../mdpro/js/viewmode/viewmode-edit-input.js', import.meta.url), 'utf8');
  const listeners = {};
  const textarea = {
    value: markdown,
    setSelectionRange(start) { this.selectionStart = start; },
  };
  const viewport = { classList: { contains: value => value === 'hidden' } };
  const viewer = {
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener() {},
  };
  const elements = {
    viewer,
    'viewer-container': {},
    'viewer-edit-ta': textarea,
    'content-viewport': viewport,
    'view-mode-edit-enabled': { checked: true },
  };
  const document = {
    readyState: 'loading',
    body: { appendChild() {} },
    head: { appendChild() {} },
    addEventListener(name, callback) { listeners[name] = callback; },
    getElementById(id) { return elements[id] || null; },
    createElement() {
      return {
        value: '', style: {}, setAttribute() {}, addEventListener() {},
        focus() {}, blur() {},
      };
    },
  };
  const window = {
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { callback(); },
    updateContent(value) { textarea.value = value; },
    performAutoSave() {},
  };
  const context = { document, window, localStorage: { getItem: () => '1' }, MutationObserver: undefined };
  vm.runInNewContext(source, context);
  listeners.DOMContentLoaded();
  textarea.setSelectionRange(caret, caret);

  // A click in view mode normally establishes this internal caret position.
  context.window.ViewModeTextInput.insertTextAtCaret('');
  vm.runInNewContext('', context);
  return { api: window.ViewModeTextInput, textarea };
}

test('view-mode Enter continues a bullet list and Tab changes the new item to the child marker', async () => {
  const markdown = '- 항목';
  const { api, textarea } = await createHarness(markdown, markdown.length);

  // The view-mode caret defaults to the start; seed it by inserting and removing a harmless character.
  api.insertTextAtCaret(markdown);
  textarea.value = markdown;
  assert.equal(api.continueListAtCaret(), true);
  assert.equal(textarea.value, '- 항목\n- ');
  assert.equal(api.changeListDepthAtCaret(false), true);
  assert.equal(textarea.value, '- 항목\n  * ');
});

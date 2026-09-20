import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/trt/editorRule.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const editorShell = readFileSync(new URL('../src/components/MdproEditor.jsx', import.meta.url), 'utf8');

function createTextareaHarness(value = 'alpha', start = 0, end = value.length) {
  const textarea = {
    value,
    selectionStart: start,
    selectionEnd: end,
    scrollTop: 0,
    focus() { document.activeElement = this; },
    setSelectionRange(nextStart, nextEnd) {
      this.selectionStart = nextStart;
      this.selectionEnd = nextEnd;
    },
    setRangeText(replacement, from, to) {
      this.value = this.value.slice(0, from) + replacement + this.value.slice(to);
      this.selectionStart = this.selectionEnd = from + replacement.length;
    }
  };
  const document = { activeElement: textarea, execCommand() { return true; } };
  const window = {};
  vm.runInNewContext(source, { window, document });
  return { api: window.EditorRule, textarea, document };
}

function keyEvent(key) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefaultCalled: false,
    preventDefault() { this.preventDefaultCalled = true; }
  };
}

for (const [key, expected] of [
  ['`', '`alpha`'],
  ['$', '$alpha$'],
  ['"', '"alpha"'],
  ["'", "'alpha'"],
  ['(', '(alpha)'],
  ['<', '<alpha>'],
  ['[', '[alpha]']
]) {
  test(`textarea selection is wrapped by ${key}`, () => {
    const { api, textarea } = createTextareaHarness();
    const event = keyEvent(key);
    const handled = api.handleSelectionWrapByTypedPair(event, {
      selectionWrapEnabled: true,
      isEditMode: true,
      editorTextarea: textarea
    });

    assert.equal(handled, true);
    assert.equal(event.preventDefaultCalled, true);
    assert.equal(textarea.value, expected);
  });
}

test('multiline backtick selection becomes a fenced code block', () => {
  const { api, textarea } = createTextareaHarness('first\nsecond');
  api.handleSelectionWrapByTypedPair(keyEvent('`'), {
    selectionWrapEnabled: true,
    isEditMode: true,
    editorTextarea: textarea
  });
  assert.equal(textarea.value, '```\nfirst\nsecond\n```');
});

test('pressing dollar on an inline-math selection upgrades it to display math', () => {
  const { api, textarea } = createTextareaHarness('$alpha$');
  api.handleSelectionWrapByTypedPair(keyEvent('$'), {
    selectionWrapEnabled: true,
    isEditMode: true,
    editorTextarea: textarea
  });
  assert.equal(textarea.value, '$$alpha$$');
});

test('CodeMirror selection is replaced through its transaction API', () => {
  const { api, textarea, document } = createTextareaHarness();
  const transactions = [];
  textarea.__mdCm6View = {
    hasFocus: true,
    scrollDOM: { scrollTop: 27 },
    dispatch(transaction) {
      transactions.push(transaction);
      textarea.value = transaction.changes.insert;
      textarea.selectionStart = transaction.selection.anchor;
      textarea.selectionEnd = transaction.selection.head;
    },
    focus() {}
  };
  document.activeElement = null;

  const handled = api.handleSelectionWrapByTypedPair(keyEvent('['), {
    selectionWrapEnabled: true,
    isEditMode: true,
    editorTextarea: textarea
  });

  assert.equal(handled, true);
  assert.equal(textarea.value, '[alpha]');
  assert.deepEqual({ ...transactions[0].changes }, { from: 0, to: 5, insert: '[alpha]' });
  assert.deepEqual({ ...transactions[0].selection }, { anchor: 1, head: 6 });
  assert.equal(textarea.__mdCm6View.scrollDOM.scrollTop, 27);
});

test('selection-wrap assets are cache-busted in the active MDPRO iframe', () => {
  assert.match(markup, /editorRule\.js\?v=20260920-selection-wrap-1/);
  assert.match(editorShell, /MDPRO_URL[^\n]*selectionWrap=20260920-1/);
});

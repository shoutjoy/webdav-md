import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const streaming = source.slice(source.indexOf('function startRealtimeDocStream(options)'), source.indexOf('function getAIChatGeneratedImageDataUrl(image)'));

test('streamed answer updates the visible document before completion and retains surrounding text', () => {
  const frames = [];
  const painted = [];
  const editor = {
    value: 'BeforeAfter', selectionStart: 6, selectionEnd: 6,
    dispatchEvent(event) {
      if (event.type === 'input') painted.push(this.value);
    }
  };
  const context = vm.createContext({
    editorTextarea: editor, isEditMode: true, activeRealtimeDocStream: null,
    lastCapturedEditorSelection: null, currentMarkdown: editor.value, lastEditCaretPos: 6,
    pushReplaceUndoSnapshot() {}, requestAnimationFrame(fn) { frames.push(fn); },
    Event, performAutoSave() {}, activeSidebarTab: '', renderTOC() {}
  });
  vm.runInContext(streaming, context);
  // Caret layout is covered separately; this harness only paints input events.
  context.followRealtimeDocCaret = () => {};
  context.startRealtimeDocStream({ target: 'cursor' });
  painted.length = 0;
  context.writeRealtimeDocStreamChunk('First');
  context.writeRealtimeDocStreamChunk(' token');
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(painted, ['Before\n\nFirst tokenAfter']);
  assert.ok(context.activeRealtimeDocStream, 'answer is still being generated');
  context.writeRealtimeDocStreamChunk(' next');
  frames.shift()();
  assert.equal(painted.at(-1), 'Before\n\nFirst token nextAfter');
  context.finishRealtimeDocStream('First token next');
  assert.equal(editor.value, 'Before\n\nFirst token nextAfter');
  assert.equal(context.activeRealtimeDocStream, null);
});

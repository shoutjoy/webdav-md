import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = app.indexOf("window.addEventListener('message', function (event) {", app.indexOf('function insertMermaidBlockFromExternal'));
const bridge = app.slice(start, app.indexOf('function applyTextStyleToSelection()', start));
function setup() {
  const frame = {}; const calls = []; let listener;
  const context = {
    window: { addEventListener: (_, fn) => { listener = fn; } },
    document: { getElementById: () => ({ contentWindow: frame }) },
    insertMermaidBlockFromExternal: code => calls.push(['insert', code]),
    closeMermaidEditorModal: () => calls.push(['close']),
    showToast: () => {},
  };
  vm.runInNewContext(bridge, context);
  return { frame, calls, context, send: data => listener(data) };
}
test('only the Mermaid frame can insert document content', () => {
  const s = setup();
  s.send({ source: {}, data: { type: 'mdv-insert-mermaid', code: 'bad' } });
  assert.equal(s.calls.length, 0);
  s.send({ source: s.frame, data: { type: 'mdv-insert-mermaid', code: 'flowchart LR', closeEditor: true } });
  assert.deepEqual(s.calls, [['insert', 'flowchart LR'], ['close']]);
});
test('PNG export hands the image to the existing insertion dialog', () => {
  const s = setup();
  s.context.window.openImageInsertModal = () => s.calls.push(['open']);
  s.context.window.applyImageInsertDataUrl = (...args) => s.calls.push(args);
  s.send({ source: s.frame, data: { type: 'mdv-open-mermaid-png-in-image-insert', dataUrl: 'data:image/png;base64,AA==', fileName: 'diagram.png' } });
  assert.deepEqual(s.calls, [['close'], ['open'], ['data:image/png;base64,AA==', 'diagram.png']]);
});
test('AI failures are returned with the request id for UI recovery', async () => {
  const s = setup(); const replies = [];
  await s.context.analyzeImageToMermaidForEditor({ requestId: 'request-1' }, { postMessage: data => replies.push(data) });
  assert.equal(replies[0].requestId, 'request-1');
  assert.equal(replies[0].ok, false);
  assert.match(replies[0].error, /AI Jena/);
});
test('vision request forwards image and streams code through the configured bridge', async () => {
  const s = setup(); const replies = []; let request;
  s.context.localStorage = { getItem: key => key === 'ss_ai_chat_provider' ? 'openai' : 'configured-model' };
  s.context.window.AIChatBridge = { complete: async input => {
    request = input;
    input.onStreamEvent({ type: 'message.delta', content: 'flowchart LR' });
    return { text: 'flowchart LR\nA-->B' };
  } };
  await s.context.analyzeImageToMermaidForEditor({ requestId: 'r2', image: { dataUrl: 'data:image/png;base64,AA==', name: 'test.png' } }, { postMessage: data => replies.push(data) });
  assert.equal(request.messages[0].attachments[0].name, 'test.png');
  assert.equal(request.model, 'configured-model');
  assert.equal(replies[0].type, 'mdv-image-to-mermaid-stream');
  assert.equal(replies[1].ok, true);
});

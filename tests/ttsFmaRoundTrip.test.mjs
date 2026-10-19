import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../mdpro/Apps/textToAudio/fma-editor.js', import.meta.url), 'utf8');
function setup() {
  const messages = [], sent = [], listeners = {};
  let image = { src: 'data:image/png;base64,b3JpZ2luYWw=', name: 'original.png' };
  const opener = { closed: false, postMessage: data => messages.push(data) };
  const editor = { postMessage: data => sent.push(data), FMAMdViewerBridge: { currentImagePayload: () => image } };
  const elements = { editor: { contentWindow: editor }, status: { textContent: '' }, 'return-thumbnail': {}, 'insert-document': {} };
  vm.runInNewContext(source, {
    window: { opener, addEventListener: (name, handler) => { listeners[name] = handler; } },
    location: { origin: 'https://mdpro.test' }, document: { getElementById: id => elements[id] },
    File, fetch: async () => ({ blob: async () => new Blob(['image'], { type: 'image/png' }) }),
  });
  return { messages, sent, listeners, elements, opener, editor, edit: value => { image = value; } };
}

test('FMA returns the currently edited image and keeps document insert independent', async () => {
  const state = setup();
  state.listeners.message({ origin: 'https://mdpro.test', source: state.opener, data: { type: 'tts-fma-open', image: 'data:image/png;base64,b3JpZ2luYWw=' } });
  state.edit({ src: 'data:image/png;base64,ZWRpdGVk', name: 'edited.png' });
  await state.elements['return-thumbnail'].onclick();
  await state.elements['insert-document'].onclick();
  assert.equal(state.messages[1].type, 'tts-fma-thumbnail');
  assert.equal(state.messages[1].dataUrl, 'data:image/png;base64,ZWRpdGVk');
  assert.equal(state.messages[2].type, 'tts-fma-document');
});

test('thumbnail actions appear only after a trusted TTS import', () => {
  const state = setup();
  state.elements['return-thumbnail'].hidden = true;
  state.listeners.message({ origin: 'https://mdpro.test', source: {}, data: { type: 'tts-fma-open', image: 'data:image/png;base64,dGVzdA==' } });
  assert.equal(state.elements['return-thumbnail'].hidden, true);
  state.listeners.message({ origin: 'https://mdpro.test', source: state.opener, data: { type: 'tts-fma-open', image: 'data:image/png;base64,dGVzdA==' } });
  assert.equal(state.elements['return-thumbnail'].hidden, false);
});

test('FMA accepts imports only from the opener at the same origin', async () => {
  const state = setup();
  const data = { type: 'tts-fma-open', image: 'data:image/png;base64,aW1hZ2U=' };
  state.listeners.message({ origin: 'https://other.test', source: state.opener, data });
  state.listeners.message({ origin: 'https://mdpro.test', source: {}, data });
  state.listeners.message({ origin: 'https://mdpro.test', source: state.editor, data: { type: 'fmaviewer-ready' } });
  await Promise.resolve();
  assert.equal(state.sent.length, 0);
  state.listeners.message({ origin: 'https://mdpro.test', source: state.opener, data });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.sent[0].type, 'fmaviewer-open-files');
});

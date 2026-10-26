import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync('mdpro/Apps/fmaviewer/js/ai/aiJena.js', 'utf8');
const requestCode = source.slice(source.indexOf('async function requestAiJenaImage('), source.indexOf('async function requestAiJenaVideo('));
function harness({ provider = 'lemonade', base = '/api/lemonade/v1', mode = 'pose', references = {}, original = true, current = 'edited-1' } = {}) {
  const calls = [], payloads = [];
  const state = { mode, sourceItem: { src: current }, references,
    history: original ? [{ src: 'original', original: true }] : [] };
  const send = async (input, signal, options) => { calls.push({ input, options }); return { src: 'edited-next' }; };
  const context = vm.createContext({ aiJenaState: state, URL, location: { href: 'http://localhost:5174/mdpro/' },
    isAiKeyUsageEnabled: () => true, setAiJenaRequestPhase() {}, hasAiJenaSelection: () => mode === 'clothes',
    createAiJenaSelectionMaskPayload: () => ({ mimeType: 'image/png', data: 'mask' }),
    getAiJenaImageConnection: () => ({ provider, model: 'Flux-2-Klein-4B' }),
    getAiImagePayload: async item => { payloads.push(item.src); return { mimeType: 'image/png', data: item.src }; },
    prepareAiJenaLocalImages: async input => input, requestAiJenaStudioImage: send,
    window: { getFmaLemonadeImageSettings: () => ({ width: 768, height: 1024, steps: 8, cfgScale: 0, seed: 42 }), requestFmaLemonadeImage: send, getFmaLemonadeBaseUrl: () => base } });
  vm.runInContext(requestCode, context);
  return { context, state, calls, payloads };
}

test('six successive local edits keep the unchanged original appearance anchor and the selected current source', async () => {
  const { context, state, calls, payloads } = harness();
  for (let i = 1; i <= 6; i++) {
    state.sourceItem.src = `edited-${i}`;
    await context.requestAiJenaImage('change pose');
    const pictures = calls.at(-1).input.filter(part => part.type === 'image');
    assert.deepEqual(Array.from(pictures, part => part.data), [`edited-${i}`, 'original']);
    assert.match(calls.at(-1).input.map(part => part.text || '').join('\n'), /IMAGE 2: ORIGINAL PERSON.*Do not copy its pose/);
  }
  assert.equal(payloads.filter(src => src === 'original').length, 6);
  assert.equal(state.history[0].src, 'original');
});

test('mask remains image 2 and original appearance follows numbered clothing reference', async () => {
  const { context, calls } = harness({ mode: 'clothes', references: { clothing: { src: 'data:image/png;base64,garment', mimeType: 'image/png' } } });
  await context.requestAiJenaImage('change selected garment');
  assert.deepEqual(Array.from(calls[0].input.filter(part => part.type === 'image'), part => part.data), ['edited-1', 'mask', 'garment', 'original']);
  assert.match(calls[0].input.map(part => part.text || '').join('\n'), /IMAGE 3: CLOTHING REFERENCE[\s\S]*IMAGE 4: ORIGINAL PERSON/);
});

for (const options of [
  { provider: 'aistudio' }, { base: 'https://remote.example/api/v1' }, { base: 'http://remote.example/api/v1' },
  { mode: 'generate' }, { original: false }, { current: 'original' },
  { references: { face: { src: 'data:image/png;base64,face', mimeType: 'image/png' } } }
]) test(`does not add the original when excluded: ${JSON.stringify(options)}`, async () => {
  const { context, calls, payloads } = harness(options);
  await context.requestAiJenaImage('requested change');
  assert.equal(payloads.filter(src => src === 'original').length, options.current === 'original' ? 1 : 0);
  assert.ok(!calls[0].input.some(part => part.text?.includes('ORIGINAL PERSON APPEARANCE')));
});

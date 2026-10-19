import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTtsAudio, runAudioBatch } from '../mdpro/Apps/textToAudio/ttsBatch.js';

test('batch generates slots sequentially and continues after failure', async () => {
  const calls = [], progress = [];
  let running = false;
  const result = await runAudioBatch([1, 2, 3].map(id => ({ id, text: 'story', ttsMode: 'ai' })), async slot => {
    assert.equal(running, false); running = true;
    await Promise.resolve(); calls.push(slot.id); running = false;
    if (slot.id === 2) throw new Error('quota');
  }, { onProgress: item => progress.push(item.slotId) });
  assert.deepEqual(calls, [1, 2, 3]); assert.deepEqual(progress, [1, 2, 3]);
  assert.equal(result.success, 2); assert.deepEqual(result.failed, [{ index: 2, reason: 'quota' }]);
});
test('batch skips empty and browser-only slots and stops before next request on abort', async () => {
  const controller = new AbortController(), calls = [];
  const result = await runAudioBatch([{ id: 1, text: '' }, { id: 2, text: 'local', ttsMode: 'browser' }, { id: 3, text: 'ai' }, { id: 4, text: 'ai' }], async slot => {
    calls.push(slot.id); controller.abort();
  }, { signal: controller.signal });
  assert.deepEqual(calls, [3]); assert.equal(result.skipped.length, 2); assert.equal(result.cancelled, true);
});
test('single and batch TTS use selected voice, custom instructions and PCM output', async t => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.signal, signal); assert.equal(options.headers['x-goog-api-key'], 'test');
    const request = JSON.parse(options.body);
    assert.equal(request.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
    assert.match(request.contents[0].parts[0].text, /빠르게/);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AEA=' } }] } }] }) };
  });
  const output = new Float32Array(1);
  const context = { resume: async () => {}, createBuffer: (channels, length, rate) => {
    assert.equal(rate, 24000); return { getChannelData: () => output };
  } };
  await generateTtsAudio({ text: 'story', voice: 'Kore', isCustom: true, speed: 1.5, pitch: 1 }, 'test', context, signal);
  assert.equal(output[0], .5);
});

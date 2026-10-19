import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeAudio, restoreAudio, createTavProject, restoreTavProject } from '../mdpro/Apps/textToAudio/tavProject.js';
const context = { createBuffer(channels, length, rate) {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return { numberOfChannels: channels, sampleRate: rate, length, getChannelData: index => data[index] };
} };
test('TAV stores and restores lossless stereo PCM audio', () => {
  const audio = context.createBuffer(2, 3, 48000);
  audio.getChannelData(0).set([-.5, .25, .125]); audio.getChannelData(1).set([.75, -.25, 0]);
  const restored = restoreAudio(serializeAudio(audio), context);
  assert.equal(restored.sampleRate, 48000);
  assert.deepEqual([...restored.getChannelData(0)], [-.5, .25, .125]);
  assert.deepEqual([...restored.getChannelData(1)], [.75, -.25, 0]);
});
test('TAV round trip keeps image order, timings, music and media while excluding credentials', async () => {
  const audio = context.createBuffer(1, 2, 24000);
  const video = URL.createObjectURL(new Blob(['background'], { type: 'video/mp4' }));
  const project = await createTavProject({ name: 'project', slots: [{ id: 1, text: 'story', isGenerated: true, audioBuffer: audio, musicBuffer: audio,
    apiKey: 'must-not-save', backgroundVideo: video, backgroundImages: [{ id: 'b', src: 'data:image/png;base64,Yg==', duration: 3 }, { id: 'a', src: 'data:image/png;base64,YQ==', duration: 2 }], musicStart: 2, musicFadeOut: 3 }], settings: { isDarkMode: true } });
  URL.revokeObjectURL(video);
  assert.ok(!JSON.stringify(project).includes('must-not-save'));
  const restored = restoreTavProject(JSON.parse(JSON.stringify(project)), context);
  assert.equal(restored.slots[0].text, 'story');
  assert.deepEqual(restored.slots[0].backgroundImages.map(image => image.id), ['b', 'a']);
  assert.equal(restored.slots[0].musicFadeOut, 3);
  assert.equal(restored.slots[0].audioBuffer.sampleRate, 24000);
  assert.equal(restored.slots[0].musicBuffer.length, 2);
  assert.equal(await (await fetch(restored.slots[0].backgroundVideo)).text(), 'background');
  URL.revokeObjectURL(restored.slots[0].backgroundVideo);
});
test('TAV rejects incompatible files and malformed audio before replacing work', () => {
  assert.throws(() => restoreTavProject({ version: 2 }, context), /지원하는/);
  assert.throws(() => restoreAudio({ encoding: 'float32-le', sampleRate: 48000, channels: ['YQ=='] }, context), /길이/);
  assert.throws(() => restoreTavProject({ type: 'TTS2AudioProject', version: 1, slots: [{ backgroundImage: 'https://other.test/image' }] }, context), /이미지/);
});

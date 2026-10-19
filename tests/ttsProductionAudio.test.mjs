import test from 'node:test';
import assert from 'node:assert/strict';
import { musicPlan, scheduleMusic, pcmStereoToBuffer, generateLyriaMusic, generateVeoVideo } from '../mdpro/Apps/textToAudio/productionAudio.js';

test('music timing clips to video length and scales overlapping fades', () => {
  assert.deepEqual(musicPlan({ musicStart: 8, musicDuration: 30, musicFadeIn: 4, musicFadeOut: 4 }, 10),
    { start: 8, duration: 2, fadeIn: 1, fadeOut: 1, offset: 0, volume: .2 });
  assert.equal(musicPlan({ musicStart: 99 }, 10).duration, 0);
  assert.equal(musicPlan({ musicFadeInEnabled: false, musicFadeOutEnabled: false }, 10).fadeOut, 0);
});

test('music source schedules offset, gain envelope and end on the export clock', () => {
  const events = [];
  const gain = { connect() {}, gain: { setValueAtTime: (...args) => events.push(['set', ...args]), linearRampToValueAtTime: (...args) => events.push(['ramp', ...args]) } };
  const source = { connect: () => gain, start: (...args) => events.push(['start', ...args]), stop: (...args) => events.push(['stop', ...args]) };
  const context = { createBufferSource: () => source, createGain: () => gain };
  scheduleMusic(context, {}, { duration: 3 }, { musicStart: 2, musicDuration: 6, musicOffset: 4, musicVolume: .3, musicFadeIn: 1, musicFadeOut: 2 }, 10, 100);
  assert.equal(source.loop, true);
  assert.deepEqual(events, [['set', 0, 102], ['ramp', .3, 103], ['set', .3, 106], ['ramp', 0, 108], ['start', 102, 1], ['stop', 108]]);
  assert.equal(scheduleMusic(context, {}, { duration: 3 }, { musicEnabled: false }, 10, 0), null);
});

test('nonloop music stops at file end, truncating fades to available duration', () => {
  let end;
  const gain = { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } };
  const source = { connect: () => gain, start() {}, stop: time => { end = time; } };
  scheduleMusic({ createBufferSource: () => source, createGain: () => gain }, {}, { duration: 3 }, { musicStart: 2, musicOffset: 2, musicDuration: 10, musicLoop: false }, 20, 100);
  assert.equal(end, 103);
});

const context = { createBuffer(channels, frames, rate) {
  const data = Array.from({ length: channels }, () => new Float32Array(frames));
  return { duration: frames / rate, length: frames, getChannelData: channel => data[channel] };
} };

test('Lyria stereo PCM preserves channel order and trims to requested samples', () => {
  const bytes = new Uint8Array(12), view = new DataView(bytes.buffer);
  [16384, -16384, 8192, -8192, 1, 2].forEach((value, i) => view.setInt16(i * 2, value, true));
  const buffer = pcmStereoToBuffer(bytes, 2, 1, context);
  assert.deepEqual([...buffer.getChannelData(0)], [.5, .25]);
  assert.deepEqual([...buffer.getChannelData(1)], [-.5, -.25]);
});

test('Lyria waits for setup, stops at sample duration and closes socket', async () => {
  let socket;
  class Socket {
    constructor() { socket = this; this.sent = []; }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.closed = true; }
  }
  const pending = generateLyriaMusic({ apiKey: 'test', prompt: 'piano', duration: 1, context, Socket });
  socket.onopen();
  assert.deepEqual(socket.sent, [{ setup: { model: 'models/lyria-realtime-exp' } }]);
  socket.onmessage({ data: JSON.stringify({ setupComplete: {} }) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(socket.sent[2].playbackControl, 'PLAY');
  socket.onmessage({ data: JSON.stringify({ serverContent: { audioChunks: [{ mimeType: 'audio/pcm;rate=2', data: btoa(String.fromCharCode(...new Uint8Array(12))) }] } }) });
  const buffer = await pending;
  assert.equal(buffer.duration, 1);
  assert.equal(socket.closed, true);
});

test('Lyria abort releases socket and Veo API errors are shown', async t => {
  let closed = false;
  class Socket { close() { closed = true; } }
  const controller = new AbortController();
  const pending = generateLyriaMusic({ apiKey: 'test', prompt: 'piano', duration: 1, context, Socket, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(closed, true);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /veo-3.1-generate-preview:predictLongRunning$/);
    assert.equal(JSON.parse(options.body).parameters.durationSeconds, 8);
    return { ok: false, status: 403, json: async () => ({ error: { message: 'model access denied' } }) };
  });
  await assert.rejects(generateVeoVideo({ apiKey: 'test', model: 'veo-3.1-generate-preview', prompt: 'scene', duration: 8, aspectRatio: '16:9' }), /model access denied/);
});

test('Veo polls the submitted operation and downloads the completed clip', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const clip = new Blob(['test-video'], { type: 'video/mp4' });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(options.headers['x-goog-api-key'], 'test');
    if (calls === 1) return { ok: true, json: async () => ({ name: 'operations/test' }) };
    if (calls === 2) {
      assert.match(String(url), /operations\/test$/);
      return { ok: true, json: async () => ({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/test:download' } }] } } }) };
    }
    return { ok: true, blob: async () => clip };
  });
  const pending = generateVeoVideo({ apiKey: 'test', model: 'veo-3.1-generate-preview', prompt: 'scene', duration: 8, aspectRatio: '16:9' });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  t.mock.timers.tick(10000);
  assert.equal(await pending, clip);
  assert.equal(calls, 3);
});

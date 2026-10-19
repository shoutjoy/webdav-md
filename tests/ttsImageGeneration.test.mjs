import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageModel, requestGemini, listImageModels } from '../mdpro/Apps/textToAudio/imageGeneration.js';

test('model listing follows pagination and includes Gemini images and Imagen generation only', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    if (calls === 2) assert.equal(url.searchParams.get('pageToken'), 'next');
    return { ok: true, json: async () => calls === 1 ? {
      models: [
        { name: 'models/gemini-3-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      ], nextPageToken: 'next',
    } : { models: [
      { name: 'models/imagen-4.0-generate-001', supportedGenerationMethods: ['predict'] },
      { name: 'models/imagen-4-upscale', supportedGenerationMethods: ['predict'] },
    ] } };
  });
  assert.deepEqual(await listImageModels('test'), ['gemini-3-image', 'imagen-4.0-generate-001']);
  assert.equal(calls, 2);
});

test('Imagen uses predict and decodes its image response', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /imagen-4.0-generate-001:predict$/);
    assert.deepEqual(JSON.parse(options.body), { instances: [{ prompt: 'scene' }], parameters: { sampleCount: 1 } });
    return { ok: true, json: async () => ({ predictions: [{ mimeType: 'image/png', bytesBase64Encoded: 'image' }] }) };
  });
  assert.equal(await requestGemini('test', 'imagen-4.0-generate-001', 'scene', true), 'data:image/png;base64,image');
});

test('model IDs accept models prefix and reject URL/path injection', () => {
  assert.equal(normalizeImageModel(' models/gemini-2.5-flash-image '), 'gemini-2.5-flash-image');
  assert.throws(() => normalizeImageModel('../other?key=secret'));
  assert.throws(() => normalizeImageModel(''));
});

test('image request uses selected model and returns final image rather than thought image', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /models\/custom-image-model:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(options.body).generationConfig.responseModalities, ['TEXT', 'IMAGE']);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [
      { thought: true, inlineData: { mimeType: 'image/png', data: 'draft' } },
      { inlineData: { mimeType: 'image/png', data: 'final' } },
    ] } }] }) };
  });
  assert.equal(await requestGemini('test-key', 'custom-image-model', 'scene', true), 'data:image/png;base64,final');
});

test('missing key, API failures and missing images report actionable errors', async (t) => {
  await assert.rejects(requestGemini('', 'model', 'scene'), /API 키/);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ error: { message: 'quota exceeded' } }) }));
  await assert.rejects(requestGemini('test', 'model', 'scene', true), /quota exceeded/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
  await assert.rejects(requestGemini('test', 'model', 'scene', true), /이미지가 반환되지/);
});

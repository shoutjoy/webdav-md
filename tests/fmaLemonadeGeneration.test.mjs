import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code = readFileSync('mdpro/Apps/fmaviewer/js/image/lemonadeSettings.js', 'utf8');
const source = code.slice(code.indexOf('    window.requestFmaLemonadeImage ='), code.indexOf('    function render('));
const picture = { type: 'image', mime_type: 'image/png', data: 'aGVsbG8=' };
const input = [picture, { type: 'text', text: 'Change hair to black' }];
function harness(replies) {
  const calls = [];
  const window = { getFmaLemonadeImageModel: () => 'Flux-2-Klein-4B', getFmaLemonadeBaseUrl: () => '/api/lemonade/v1', waitForFmaLemonadeIdle: async () => {}, getFmaLemonadeImageSettings: () => ({ width: 768, height: 1024, steps: 8, cfgScale: 0, seed: 42 }) };
  const context = vm.createContext({ window, host: () => ({ localStorage: { getItem: () => null } }),
    location: { hostname: 'localhost', protocol: 'http:' }, FormData, Blob, Uint8Array, atob, DOMException,
    fetch: async (url, options) => {
      calls.push({ url, options });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      if (!reply) throw new Error('Unexpected extra request');
      return { ok: reply.status < 400, status: reply.status,
        text: async () => typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body) };
    } });
  vm.runInContext(source, context);
  return { calls, request: window.requestFmaLemonadeImage };
}
const success = () => ({ status: 200, body: { data: [{ b64_json: 'cmVzdWx0', mime_type: 'image/png' }] } });
const failure = (status = 500, message = 'sd-server request failed') => ({ status, body: { error: { message } } });

test('sd-server edit failure stops without discarding the image reference', async () => {
  const { calls, request } = harness([failure()]);
  let notice;
  const signal = new AbortController().signal;
  await assert.rejects(request(input, signal, { mode: 'edit', onGenerationFallback: text => { notice = text; } }), /자동 전환하지 않았/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /images\/edits$/);
  assert.ok(calls[0].options.body.get('image') instanceof Blob);
  assert.equal(calls[0].options.signal, signal);
  assert.equal(notice, undefined);
});

test('new image mode uses generation even when an original image is open', async () => {
  const { calls, request } = harness([success()]);
  await request(input, undefined, { mode: 'generate' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /images\/generations$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.size, '768x1024');
  assert.equal(body.steps, 8);
  assert.equal(body.cfg_scale, 0);
  assert.equal(body.seed, 42);
});

test('multiple edit references consistently use image[] and successful edit does not generate', async () => {
  const { calls, request } = harness([success()]);
  const result = await request([...input, picture], undefined, { mode: 'pose' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.body.getAll('image[]').length, 2);
  assert.equal(calls[0].options.body.get('image'), null);
  assert.equal(calls[0].options.body.get('size'), '768x1024');
  assert.equal(calls[0].options.body.get('cfg_scale'), '0');
  assert.equal(calls[0].options.body.get('seed'), '42');
  assert.equal(result.generationFallback, undefined);
});

for (const mode of ['clothes', 'tryon']) test(`${mode} never drops the required mask or references`, async () => {
  const { calls, request } = harness([failure()]);
  await assert.rejects(request(input, undefined, { mode }), /sd-server/);
  assert.equal(calls.length, 1);
});

for (const reply of [failure(401, 'Unauthorized'), failure(429, 'rate limit'), new TypeError('Failed to fetch'), new DOMException('stopped', 'AbortError')]) {
  test(`does not generate after ${reply.status || reply.name}`, async () => {
    const { calls, request } = harness([reply]);
    await assert.rejects(request(input, undefined, { mode: 'edit' }));
    assert.equal(calls.length, 1);
  });
}

test('unsupported pose edit reports original error and never generates a replacement person', async () => {
  const { calls, request } = harness([{ status: 405, body: 'Method Not Allowed' }]);
  await assert.rejects(request(input, undefined, { mode: 'pose' }), /Method Not Allowed.*자동 전환하지 않았/);
  assert.equal(calls.length, 1);
});

test('failed edit does not invoke a generation fallback callback', async () => {
  const controller = new AbortController();
  const { calls, request } = harness([failure()]);
  await assert.rejects(request(input, controller.signal, { mode: 'edit', onGenerationFallback: () => controller.abort() }), /이미지 편집 실패/);
  assert.equal(controller.signal.aborted, false);
  assert.equal(calls.length, 1);
});

test('malformed reference is rejected without falling back to text generation', async () => {
  const { calls, request } = harness([]);
  await assert.rejects(request([{ ...picture, data: '' }, input[1]], undefined, { mode: 'edit' }), /참조 이미지/);
  assert.equal(calls.length, 0);
});

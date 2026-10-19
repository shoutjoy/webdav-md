import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemUsageMiddleware, percent } from '../src/systemUsageServer.js';

test('usage percentages distinguish unavailable from zero and stay within bounds', () => {
  assert.equal(percent(null), null);
  assert.equal(percent(NaN), null);
  assert.equal(percent(0), 0);
  assert.equal(percent(104), 100);
  assert.equal(percent(-1), 0);
  assert.equal(percent(43.7), 44);
});

test('memory cleanup requires local same-origin explicit POST and reports errors', async () => {
  let calls = 0;
  const middleware = createSystemUsageMiddleware({ cleanup: async () => { calls++; return { processed: 2 }; } });
  const headers = { origin: 'http://localhost:5173', host: 'localhost:5173', 'x-memory-cleanup': '1' };
  for (const [method, address, requestHeaders, status] of [
    ['GET', '127.0.0.1', headers, 405],
    ['POST', '192.168.1.2', headers, 403],
    ['POST', '127.0.0.1', {}, 403],
    ['POST', '127.0.0.1', { ...headers, origin: 'http://other.example' }, 403],
    ['POST', '127.0.0.1', { ...headers, 'x-memory-cleanup': undefined }, 403],
  ]) {
    const response = { end() {} };
    await middleware({ url: '/api/system-memory-cleanup', method, socket: { remoteAddress: address }, headers: requestHeaders }, response, () => {});
    assert.equal(response.statusCode, status);
  }
  assert.equal(calls, 0);
  let body;
  const response = { setHeader() {}, end(value) { body = JSON.parse(value); } };
  const request = { url: '/api/system-memory-cleanup', method: 'POST', socket: { remoteAddress: '::1' }, headers };
  await middleware(request, response, () => {});
  assert.equal(calls, 1);
  assert.equal(body.processed, 2);
  assert.ok(body.releasedMB >= 0);
  const failing = createSystemUsageMiddleware({ cleanup: async () => { throw new Error('failure'); } });
  await failing(request, response, () => {});
  assert.equal(response.statusCode, 503);
  assert.match(body.error, /RAM/);
});

test('system usage only serves local GET requests and passes other routes through', async () => {
  const middleware = createSystemUsageMiddleware();
  let passed = false;
  await middleware({ url: '/other' }, {}, () => { passed = true; });
  assert.equal(passed, true);
  for (const [method, address, status] of [['POST', '127.0.0.1', 405], ['GET', '192.168.1.2', 403]]) {
    const response = { end() {} };
    await middleware({ url: '/api/system-usage', method, socket: { remoteAddress: address } }, response, () => {});
    assert.equal(response.statusCode, status);
  }
});

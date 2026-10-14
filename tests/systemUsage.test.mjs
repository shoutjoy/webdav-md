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

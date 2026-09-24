import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createLMStudioServerMiddleware } from '../src/lmStudioServer.js';

async function withServer(run, callback) {
  const middleware = createLMStudioServerMiddleware({ run });
  const server = createServer((req, res) => middleware(req, res, () => {
    res.statusCode = 404;
    res.end();
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('LM Studio middleware restarts the server with selected network and CORS flags', async () => {
  const calls = [];
  await withServer(async args => { calls.push(args); }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/lmstudio-server/configure`, {
      method: 'POST',
      headers: {
        Origin: baseUrl,
        'Content-Type': 'application/json',
        'X-MDPro-Local-Action': 'lmstudio-server'
      },
      body: JSON.stringify({ port: 5678, serveOnLocalNetwork: true, enableCors: true })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      port: 5678,
      serveOnLocalNetwork: true,
      enableCors: true
    });
  });
  assert.deepEqual(calls, [
    ['server', 'stop'],
    ['server', 'start', '--port', '5678', '--bind', '0.0.0.0', '--cors']
  ]);
});

test('LM Studio middleware rejects non-local browser origins', async () => {
  await withServer(async () => {}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/lmstudio-server/configure`, {
      method: 'POST',
      headers: {
        Origin: 'https://example.com',
        'Content-Type': 'application/json',
        'X-MDPro-Local-Action': 'lmstudio-server'
      },
      body: JSON.stringify({ port: 5678, serveOnLocalNetwork: true, enableCors: true })
    });
    assert.equal(response.status, 403);
  });
});

test('LM Studio middleware validates the server port before running commands', async () => {
  const calls = [];
  await withServer(async args => { calls.push(args); }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/lmstudio-server/configure`, {
      method: 'POST',
      headers: {
        Origin: baseUrl,
        'Content-Type': 'application/json',
        'X-MDPro-Local-Action': 'lmstudio-server'
      },
      body: JSON.stringify({ port: 70000, serveOnLocalNetwork: true, enableCors: true })
    });
    assert.equal(response.status, 400);
  });
  assert.deepEqual(calls, []);
});

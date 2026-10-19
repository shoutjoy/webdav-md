import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createLemonadeProxyMiddleware } from '../src/lemonadeProxy.js';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));

test('Lemonade middleware exposes ENV defaults and proxies model requests without browser CORS', async () => {
  const upstream = createServer((req, res) => {
    assert.equal(req.url, '/api/v1/models');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [{ id: 'Gemma-4-E4B-it-GGUF' }] }));
  });
  await listen(upstream);
  const middleware = createLemonadeProxyMiddleware({
    baseUrl: `http://127.0.0.1:${upstream.address().port}/api/v1`,
    defaultModel: 'Gemma-4-E4B-it-GGUF',
    defaultImageModel: 'Flux-2-Klein-4B',
  });
  const app = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await listen(app);

  try {
    const baseUrl = `http://127.0.0.1:${app.address().port}`;
    const config = await fetch(`${baseUrl}/api/lemonade/config`).then(response => response.json());
    assert.equal(config.defaultModel, 'Gemma-4-E4B-it-GGUF');
    assert.equal(config.defaultImageModel, 'Flux-2-Klein-4B');
    assert.equal(config.proxyBaseUrl, '/api/lemonade/v1');

    const response = await fetch(`${baseUrl}/api/lemonade/v1/models`, { headers: { Origin: 'https://webdav.example' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [{ id: 'Gemma-4-E4B-it-GGUF' }] });
  } finally {
    await close(app);
    await close(upstream);
  }
});

test('Lemonade middleware rejects non-loopback ENV targets', () => {
  assert.throws(
    () => createLemonadeProxyMiddleware({ baseUrl: 'https://example.com/api/v1' }),
    /localhost/,
  );
});

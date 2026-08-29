import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebSearchMiddleware, parseBingRss } from '../src/webSearchProxy.js';

test('parseBingRss normalizes and limits RSS items', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Music &amp; advertising</title><link>https://example.com/a</link><description><![CDATA[Useful summary]]></description><pubDate>Fri, 28 Aug 2026 00:00:00 GMT</pubDate></item>
    <item><title>Second</title><link>https://example.com/b</link><description>More</description></item>
  </channel></rss>`;
  assert.deepEqual(parseBingRss(xml, 1), [{
    title: 'Music & advertising',
    url: 'https://example.com/a',
    snippet: 'Useful summary',
    publishedAt: 'Fri, 28 Aug 2026 00:00:00 GMT',
    source: 'Bing',
    engine: 'bing-rss',
  }]);
});

test('middleware returns AI Jena compatible search payload', async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () => '<rss><channel><item><title>Result</title><link>https://example.com</link><description>Summary</description></item></channel></rss>',
  });
  const middleware = createWebSearchMiddleware(fetchImpl);
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; },
    end(value) { this.body = value; },
  };
  await middleware({ url: '/api/web-search/?q=music&count=20' }, response, () => assert.fail('unexpected next'));
  assert.equal(response.statusCode, 200);
  assert.equal(headers['Content-Type'], 'application/json; charset=utf-8');
  const payload = JSON.parse(response.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.engine, 'bing-rss');
  assert.equal(payload.results[0].url, 'https://example.com');
});

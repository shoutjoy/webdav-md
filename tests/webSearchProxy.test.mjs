import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebSearchMiddleware, parseBingRss, parseDuckDuckGoHtml } from '../src/webSearchProxy.js';

test('parseDuckDuckGoHtml resolves redirect URLs and snippets', () => {
  const html = '<div class="result results_links"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Example &amp; result</a><a class="result__snippet">Useful <b>summary</b></a></div>';
  assert.deepEqual(parseDuckDuckGoHtml(html, 1), [{
    title: 'Example & result', url: 'https://example.com/a', snippet: 'Useful summary', publishedAt: '', source: 'DuckDuckGo', engine: 'duckduckgo-html',
  }]);
});

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

test('middleware returns AI Jena compatible DuckDuckGo search payload', async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () => '<div class="result"><a class="result__a" href="https://example.com">Result</a><div class="result__snippet">Summary</div></div>',
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
  assert.equal(payload.engine, 'duckduckgo-html');
  assert.equal(payload.results[0].url, 'https://example.com/');
});

test('middleware uses configured Google Custom Search before public fallbacks', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url.hostname, 'www.googleapis.com');
    return { ok: true, json: async () => ({ items: [{ title: 'Google result', link: 'https://google.example/result', snippet: 'Summary' }] }) };
  };
  const middleware = createWebSearchMiddleware({ fetchImpl, googleApiKey: 'test-key', googleSearchEngineId: 'test-cx' });
  const response = { setHeader() {}, end(value) { this.body = value; } };
  await middleware({ url: '/api/web-search?q=test' }, response, () => assert.fail('unexpected next'));
  const payload = JSON.parse(response.body);
  assert.equal(payload.engine, 'google-custom-search');
  assert.equal(payload.results[0].source, 'Google');
});

test('middleware uses a request-scoped SerpApi key before other providers', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url.hostname, 'serpapi.com');
    assert.equal(url.searchParams.get('api_key'), 'request-key');
    return { ok: true, json: async () => ({ organic_results: [{ title: 'Serp result', link: 'https://serp.example/result', snippet: 'Summary' }] }) };
  };
  const middleware = createWebSearchMiddleware({ fetchImpl });
  const response = { setHeader() {}, end(value) { this.body = value; } };
  await middleware({ url: '/api/web-search?q=test', headers: { 'x-serpapi-key': 'request-key' } }, response, () => assert.fail('unexpected next'));
  const payload = JSON.parse(response.body);
  assert.equal(payload.engine, 'serpapi-google');
  assert.equal(payload.results[0].source, 'Google via SerpApi');
});

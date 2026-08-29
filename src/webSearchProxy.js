const XML_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
});

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const radix = code[0].toLowerCase() === 'x' ? 16 : 10;
      const number = Number.parseInt(radix === 16 ? code.slice(1) : code, radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name) => XML_ENTITIES[name.toLowerCase()] || match)
    .trim();
}

function tagValue(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

export function parseBingRss(xml, limit = 10) {
  const results = [];
  const seen = new Set();
  const items = String(xml || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const url = tagValue(item, 'link');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({
      title: tagValue(item, 'title') || url,
      url,
      snippet: tagValue(item, 'description'),
      publishedAt: tagValue(item, 'pubDate'),
      source: 'Bing',
      engine: 'bing-rss',
    });
    if (results.length >= limit) break;
  }
  return results;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

export function createWebSearchMiddleware(fetchImpl = fetch) {
  return async function webSearchMiddleware(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== '/api/web-search/' && requestUrl.pathname !== '/api/web-search') {
      next();
      return;
    }

    const query = String(requestUrl.searchParams.get('q') || '').trim().slice(0, 500);
    if (!query) {
      sendJson(response, 400, { ok: false, error: '검색어가 없습니다.' });
      return;
    }
    const count = Math.max(1, Math.min(50, Math.round(Number(requestUrl.searchParams.get('count')) || 10)));

    try {
      const upstream = new URL('https://www.bing.com/search');
      upstream.searchParams.set('format', 'rss');
      upstream.searchParams.set('q', query);
      upstream.searchParams.set('count', String(count));
      upstream.searchParams.set('mkt', 'ko-KR');
      upstream.searchParams.set('setlang', 'ko-KR');
      const result = await fetchImpl(upstream, {
        headers: { 'Accept': 'application/rss+xml, application/xml;q=0.9' },
        signal: AbortSignal.timeout(15000),
      });
      if (!result.ok) throw new Error(`Bing RSS HTTP ${result.status}`);
      const results = parseBingRss(await result.text(), count);
      if (!results.length) {
        sendJson(response, 404, { ok: false, error: '검증 가능한 인터넷 검색 결과가 없습니다.' });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        engine: 'bing-rss',
        fallbackUsed: true,
        fallbackMessage: 'WebDAV 앱의 로컬 검색 중계를 사용했습니다.',
        query,
        results,
      });
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        error: `인터넷 검색 중계 실패: ${error && error.message ? error.message : error}`,
      });
    }
  };
}

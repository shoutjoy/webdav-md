const ENTITIES = Object.freeze({ amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' });

function decodeHtml(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const hex = code[0].toLowerCase() === 'x';
      const number = Number.parseInt(hex ? code.slice(1) : code, hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : '';
    }).replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] || match).replace(/\s+/g, ' ').trim();
}

function tagValue(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

export function parseBingRss(xml, limit = 10) {
  const results = [], seen = new Set();
  for (const item of String(xml || '').match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []) {
    const url = tagValue(item, 'link');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    results.push({ title: tagValue(item, 'title') || url, url, snippet: tagValue(item, 'description'), publishedAt: tagValue(item, 'pubDate'), source: 'Bing', engine: 'bing-rss' });
    if (results.length >= limit) break;
  }
  return results;
}

function duckUrl(value) {
  try {
    const url = new URL(decodeHtml(value), 'https://html.duckduckgo.com');
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : url.href;
  } catch { return ''; }
}

export function parseDuckDuckGoHtml(html, limit = 10) {
  const results = [], seen = new Set();
  for (const block of String(html || '').split(/<div[^>]+class="[^"]*\bresult\b[^"]*"[^>]*>/i).slice(1)) {
    const link = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = duckUrl(link[1]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const snippet = block.match(/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    results.push({ title: decodeHtml(link[2]) || url, url, snippet: decodeHtml(snippet && snippet[1]), publishedAt: '', source: 'DuckDuckGo', engine: 'duckduckgo-html' });
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

export function createWebSearchMiddleware(options = {}) {
  const fetchImpl = typeof options === 'function' ? options : (options.fetchImpl || fetch);
  const googleApiKey = String(options.googleApiKey || '').trim();
  const googleSearchEngineId = String(options.googleSearchEngineId || '').trim();
  return async function webSearchMiddleware(request, response, next) {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (!['/api/web-search/', '/api/web-search'].includes(requestUrl.pathname)) return next();
    const query = String(requestUrl.searchParams.get('q') || '').trim().slice(0, 500);
    if (!query) return sendJson(response, 400, { ok: false, error: '검색어가 없습니다.' });
    const count = Math.max(1, Math.min(50, Math.round(Number(requestUrl.searchParams.get('count')) || 10)));
    const requested = String(requestUrl.searchParams.get('engine') || 'auto').toLowerCase();
    const attempts = [], warnings = [];
    const requestSerpApiKey = String(request.headers && request.headers['x-serpapi-key'] || '').trim();
    if ((requested === 'auto' || requested === 'serpapi') && requestSerpApiKey) attempts.push('serpapi');
    if ((requested === 'auto' || requested === 'google') && googleApiKey && googleSearchEngineId) attempts.push('google');
    if (requested === 'auto' || requested === 'duckduckgo') attempts.push('duckduckgo');
    if (requested === 'auto' || requested === 'bing') attempts.push('bing');
    for (const engine of attempts) {
      try {
        let results;
        if (engine === 'serpapi') {
          const upstream = new URL('https://serpapi.com/search.json');
          upstream.search = new URLSearchParams({ engine: 'google', q: query, api_key: requestSerpApiKey, hl: 'ko', gl: 'kr', num: String(Math.min(20, count)) });
          const result = await fetchImpl(upstream, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
          if (!result.ok) throw new Error(`SerpApi HTTP ${result.status}`);
          const payload = await result.json();
          if (payload.error) throw new Error(String(payload.error));
          results = (Array.isArray(payload.organic_results) ? payload.organic_results : []).slice(0, count).map((item) => ({
            title: String(item.title || item.link || ''), url: String(item.link || ''), snippet: String(item.snippet || ''), publishedAt: String(item.date || ''), source: 'Google via SerpApi', engine: 'serpapi-google',
          })).filter((item) => item.url);
        } else if (engine === 'google') {
          const upstream = new URL('https://www.googleapis.com/customsearch/v1');
          upstream.search = new URLSearchParams({ key: googleApiKey, cx: googleSearchEngineId, q: query, num: String(Math.min(10, count)) });
          const result = await fetchImpl(upstream, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
          if (!result.ok) throw new Error(`Google Custom Search HTTP ${result.status}`);
          const payload = await result.json();
          results = (Array.isArray(payload.items) ? payload.items : []).slice(0, count).map((item) => ({ title: String(item.title || item.link || ''), url: String(item.link || ''), snippet: String(item.snippet || ''), publishedAt: '', source: 'Google', engine: 'google-custom-search' })).filter((item) => item.url);
        } else if (engine === 'duckduckgo') {
          const upstream = new URL('https://html.duckduckgo.com/html/');
          upstream.search = new URLSearchParams({ q: query, kl: 'kr-kr' });
          const result = await fetchImpl(upstream, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 AI-Jena-WebSearch/1.0' }, signal: AbortSignal.timeout(15000) });
          if (!result.ok) throw new Error(`DuckDuckGo HTTP ${result.status}`);
          results = parseDuckDuckGoHtml(await result.text(), count);
        } else {
          const upstream = new URL('https://www.bing.com/search');
          upstream.search = new URLSearchParams({ format: 'rss', q: query, count: String(count), mkt: 'ko-KR', setlang: 'ko-KR' });
          const result = await fetchImpl(upstream, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9' }, signal: AbortSignal.timeout(15000) });
          if (!result.ok) throw new Error(`Bing RSS HTTP ${result.status}`);
          results = parseBingRss(await result.text(), count);
        }
        if (!results.length) throw new Error('검색 결과 없음');
        return sendJson(response, 200, { ok: true, engine: results[0].engine, fallbackUsed: warnings.length > 0, fallbackMessage: warnings.length ? '이전 검색 공급자 실패 후 다음 공급자를 사용했습니다.' : '', query, warnings, results });
      } catch (error) { warnings.push(`${engine}: ${error && error.message ? error.message : error}`); }
    }
    return sendJson(response, 502, { ok: false, error: `인터넷 검색 중계 실패: ${warnings.join(' · ') || '사용 가능한 검색 공급자가 없습니다.'}` });
  };
}

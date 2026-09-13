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

function publicPageUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || !host.includes('.')) return null;
    return url;
  } catch { return null; }
}

function pageExcerpt(html) {
  const text = String(html || '')
    .replace(/<(script|style|nav|footer|header|aside|form|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|br)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const hex = code[0].toLowerCase() === 'x';
      const number = Number.parseInt(hex ? code.slice(1) : code, hex ? 16 : 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' ';
    })
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] || match)
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return text.slice(0, 1400);
}

async function enrichResults(results, fetchImpl) {
  const enriched = results.map((item) => ({ ...item }));
  const candidates = enriched.slice(0, 10);
  for (let offset = 0; offset < candidates.length; offset += 3) {
    await Promise.all(candidates.slice(offset, offset + 3).map(async (item) => {
      const url = publicPageUrl(item.url);
      if (!url) return;
      try {
        const response = await fetchImpl(url, {
          headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 AI-Jena-WebSearch/1.0' },
          redirect: 'error', signal: AbortSignal.timeout(6000),
        });
        if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return;
        const reader = response.body && response.body.getReader ? response.body.getReader() : null;
        let html = '';
        if (reader) {
          const decoder = new TextDecoder();
          while (html.length < 160000) {
            const chunk = await reader.read();
            if (chunk.done) break;
            html += decoder.decode(chunk.value, { stream: true });
          }
          await reader.cancel().catch(() => {});
        } else {
          html = String(await response.text()).slice(0, 160000);
        }
        const excerpt = pageExcerpt(html);
        if (excerpt.length >= 120) item.content = excerpt;
      } catch { /* Keep the search snippet when a page cannot be fetched. */ }
    }));
  }
  return enriched;
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
          const result = await fetchImpl(upstream, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
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
        results = await enrichResults(results, fetchImpl);
        return sendJson(response, 200, { ok: true, engine: results[0].engine, fallbackUsed: warnings.length > 0, fallbackMessage: warnings.length ? '이전 검색 공급자 실패 후 다음 공급자를 사용했습니다.' : '', query, warnings, results });
      } catch (error) { warnings.push(`${engine}: ${error && error.message ? error.message : error}`); }
    }
    return sendJson(response, 502, { ok: false, error: `인터넷 검색 중계 실패: ${warnings.join(' · ') || '사용 가능한 검색 공급자가 없습니다.'}` });
  };
}

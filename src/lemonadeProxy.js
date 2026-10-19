import http from 'node:http';
import https from 'node:https';

const PROXY_PREFIX = '/api/lemonade';
const DEFAULT_BASE_URL = 'http://localhost:13305/api/v1';
const DEFAULT_MODEL = 'Gemma-4-E4B-it-GGUF';
const DEFAULT_IMAGE_MODEL = 'Flux-2-Klein-4B';

const json = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
};

function normalizeLoopbackBaseUrl(value) {
  const parsed = new URL(String(value || DEFAULT_BASE_URL));
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'http:' || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
    throw new Error('LEMONADE_BASE_URL은 이 컴퓨터의 http://localhost 주소만 사용할 수 있습니다.');
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

export function createLemonadeProxyMiddleware(options = {}) {
  const baseUrl = normalizeLoopbackBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
  const defaultModel = String(options.defaultModel || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const defaultImageModel = String(options.defaultImageModel || DEFAULT_IMAGE_MODEL).trim() || DEFAULT_IMAGE_MODEL;

  return (req, res, next) => {
    const incoming = new URL(req.url, 'http://localhost');
    if (incoming.pathname === `${PROXY_PREFIX}/config`) {
      if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET 요청만 허용됩니다.' });
      return json(res, 200, { ok: true, baseUrl, proxyBaseUrl: `${PROXY_PREFIX}/v1`, defaultModel, defaultImageModel });
    }
    if (!incoming.pathname.startsWith(`${PROXY_PREFIX}/v1/`) && incoming.pathname !== `${PROXY_PREFIX}/v1`) return next();
    if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
      return json(res, 405, { ok: false, error: '허용되지 않은 Lemonade 요청입니다.' });
    }

    const suffix = incoming.pathname.slice(`${PROXY_PREFIX}/v1`.length);
    const target = new URL(baseUrl + suffix + incoming.search);
    const transport = target.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: target.host };
    delete headers.origin;
    delete headers.referer;

    const upstream = transport.request(target, { method: req.method, headers }, upstreamResponse => {
      res.statusCode = upstreamResponse.statusCode || 502;
      Object.entries(upstreamResponse.headers).forEach(([name, value]) => {
        if (value !== undefined && !['access-control-allow-origin', 'content-length'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });
      res.setHeader('Cache-Control', 'no-store');
      upstreamResponse.pipe(res);
    });
    upstream.setTimeout(610_000, () => upstream.destroy(new Error('Lemonade 응답 시간이 초과되었습니다.')));
    upstream.on('error', error => {
      if (!res.headersSent) json(res, 502, { ok: false, error: `Lemonade 연결 실패: ${error.message}` });
      else res.destroy(error);
    });
    req.pipe(upstream);
  };
}

export const lemonadeDefaults = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  defaultModel: DEFAULT_MODEL,
  defaultImageModel: DEFAULT_IMAGE_MODEL,
  proxyPrefix: PROXY_PREFIX,
});

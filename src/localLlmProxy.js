import http from 'node:http';

const PREFIX = '/api/local-llm';
const isLoopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const LM_PATHS = ['/api/v1/models', '/api/v1/models/load', '/api/v1/models/unload', '/api/v1/chat', '/v1/models', '/v1/chat/completions'];
const OLLAMA_PATHS = ['/api/tags', '/api/ps', '/api/show', '/api/generate', '/api/chat'];

export function createLocalLlmProxyMiddleware() {
  return (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(PREFIX + '/')) return next();
    const reject = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: message }));
    };
    let host;
    try { host = new URL('http://' + req.headers.host); }
    catch { return reject(403, 'Invalid host'); }
    if (!isLoopback(host.hostname)) return reject(403, 'Loopback app only');
    const origin = req.headers.origin;
    if ((origin && origin !== 'http://' + req.headers.host && origin !== 'https://' + req.headers.host)
        || req.headers['sec-fetch-site'] === 'cross-site') return reject(403, 'Same origin only');
    if (url.pathname === PREFIX + '/config') {
      if (req.method !== 'GET') return reject(405, 'GET only');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ localLlmProxy: true }));
    }
    const match = url.pathname.match(/^\/api\/local-llm\/(1234|5678|11434)(\/(?:api|v1)\/[a-zA-Z0-9/_-]+)$/);
    if (!match || !['GET', 'POST'].includes(req.method)) return reject(404, 'Unsupported local LLM route');
    const paths = match[1] === '11434' ? OLLAMA_PATHS : LM_PATHS;
    if (!paths.includes(match[2])) return reject(404, 'Unsupported local LLM route');
    const headers = {};
    for (const key of ['content-type', 'accept', 'authorization']) {
      if (req.headers[key]) headers[key] = req.headers[key];
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: Number(match[1]), path: match[2] + url.search, method: req.method, headers
    }, response => {
      res.writeHead(response.statusCode || 502, {
        'Content-Type': response.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store'
      });
      response.pipe(res);
    });
    upstream.setTimeout(610000, () => upstream.destroy(new Error('Local model timeout')));
    upstream.on('error', error => {
      if (!res.headersSent) reject(502, error.message);
      else res.destroy(error);
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
}

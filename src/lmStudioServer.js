import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const API_PATH = '/api/lmstudio-server/configure';
const execFileAsync = promisify(execFile);

const json = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
};

const readJson = (req) => new Promise((resolveBody, reject) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 4096) reject(new Error('요청이 너무 큽니다.'));
  });
  req.on('end', () => {
    try { resolveBody(JSON.parse(body || '{}')); } catch { reject(new Error('잘못된 JSON 요청입니다.')); }
  });
  req.on('error', reject);
});

const isLoopbackAddress = (address) => {
  const value = String(address || '').toLowerCase();
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
};

const isLoopbackOrigin = (origin) => {
  try {
    const hostname = new URL(String(origin || '')).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
};

async function runLmsServerCommand(args) {
  return execFileAsync('lms', args, { windowsHide: true, timeout: 30_000 });
}

export function createLMStudioServerMiddleware(options = {}) {
  const run = options.run || runLmsServerCommand;
  return async (req, res, next) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (requestUrl.pathname !== API_PATH) return next();
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST 요청만 허용됩니다.' });
    if (!isLoopbackAddress(req.socket?.remoteAddress) || !isLoopbackOrigin(req.headers.origin)) {
      return json(res, 403, { ok: false, error: '이 기능은 이 컴퓨터의 로컬 브라우저에서만 사용할 수 있습니다.' });
    }
    if (req.headers['x-mdpro-local-action'] !== 'lmstudio-server') {
      return json(res, 403, { ok: false, error: '로컬 작업 확인 헤더가 없습니다.' });
    }
    try {
      const body = await readJson(req);
      const port = Number(body.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return json(res, 400, { ok: false, error: 'LM Studio 포트가 올바르지 않습니다.' });
      }
      try { await run(['server', 'stop']); } catch (_) {}
      const args = ['server', 'start', '--port', String(port)];
      if (body.serveOnLocalNetwork === true) args.push('--bind', '0.0.0.0');
      if (body.enableCors === true) args.push('--cors');
      await run(args);
      return json(res, 200, {
        ok: true,
        port,
        serveOnLocalNetwork: body.serveOnLocalNetwork === true,
        enableCors: body.enableCors === true
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error?.message || String(error) });
    }
  };
}

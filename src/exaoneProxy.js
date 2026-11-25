// Fixed EXAONE relay for WebDAV Vite dev/preview.
// Production needs an authenticated same-origin relay; do not weaken these loopback checks.
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const ROUTE = '/api/exaone/chat/completions';
const UPSTREAM = 'https://api.exaone.ai/v1/chat/completions';
const loopback = host => ['127.0.0.1', 'localhost', '[::1]', '::1', '::ffff:127.0.0.1'].includes(host);
export function createExaoneProxyMiddleware({ fetchImpl = globalThis.fetch, timeoutMs = 3600000 } = {}) {
    return async (req, res, next) => {
        if (new URL(req.url, 'http://localhost').pathname !== ROUTE) return next();
        const fail = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: { message } })); };
        let host;
        try { host = new URL('http://' + req.headers.host); } catch { return fail(403, 'Invalid host'); }
        if (!loopback(host.hostname) || !loopback(req.socket.remoteAddress)) return fail(403, 'Loopback development app only');
        if (req.headers.origin && !['http://' + req.headers.host, 'https://' + req.headers.host].includes(req.headers.origin)) return fail(403, 'Same origin only');
        if (req.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'Same origin only');
        if (req.method !== 'POST') return fail(405, 'POST only');
        if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return fail(415, 'JSON only');
        const authorization = String(req.headers.authorization || '');
        if (!/^Bearer\s+\S+$/i.test(authorization)) return fail(401, 'EXAONE API Key가 필요합니다.');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(3600000, Math.max(30000, timeoutMs)));
        const abort = () => controller.abort();
        req.once('aborted', abort);
        res.once('close', () => { if (!res.writableEnded) abort(); });
        try {
            const chunks = []; let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 16 * 1024 * 1024) return fail(413, 'Request exceeds 16 MiB');
                chunks.push(chunk);
            }
            const body = Buffer.concat(chunks);
            try { JSON.parse(body.toString('utf8')); } catch { return fail(400, 'Invalid JSON'); }
            const upstream = await fetchImpl(UPSTREAM, { method: 'POST', redirect: 'manual', signal: controller.signal,
                headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: req.headers.accept || 'application/json' }, body });
            if (upstream.status >= 300 && upstream.status < 400) { await upstream.body?.cancel(); return fail(502, 'EXAONE redirect refused'); }
            const headers = { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' };
            for (const name of ['retry-after','retry-after-ms','x-second-rate-limit-remaining','x-minute-rate-limit-remaining','x-day-rate-limit-remaining','x-request-id']) {
                const value = upstream.headers.get(name); if (value != null) headers[name] = value;
            }
            res.writeHead(upstream.status, headers); res.flushHeaders?.();
            if (upstream.body) await pipeline(Readable.fromWeb(upstream.body), res); else res.end();
        } catch (_) {
            if (res.headersSent) res.destroy();
            else if (!res.destroyed) fail(502, controller.signal.aborted ? 'EXAONE 요청이 취소되었거나 제한시간을 초과했습니다.' : 'EXAONE upstream connection failed');
        } finally { clearTimeout(timeout); req.removeListener('aborted', abort); }
    };
}

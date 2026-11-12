import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// MDpro uses classic scripts and inline handlers. Serve its runtime JavaScript
// unchanged, as closeBundle does in production, before Vite's module transform.
export function createMdproScriptMiddleware({ root = resolve('mdpro'), base = '/' } = {}) {
  const prefix = `${base.replace(/\/+$/, '')}/mdpro/`;
  return async function mdproScripts(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const pathname = (req.url || '').split('?')[0];
    if (!pathname.startsWith(prefix) || !/\.m?js$/i.test(pathname)) return next();
    try {
      const name = decodeURIComponent(pathname.slice(prefix.length));
      const runtimeRoot = await realpath(root);
      const file = await realpath(resolve(runtimeRoot, name));
      const inside = relative(runtimeRoot, file);
      if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) {
        res.statusCode = 403;
        return res.end('Forbidden');
      }
      const body = await readFile(file);
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      res.statusCode = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500;
      res.end('MDpro script unavailable');
    }
  };
}

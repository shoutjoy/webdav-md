import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHARE_API_PATH = '/api/webdav-shares';
const dataDirectory = resolve('.webdav-share-data');
const keyPath = resolve(dataDirectory, 'key');
const storePath = resolve(dataDirectory, 'shares.enc');

const loadKey = () => {
  mkdirSync(dataDirectory, { recursive: true });
  if (process.env.WEBDAV_SHARE_SECRET) return createHash('sha256').update(process.env.WEBDAV_SHARE_SECRET).digest();
  if (existsSync(keyPath)) return Buffer.from(readFileSync(keyPath, 'utf8'), 'base64');
  const key = randomBytes(32);
  writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
  return key;
};

const encryptionKey = loadKey();
const decryptStore = () => {
  if (!existsSync(storePath)) return new Map();
  try {
    const payload = JSON.parse(readFileSync(storePath, 'utf8'));
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
    return new Map(JSON.parse(plain).map(([id, share]) => [id, { ...share, passwordHash: Buffer.from(share.passwordHash, 'base64') }]));
  } catch { return new Map(); }
};
const shares = decryptStore();
const persistShares = () => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const serializable = [...shares].map(([id, share]) => [id, { ...share, passwordHash: share.passwordHash.toString('base64') }]);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(serializable)), cipher.final()]);
  writeFileSync(storePath, JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 });
};

const json = (res, status, value) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
};

const readJson = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 64 * 1024) reject(new Error('요청이 너무 큽니다.'));
  });
  req.on('end', () => {
    try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('잘못된 JSON 요청입니다.')); }
  });
  req.on('error', reject);
});

const passwordDigest = (password, salt) => createHash('sha256').update(`${salt}:${password}`).digest();

const verifyPassword = (share, password) => {
  if (share.mode === 'openShare') return true;
  const actual = passwordDigest(String(password || ''), share.passwordSalt);
  return actual.length === share.passwordHash.length && timingSafeEqual(actual, share.passwordHash);
};

const remoteFileUrl = (share) => {
  const base = share.webdavUrl.replace(/\/$/, '');
  const encodedPath = share.remotePath.split('/').map((part, index) => index === 0 ? '' : encodeURIComponent(part)).join('/');
  return `${base}${encodedPath}`;
};

const fetchSharedFile = (share) => fetch(remoteFileUrl(share), {
  headers: { Authorization: `Basic ${Buffer.from(`${share.username}:${share.webdavPassword}`).toString('base64')}` },
});

export function createShareMiddleware() {
  return async (req, res, next) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (!requestUrl.pathname.startsWith(SHARE_API_PATH)) return next();

    try {
      if (req.method === 'POST' && requestUrl.pathname === SHARE_API_PATH) {
        const body = await readJson(req);
        const mode = body.mode === 'openShare' ? 'openShare' : 'pwShare';
        if (!body.webdavUrl || !body.username || !body.webdavPassword || !body.remotePath) {
          return json(res, 400, { error: 'WebDAV 연결 정보와 파일 경로가 필요합니다.' });
        }
        if (mode === 'pwShare' && !String(body.sharePassword || '').trim()) {
          return json(res, 400, { error: 'pwShare에는 공유 비밀번호가 필요합니다.' });
        }
        const candidate = {
          webdavUrl: String(body.webdavUrl), username: String(body.username), webdavPassword: String(body.webdavPassword),
          remotePath: String(body.remotePath), name: String(body.name || body.remotePath.split('/').pop() || '공유 문서'), mode,
        };
        const upstream = await fetchSharedFile(candidate);
        if (!upstream.ok) return json(res, upstream.status === 401 ? 401 : 502, { error: 'WebDAV 파일을 확인할 수 없습니다.' });
        upstream.body?.cancel();
        const id = randomBytes(18).toString('base64url');
        const passwordSalt = randomBytes(16).toString('hex');
        shares.set(id, {
          ...candidate, passwordSalt,
          passwordHash: passwordDigest(String(body.sharePassword || ''), passwordSalt),
          createdAt: Date.now(),
        });
        persistShares();
        return json(res, 201, { id, mode, name: candidate.name });
      }

      const match = requestUrl.pathname.match(/^\/api\/webdav-shares\/([A-Za-z0-9_-]+)(?:\/(content))?$/);
      if (!match || req.method !== 'GET') return json(res, 404, { error: '공유 링크를 찾을 수 없습니다.' });
      const share = shares.get(match[1]);
      if (!share) return json(res, 404, { error: '공유 링크가 없거나 서버가 재시작되어 만료되었습니다.' });
      const suppliedPassword = req.headers['x-share-password'] || '';
      if (!verifyPassword(share, suppliedPassword)) return json(res, 401, { error: '공유 비밀번호가 올바르지 않습니다.', passwordRequired: true });
      if (!match[2]) return json(res, 200, { name: share.name, mode: share.mode, createdAt: share.createdAt });

      const upstream = await fetchSharedFile(share);
      if (!upstream.ok) return json(res, upstream.status, { error: '공유 파일을 읽지 못했습니다.' });
      const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      json(res, 500, { error: error?.message || '공유 처리 중 오류가 발생했습니다.' });
    }
  };
}

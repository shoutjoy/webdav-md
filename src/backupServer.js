import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import JSZip from 'jszip';
import { createClient } from 'webdav';

const API_PATH = '/api/webdav-backups';
const dataDirectory = resolve('.webdav-backup-data');
const backupDirectory = resolve(dataDirectory, 'archives');
const automaticBackupDirectory = resolve(backupDirectory, 'automatic');
const manualBackupDirectory = resolve(backupDirectory, 'manual');
const keyPath = resolve(dataDirectory, 'key');
const configPath = resolve(dataDirectory, 'config.enc');
const historyPath = resolve(dataDirectory, 'history.json');
const remoteBackupRoot = '/.webdav-backups';

mkdirSync(automaticBackupDirectory, { recursive: true });
mkdirSync(manualBackupDirectory, { recursive: true });

const loadKey = () => {
  if (process.env.WEBDAV_BACKUP_SECRET) return createHash('sha256').update(process.env.WEBDAV_BACKUP_SECRET).digest();
  if (existsSync(keyPath)) return Buffer.from(readFileSync(keyPath, 'utf8'), 'base64');
  const key = randomBytes(32);
  writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
  return key;
};

const encryptionKey = loadKey();
const encrypt = (value) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
};
const decrypt = (payload) => {
  const parsed = JSON.parse(payload);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(parsed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]).toString('utf8'));
};

const loadConfig = () => {
  try { return decrypt(readFileSync(configPath, 'utf8')); } catch { return { enabled: false, time: '02:00' }; }
};
const saveConfig = (value) => writeFileSync(configPath, encrypt(value), { mode: 0o600 });
const loadHistory = () => {
  try { return JSON.parse(readFileSync(historyPath, 'utf8')); } catch { return []; }
};
const saveHistory = (value) => writeFileSync(historyPath, JSON.stringify(value, null, 2));

let config = loadConfig();
let history = loadHistory();
let running = false;

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
    if (body.length > 64 * 1024) reject(new Error('요청이 너무 큽니다.'));
  });
  req.on('end', () => {
    try { resolveBody(JSON.parse(body || '{}')); } catch { reject(new Error('잘못된 JSON 요청입니다.')); }
  });
  req.on('error', reject);
});

const publicConfig = () => ({
  enabled: Boolean(config.enabled),
  time: /^([01]\d|2[0-3]):[0-5]\d$/.test(config.time || '') ? config.time : '02:00',
  configured: Boolean(config.webdavUrl && config.username && config.password),
  running,
  lastRunAt: history[0]?.startedAt || null,
  notificationEmail: config.notificationEmail || 'shoutjoy1@gmail.com',
  emailServiceConfigured: Boolean(process.env.RESEND_API_KEY && process.env.WEBDAV_BACKUP_FROM_EMAIL),
  retentionCount: Math.max(1, Number(config.retentionCount) || 30),
});

const safeZipPath = (remotePath) => remotePath.split('/').filter(Boolean).map(part => part.replace(/[\\:*?"<>|]/g, '_')).join('/');

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const jobs = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  });
  await Promise.all(jobs);
}

const webdavDownloadUrl = (item) => `${String(config.webdavUrl || '').replace(/\/$/, '')}${item.remotePath.split('/').map((part, index) => index === 0 ? '' : encodeURIComponent(part)).join('/')}`;

async function sendBackupEmail(item) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WEBDAV_BACKUP_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('메일 발송 환경변수 RESEND_API_KEY와 WEBDAV_BACKUP_FROM_EMAIL이 필요합니다.');
  const recipient = config.notificationEmail || 'shoutjoy1@gmail.com';
  const link = webdavDownloadUrl(item);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [recipient], subject: `[WebDAV] ${item.fileName} 백업 완료`,
      text: `WebDAV 전체 백업이 완료되었습니다.\n\n파일: ${item.fileName}\n파일 수: ${item.fileCount}\n크기: ${item.size} bytes\n완료 시각: ${item.completedAt}\n\n백업 다운로드: ${link}\n\n평소 사용하는 WebDAV 계정으로 접속하면 이 ZIP 백업본을 다운로드할 수 있습니다.`,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `메일 발송 실패 (${response.status})`);
  }
  return { recipient, link };
}

async function notifyScheduledBackup(item) {
  try {
    const sent = await sendBackupEmail(item);
    Object.assign(item, { notificationStatus: 'sent', notificationEmail: sent.recipient, notificationSentAt: new Date().toISOString() });
  } catch (error) {
    Object.assign(item, { notificationStatus: 'failed', notificationError: error?.message || String(error) });
    console.error('WebDAV 백업 완료 메일 발송 실패:', error);
  }
  saveHistory(history);
}

const currentArchivePath = (item) => resolve(item.trigger === 'schedule' ? automaticBackupDirectory : manualBackupDirectory, basename(item.fileName));
const existingArchivePath = (item) => {
  const current = currentArchivePath(item);
  if (existsSync(current)) return current;
  return resolve(backupDirectory, basename(item.fileName)); // Backward compatibility for backups made before storage separation.
};

function expiredAutomaticBackups(items, retentionCount) {
  return items
    .filter(item => item.trigger === 'schedule' && item.status === 'success')
    .sort((left, right) => new Date(right.completedAt || right.startedAt) - new Date(left.completedAt || left.startedAt))
    .slice(Math.max(1, Number(retentionCount) || 30));
}

async function rotateAutomaticBackups(client) {
  const expiredIds = new Set();
  for (const item of expiredAutomaticBackups(history, config.retentionCount)) {
    const path = existingArchivePath(item);
    if (existsSync(path)) unlinkSync(path);
    if (item.remotePath && await client.exists(item.remotePath)) await client.deleteFile(item.remotePath);
    expiredIds.add(item.id);
  }
  if (expiredIds.size) {
    history = history.filter(item => !expiredIds.has(item.id));
    saveHistory(history);
  }
}

async function createBackup(trigger = 'schedule') {
  if (running) throw new Error('백업이 이미 진행 중입니다.');
  if (!config.webdavUrl || !config.username || !config.password) throw new Error('WebDAV 백업 접속 정보가 설정되지 않았습니다.');
  running = true;
  const startedAt = new Date().toISOString();
  const id = `${startedAt.replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
  const fileName = `webdav-backup-${startedAt.slice(0, 10)}-${startedAt.slice(11, 19).replace(/:/g, '')}.zip`;
  const archivePath = resolve(trigger === 'schedule' ? automaticBackupDirectory : manualBackupDirectory, fileName);
  try {
    const client = createClient(config.webdavUrl.replace(/\/$/, ''), { username: config.username, password: config.password });
    const entries = await client.getDirectoryContents('/', { deep: true });
    const sourceEntries = entries.filter(entry => entry.filename !== remoteBackupRoot && !entry.filename.startsWith(`${remoteBackupRoot}/`));
    const files = sourceEntries.filter(entry => entry.type === 'file');
    const directories = sourceEntries.filter(entry => entry.type === 'directory');
    const zip = new JSZip();
    directories.forEach(entry => {
      const path = safeZipPath(entry.filename);
      if (path) zip.folder(path);
    });
    await mapLimit(files, 4, async entry => {
      const content = await client.getFileContents(entry.filename, { format: 'binary' });
      zip.file(safeZipPath(entry.filename), content);
    });
    zip.file('_webdav-backup.json', JSON.stringify({ createdAt: startedAt, source: config.webdavUrl, fileCount: files.length }, null, 2));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    writeFileSync(archivePath, buffer);
    const remoteTypeDirectory = `${remoteBackupRoot}/${trigger === 'schedule' ? 'automatic' : 'manual'}`;
    if (!await client.exists(remoteBackupRoot)) await client.createDirectory(remoteBackupRoot);
    if (!await client.exists(remoteTypeDirectory)) await client.createDirectory(remoteTypeDirectory);
    const remotePath = `${remoteTypeDirectory}/${fileName}`;
    await client.putFileContents(remotePath, buffer, { overwrite: false });
    const item = { id, fileName, remotePath, startedAt, completedAt: new Date().toISOString(), trigger, status: 'success', fileCount: files.length, size: buffer.length };
    history = [item, ...history];
    saveHistory(history);
    if (trigger === 'schedule') {
      await notifyScheduledBackup(item);
      try {
        await rotateAutomaticBackups(client);
      } catch (error) {
        item.rotationError = error?.message || String(error);
        saveHistory(history);
        console.error('오래된 WebDAV 자동 백업 정리 실패:', error);
      }
    }
    return item;
  } catch (error) {
    if (existsSync(archivePath)) unlinkSync(archivePath);
    const item = { id, fileName, startedAt, completedAt: new Date().toISOString(), trigger, status: 'failed', error: error?.message || String(error) };
    history = [item, ...history];
    saveHistory(history);
    throw error;
  } finally {
    running = false;
  }
}

let lastScheduledDate = '';
const scheduler = setInterval(() => {
  if (!config.enabled || running) return;
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (time === config.time && date !== lastScheduledDate) {
    lastScheduledDate = date;
    createBackup('schedule').catch(error => console.error('예약 WebDAV 백업 실패:', error));
  }
}, 30_000);
scheduler.unref?.();

export function createBackupMiddleware() {
  return async (req, res, next) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (!requestUrl.pathname.startsWith(API_PATH)) return next();
    try {
      if (req.method === 'GET' && requestUrl.pathname === `${API_PATH}/config`) return json(res, 200, publicConfig());
      if (req.method === 'PUT' && requestUrl.pathname === `${API_PATH}/config`) {
        const body = await readJson(req);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time || '')) return json(res, 400, { error: '백업 시간 형식이 올바르지 않습니다.' });
        const nextConfig = {
          ...config,
          enabled: Boolean(body.enabled),
          time: body.time,
          notificationEmail: String(body.notificationEmail || 'shoutjoy1@gmail.com').trim(),
          retentionCount: Math.max(1, Math.min(9999, Number.parseInt(body.retentionCount, 10) || 30)),
          ...(body.webdavUrl && body.username && body.password ? {
            webdavUrl: String(body.webdavUrl).replace(/\/$/, ''), username: String(body.username), password: String(body.password),
          } : {}),
        };
        if (nextConfig.enabled && (!nextConfig.webdavUrl || !nextConfig.username || !nextConfig.password)) return json(res, 400, { error: '자동 백업을 켜려면 WebDAV에 먼저 로그인해야 합니다.' });
        config = nextConfig;
        saveConfig(config);
        return json(res, 200, publicConfig());
      }
      if (req.method === 'POST' && requestUrl.pathname === `${API_PATH}/run`) {
        const body = await readJson(req);
        if (body.webdavUrl && body.username && body.password) {
          config = { ...config, webdavUrl: String(body.webdavUrl).replace(/\/$/, ''), username: String(body.username), password: String(body.password) };
          saveConfig(config);
        }
        const result = await createBackup('manual');
        return json(res, 201, result);
      }
      if (req.method === 'GET' && requestUrl.pathname === `${API_PATH}/history`) {
        const items = history.map(item => ({ ...item, available: item.status === 'success' && existsSync(existingArchivePath(item)) }));
        return json(res, 200, { running, items });
      }
      const downloadMatch = requestUrl.pathname.match(/^\/api\/webdav-backups\/([^/]+)\/download$/);
      if (req.method === 'GET' && downloadMatch) {
        const item = history.find(entry => entry.id === decodeURIComponent(downloadMatch[1]) && entry.status === 'success');
        if (!item) return json(res, 404, { error: '백업 파일을 찾을 수 없습니다.' });
        const path = existingArchivePath(item);
        if (!existsSync(path) || !statSync(path).isFile()) return json(res, 404, { error: '백업 파일이 삭제되었거나 이동되었습니다.' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${basename(item.fileName)}"`);
        res.setHeader('Content-Length', statSync(path).size);
        res.end(readFileSync(path));
        return;
      }
      return json(res, 404, { error: '백업 API를 찾을 수 없습니다.' });
    } catch (error) {
      return json(res, running ? 409 : 500, { error: error?.message || '백업 처리 중 오류가 발생했습니다.' });
    }
  };
}

export const __backupTest = { safeZipPath, mapLimit, webdavDownloadUrl, expiredAutomaticBackups };

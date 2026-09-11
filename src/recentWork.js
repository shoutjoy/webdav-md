import { createDirectoryVerified, saveFileVerified } from './webdavMoveEngine.js';

export const recentWorkKey = (url, username) =>
  `webdav-recent-work-v1:${JSON.stringify([url.trim().replace(/\/+$/, ''), username])}`;

export const MAX_RECENT_WORK_ITEMS = 50;
export const DEFAULT_RECENT_WORK_VISIBLE_COUNT = 10;
export const RECENT_WORK_VISIBLE_COUNT_KEY = 'webdav-recent-work-visible-count';
export const RECENT_WORK_AUTO_OPEN_KEY = 'webdav-recent-work-auto-open';
export const RECENT_WORK_WEBDAV_FOLDER = '/.webdav_temp';
export const RECENT_WORK_WEBDAV_PATH = `${RECENT_WORK_WEBDAV_FOLDER}/recent-work.json`;

export function readRecentWorkVisibleCount(storage) {
  const saved = Number.parseInt(storage.getItem(RECENT_WORK_VISIBLE_COUNT_KEY), 10);
  return Number.isFinite(saved)
    ? Math.min(MAX_RECENT_WORK_ITEMS, Math.max(1, saved))
    : DEFAULT_RECENT_WORK_VISIBLE_COUNT;
}

export function shouldAutoOpenRecentWork(storage) {
  return storage.getItem(RECENT_WORK_AUTO_OPEN_KEY) !== 'false';
}

export function setRecentWorkAutoOpen(storage, enabled) {
  storage.setItem(RECENT_WORK_AUTO_OPEN_KEY, String(Boolean(enabled)));
}

const normalizeRecentWorkItems = (items, limit = MAX_RECENT_WORK_ITEMS) => Array.isArray(items) ? items.filter(item =>
  item && typeof item.name === 'string' && typeof item.remotePath === 'string'
  && Number.isFinite(item.updatedAt)
  && (!item.isArchiveEntry || (typeof item.archiveRemotePath === 'string' && typeof item.archivePath === 'string')),
).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit) : [];

export function mergeRecentWorkItems(...groups) {
  const byPath = new Map();
  normalizeRecentWorkItems(groups.flat(), Number.POSITIVE_INFINITY).forEach((item) => {
    if (!byPath.has(item.remotePath)) byPath.set(item.remotePath, item);
  });
  return Array.from(byPath.values()).slice(0, MAX_RECENT_WORK_ITEMS);
}

export function readRecentWork(storage, key) {
  try {
    const items = JSON.parse(storage.getItem(key) || '[]');
    return normalizeRecentWorkItems(items);
  } catch { return []; }
}

export function writeRecentWork(storage, key, items) {
  const normalized = normalizeRecentWorkItems(items);
  storage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export function recordRecentWork(storage, key, file) {
  const item = {
    name: file.name, remotePath: file.remotePath, updatedAt: Date.now(),
    ...(file.isArchiveEntry ? {
      isArchiveEntry: true, archiveRemotePath: file.archiveRemotePath, archivePath: file.archivePath,
    } : {}),
  };
  return writeRecentWork(storage, key, [item, ...readRecentWork(storage, key).filter(entry => entry.remotePath !== item.remotePath)]);
}

export async function readRecentWorkFromWebDav(client) {
  if (!client || !await client.exists(RECENT_WORK_WEBDAV_PATH)) return [];
  const content = await client.getFileContents(RECENT_WORK_WEBDAV_PATH, { format: 'text' });
  return normalizeRecentWorkItems(JSON.parse(String(content || '[]')));
}

export async function writeRecentWorkToWebDav(client, items) {
  if (!client) return [];
  if (!await client.exists(RECENT_WORK_WEBDAV_FOLDER)) {
    await createDirectoryVerified(client, RECENT_WORK_WEBDAV_FOLDER);
  }
  const normalized = normalizeRecentWorkItems(items);
  await saveFileVerified(client, RECENT_WORK_WEBDAV_PATH, JSON.stringify(normalized, null, 2), {
    overwrite: true,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return normalized;
}

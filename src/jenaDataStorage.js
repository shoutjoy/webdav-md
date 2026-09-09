import { normalizeRemotePath } from './webdavPaths.js';
import { createDirectoryVerified } from './webdavMoveEngine.js';

export async function saveJenaRecord(client, record) {
  if (!client) throw new Error('WebDAV에 연결한 후 다시 시도하세요.');
  if (!record || typeof record.id !== 'string' || !record.id) throw new Error('AI 기록 ID가 없습니다.');
  // Encode the entire ID without collisions, including on HTTP NAS deployments.
  const bytes = new TextEncoder().encode(record.id);
  if (bytes.length > 120) throw new Error('AI 기록 ID가 너무 깁니다.');
  const name = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const folder = '/JENA_DATA';
  if (!await client.exists(folder)) await createDirectoryVerified(client, folder);
  const path = `${folder}/${name}.json`;
  const saved = await client.putFileContents(path, JSON.stringify(record, null, 2), {
    overwrite: true, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  if (saved === false) throw new Error('JENA_DATA 기록 저장에 실패했습니다.');
  return { path };
}

export function isJenaDataPath(path) {
  const normalized = normalizeRemotePath(path).toUpperCase();
  return normalized === '/JENA_DATA' || normalized.startsWith('/JENA_DATA/');
}

export function isMdproMsetPath(path) {
  const normalized = normalizeRemotePath(path).toLowerCase();
  return normalized === '/.mdpro_mset' || normalized.startsWith('/.mdpro_mset/');
}

export function isWebdavTempPath(path) {
  const normalized = normalizeRemotePath(path).toLowerCase();
  return normalized === '/.webdav_temp' || normalized.startsWith('/.webdav_temp/');
}

export function visibleWebdavEntries(entries, { showHidden = false } = {}) {
  return entries.filter((entry) => {
    const path = entry.remotePath || entry.filename;
    if (isJenaDataPath(path)) return false;
    if (showHidden) return true;
    const hasHiddenSegment = normalizeRemotePath(path)
      .split('/')
      .filter(Boolean)
      .some((segment) => segment.startsWith('.'));
    return !hasHiddenSegment && !isMdproMsetPath(path) && !isWebdavTempPath(path);
  });
}

export async function readJenaRecords(client) {
  if (!client) throw new Error('WebDAV에 연결한 후 다시 시도하세요.');
  if (!await client.exists('/JENA_DATA')) return [];
  const entries = await client.getDirectoryContents('/JENA_DATA');
  const records = [];
  for (const entry of entries) {
    const path = normalizeRemotePath(entry.filename);
    if (entry.type === 'directory' || !/^\/JENA_DATA\/[a-f0-9]+\.json$/.test(path)) continue;
    const record = JSON.parse(await client.getFileContents(path, { format: 'text' }));
    if (record && typeof record.id === 'string' && !record.deleted) records.push(record);
  }
  return records;
}

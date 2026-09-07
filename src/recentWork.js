export const recentWorkKey = (url, username) =>
  `webdav-recent-work-v1:${JSON.stringify([url.trim().replace(/\/+$/, ''), username])}`;

export function readRecentWork(storage, key) {
  try {
    const items = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(items) ? items.filter(item =>
      item && typeof item.name === 'string' && typeof item.remotePath === 'string'
      && Number.isFinite(item.updatedAt)
      && (!item.isArchiveEntry || (typeof item.archiveRemotePath === 'string' && typeof item.archivePath === 'string')),
    ).slice(0, 5) : [];
  } catch { return []; }
}

export function recordRecentWork(storage, key, file) {
  const item = {
    name: file.name, remotePath: file.remotePath, updatedAt: Date.now(),
    ...(file.isArchiveEntry ? {
      isArchiveEntry: true, archiveRemotePath: file.archiveRemotePath, archivePath: file.archivePath,
    } : {}),
  };
  const items = [item, ...readRecentWork(storage, key).filter(entry => entry.remotePath !== item.remotePath)].slice(0, 5);
  storage.setItem(key, JSON.stringify(items));
  return items;
}

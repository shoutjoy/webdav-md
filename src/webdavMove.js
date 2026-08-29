import { normalizeRemotePath } from './webdavPaths.js';

const COPY_DELETE_FALLBACK_STATUSES = new Set([400, 403, 405, 409, 423, 500, 501, 502, 503]);

export const shouldFallbackToCopyDelete = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  if (!status) return true;
  return COPY_DELETE_FALLBACK_STATUSES.has(status);
};

export const collectDirectoryEntries = async (client, sourcePath) => {
  const rootPath = normalizeRemotePath(sourcePath);
  const entries = [];
  const visited = new Set();

  const walk = async (directoryPath) => {
    const normalizedDirectory = normalizeRemotePath(directoryPath);
    if (visited.has(normalizedDirectory)) return;
    visited.add(normalizedDirectory);

    const children = await client.getDirectoryContents(normalizedDirectory);
    for (const child of children) {
      const childPath = normalizeRemotePath(child.filename);
      if (childPath === normalizedDirectory || !childPath.startsWith(`${rootPath}/`)) continue;
      entries.push({ ...child, filename: childPath });
      if (child.type === 'directory') await walk(childPath);
    }
  };

  await walk(rootPath);
  return entries;
};

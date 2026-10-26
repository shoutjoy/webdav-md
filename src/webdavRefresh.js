import { normalizeRemotePath } from './webdavPaths.js';

// Only list known folders requested by the explorer; never traverse archive contents.
export function getRefreshPaths(tree, requestedPaths) {
  const requested = new Set(['/', ...requestedPaths].map(normalizeRemotePath));
  const paths = [];
  function visit(node) {
    const path = normalizeRemotePath(node.path || node.remotePath);
    if (requested.has(path)) paths.push(path);
    for (const entry of node.entries || []) if (entry.isDirectory) visit(entry);
  }
  visit(tree);
  return paths;
}

// Add discoveries without replacing existing nodes, cached archives or editor data.
export function mergeDirectoryAdditions(tree, targetPath, incoming) {
  let added = 0;
  function visit(node) {
    if (normalizeRemotePath(node.path || node.remotePath) === normalizeRemotePath(targetPath)) {
      const known = new Set((node.entries || []).map(entry => normalizeRemotePath(entry.remotePath)));
      const additions = incoming.filter(entry => {
        const path = normalizeRemotePath(entry.remotePath);
        if (known.has(path) || path === normalizeRemotePath(targetPath)) return false;
        known.add(path);
        return true;
      });
      if (!additions.length) return node;
      added += additions.length;
      const entries = [...(node.entries || []), ...additions].sort((a, b) =>
        a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : (a.isDirectory ? -1 : 1));
      return { ...node, entries };
    }
    let changed = false;
    const entries = (node.entries || []).map(entry => {
      if (!entry.isDirectory) return entry;
      const next = visit(entry);
      if (next !== entry) changed = true;
      return next;
    });
    return changed ? { ...node, entries } : node;
  }
  return { tree: visit(tree), added };
}

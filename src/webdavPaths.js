export function normalizeRemotePath(path) {
  const raw = String(path || '/').replace(/^\/+__webdav_proxy(?=\/|$)/, '');
  const segments = [];
  for (const segment of raw.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length ? `/${segments.join('/')}` : '/';
}

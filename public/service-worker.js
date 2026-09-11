const CACHE_VERSION = 'webdav-viewer-v2';
const APP_SHELL = ['./', './manifest.webmanifest', './webdav.svg', './webdav-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isPrivateRequest(url) {
  return url.pathname.includes('/__webdav_proxy') || url.pathname.includes('/api/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || isPrivateRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('./')),
    );
    return;
  }

  // Prefer the current app asset while online. Cache-first kept old MDPRO
  // scripts alive after an update, so editor fixes appeared to do nothing
  // until users manually cleared browser storage.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

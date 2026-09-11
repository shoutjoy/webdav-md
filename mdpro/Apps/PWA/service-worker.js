'use strict';

const CACHE_PREFIX = 'md-viewer-pwa-';
const CACHE_VERSION = '20260912-cache-cleanup-1';
const STATIC_CACHE = CACHE_PREFIX + 'static-' + CACHE_VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + 'runtime-' + CACHE_VERSION;
const MAX_RUNTIME_ENTRIES = 80;
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/tailwind-static.css',
  './js/app.js',
  './Apps/PWA/manifest.webmanifest',
  './Apps/PWA/icons/icon.svg',
  './Apps/PWA/icons/icon-maskable.svg',
  './Apps/PWA/pwa-settings.css',
  './Apps/PWA/pwa-settings.js'
];

async function cacheCoreAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(CORE_ASSETS.map(async function (asset) {
    try {
      await cache.add(new Request(asset, { cache: 'reload' }));
    } catch (error) {
      console.warn('[MD Viewer PWA] Core asset cache skipped:', asset, error);
    }
  }));
}

async function removeOldCaches(includeCurrent) {
  const keys = await caches.keys();
  const targets = keys.filter(function (key) {
    return key.startsWith(CACHE_PREFIX)
      && (includeCurrent || (key !== STATIC_CACHE && key !== RUNTIME_CACHE));
  });
  await Promise.all(targets.map(function (key) { return caches.delete(key); }));
  return targets.length;
}

async function matchCachedAsset(request) {
  return (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
}

async function cacheLatestRuntimeAsset(request, response) {
  const cache = await caches.open(RUNTIME_CACHE);
  const requestUrl = new URL(request.url);
  const keys = await cache.keys();
  const obsolete = keys.filter(function (cachedRequest) {
    const cachedUrl = new URL(cachedRequest.url);
    return cachedUrl.origin === requestUrl.origin
      && cachedUrl.pathname === requestUrl.pathname
      && cachedUrl.search !== requestUrl.search;
  });
  await Promise.all(obsolete.map(function (cachedRequest) { return cache.delete(cachedRequest); }));
  await cache.put(request, response);

  const currentKeys = await cache.keys();
  const overflow = Math.max(0, currentKeys.length - MAX_RUNTIME_ENTRIES);
  await Promise.all(currentKeys.slice(0, overflow).map(function (cachedRequest) {
    return cache.delete(cachedRequest);
  }));
}

self.addEventListener('install', function (event) {
  event.waitUntil(cacheCoreAssets().then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(removeOldCaches(false).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(STATIC_CACHE).then(function (cache) {
          return cache.put('./index.html', copy);
        }));
      }
      return response;
    }).catch(async function () {
      return (await caches.match(request, { ignoreSearch: true }))
        || (await caches.match('./index.html'))
        || Response.error();
    }));
    return;
  }

  const cacheableDestination = ['script', 'style', 'font'].includes(request.destination);
  if (!cacheableDestination) return;

  event.respondWith((async function () {
    const cached = await matchCachedAsset(request);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        event.waitUntil(cacheLatestRuntimeAsset(request, response.clone()));
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('message', function (event) {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'REFRESH_PWA_CACHE') {
    event.waitUntil((async function () {
      const removed = await removeOldCaches(true);
      await cacheCoreAssets();
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'PWA_CACHE_REFRESHED', removed: removed });
      }
    })());
  }
});

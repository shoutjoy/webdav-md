const basePath = import.meta.env.BASE_URL || '/';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${basePath}service-worker.js`, { scope: basePath })
      .catch((error) => console.warn('PWA service worker registration failed:', error));
  });
}

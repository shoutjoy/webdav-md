const basePath = import.meta.env.BASE_URL || '/';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.warn('Failed to clear service worker registrations:', error);
    }

    navigator.serviceWorker
      .register(`${basePath}service-worker.js`, { scope: basePath })
      .catch((error) => console.warn('PWA service worker registration failed:', error));
  });
}

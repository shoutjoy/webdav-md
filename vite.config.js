import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWebSearchMiddleware } from './src/webSearchProxy.js';

const WEB_DAV_PROXY_PATH = '/__webdav_proxy';
const WEB_DAV_TARGET = 'https://webdav.freemath.synology.me';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-mdpro-runtime',
        closeBundle() {
          cpSync(resolve('mdpro'), resolve('dist/mdpro'), { recursive: true, force: true });
        },
      },
      {
        name: 'ai-jena-web-search-proxy',
        configureServer(server) {
          server.middlewares.use(createWebSearchMiddleware({
            googleApiKey: env.GOOGLE_CUSTOM_SEARCH_API_KEY,
            googleSearchEngineId: env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
          }));
        },
        configurePreviewServer(server) {
          server.middlewares.use(createWebSearchMiddleware({
            googleApiKey: env.GOOGLE_CUSTOM_SEARCH_API_KEY,
            googleSearchEngineId: env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
          }));
        },
      },
    ],
    base: env.VITE_BASE_PATH || '/',
    server: {
      proxy: {
        [WEB_DAV_PROXY_PATH]: {
          target: WEB_DAV_TARGET,
          changeOrigin: true,
          secure: false,
          timeout: 15000,
          proxyTimeout: 15000,
          rewrite: (path) => path.replace(new RegExp(`^${WEB_DAV_PROXY_PATH}`), '') || '/',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const destination = proxyReq.getHeader('destination');
              if (typeof destination === 'string') {
                proxyReq.setHeader(
                  'destination',
                  destination.replace(/^https?:\/\/[^/]+\/__webdav_proxy/i, WEB_DAV_TARGET),
                );
              }
            });
          },
        },
      },
    },
  };
});

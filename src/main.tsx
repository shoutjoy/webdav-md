import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './pwa.js'
import { createClient } from 'webdav';

import { createBrowserRouter, RouterProvider, useLoaderData, useNavigate } from 'react-router';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
], {
  basename: import.meta.env.VITE_BASE_PATH ?? '/',
});

// 1. WebDAV loader 타입 및 함수 정의
interface WebDAVItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
}

async function webdavLoader({ params }: { params: Record<string, string> }) {
  const currentPath = params['*'] || '';
  const remotePath = currentPath ? `/${currentPath.replace(/^\/+/, '')}` : '/';
  const baseUrl = import.meta.env.VITE_WEBDAV_URL?.trim().replace(/\/$/, '');

  if (!baseUrl) {
    return { currentPath, items: [] as WebDAVItem[] };
  }

  const client = createClient(baseUrl, {
    username: import.meta.env.VITE_WEBDAV_USERNAME,
    password: import.meta.env.VITE_WEBDAV_PASSWORD,
  });

  const contents = await client.getDirectoryContents(remotePath);
  const entries = Array.isArray(contents) ? contents : contents.data;
  const items: WebDAVItem[] = entries
    .map((item: WebDAVItem) => ({
      name: item.name,
      path: item.path.replace(/^\/+/, ''),
      type: item.type === 'directory' ? 'directory' : 'file',
    }))
    .sort((a: WebDAVItem, b: WebDAVItem) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });

  return { currentPath, items };
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

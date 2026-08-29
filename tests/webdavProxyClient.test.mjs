import assert from 'node:assert/strict';
import http from 'node:http';
import { createClient } from 'webdav';

const xml = (items) => `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">${items.map(({ href, folder = false, size = 0 }) => `
  <d:response><d:href>${href}</d:href><d:propstat><d:prop>
    <d:displayname>${decodeURIComponent(href.split('/').filter(Boolean).at(-1) || 'root')}</d:displayname>
    <d:resourcetype>${folder ? '<d:collection/>' : ''}</d:resourcetype>
    <d:getcontentlength>${size}</d:getcontentlength>
  </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')}
</d:multistatus>`;

const requests = [];
const server = http.createServer((request, response) => {
  requests.push({ method: request.method, url: request.url, depth: request.headers.depth, destination: request.headers.destination });
  if (request.method === 'MOVE' || request.method === 'COPY') {
    response.writeHead(201);
    response.end();
    return;
  }
  response.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
  if (request.url === '/__webdav_proxy/') {
    response.end(request.headers.depth === 'infinity'
      ? xml([{ href: '/', folder: true }, { href: '/mdpro/', folder: true }, { href: '/mdpro/sample.md', size: 12 }])
      : xml([{ href: '/', folder: true }, { href: '/mdpro/', folder: true }]));
  } else if (request.url === '/__webdav_proxy/mdpro/') {
    response.end(xml([{ href: '/mdpro/', folder: true }, { href: '/mdpro/sample.md', size: 12 }]));
  } else {
    response.writeHead(404);
    response.end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const { port } = server.address();
  const client = createClient(`http://127.0.0.1:${port}/__webdav_proxy`, { remoteBasePath: '/' });
  const root = await client.getDirectoryContents('/');
  assert.equal(root[0].filename, '/mdpro');
  const child = await client.getDirectoryContents(root[0].filename);
  assert.equal(child[0].filename, '/mdpro/sample.md');
  const fullTree = await client.getDirectoryContents('/', { deep: true });
  assert.deepEqual(fullTree.map((item) => item.filename), ['/mdpro', '/mdpro/sample.md']);
  await client.moveFile('/mdpro/sample.md', '/archive/sample.md');
  await client.copyFile('/mdpro/sample.md', '/archive/copied.md', { overwrite: false });
  assert.deepEqual(requests.map(({ method, url, depth, destination }) => ({ method, url, depth, destination })), [
    { method: 'PROPFIND', url: '/__webdav_proxy/', depth: '1', destination: undefined },
    { method: 'PROPFIND', url: '/__webdav_proxy/mdpro/', depth: '1', destination: undefined },
    { method: 'PROPFIND', url: '/__webdav_proxy/', depth: 'infinity', destination: undefined },
    { method: 'MOVE', url: '/__webdav_proxy/mdpro/sample.md', depth: undefined, destination: `http://127.0.0.1:${port}/__webdav_proxy/archive/sample.md` },
    { method: 'COPY', url: '/__webdav_proxy/mdpro/sample.md', depth: 'infinity', destination: `http://127.0.0.1:${port}/__webdav_proxy/archive/copied.md` },
  ]);
  console.log('webdav proxy client: tree and absolute MOVE/COPY destinations passed');
} finally {
  server.close();
}

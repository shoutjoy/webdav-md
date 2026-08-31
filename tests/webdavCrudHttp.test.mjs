import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createClient } from 'webdav';
import { createDirectoryVerified, deleteRemoteItemVerified, moveRemoteItemVerified, saveFileVerified } from '../src/webdavMoveEngine.js';

for (const nativeSupported of [true, false]) {
  test(`Actual WebDAV SDK HTTP CRUD, ${nativeSupported ? 'PLAN A' : 'PLAN B'}`, async () => {
    const files = new Map();
    const dirs = new Set(['/']);
    const requests = [];
    const exists = path => files.has(path) || dirs.has(path);
    const xml = paths => `<d:multistatus xmlns:d="DAV:">${paths.map(path => `<d:response><d:href>${encodeURI(path)}</d:href><d:propstat><d:prop><d:resourcetype>${dirs.has(path) ? '<d:collection/>' : ''}</d:resourcetype><d:getcontentlength>${files.get(path)?.length || 0}</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('')}</d:multistatus>`;
    const server = http.createServer(async (req, res) => {
      const path = decodeURIComponent(req.url).replace(/\/$/, '') || '/';
      requests.push([req.method, path]);
      try {
        if (req.method === 'MKCOL') {
          if (exists(path)) return res.writeHead(405).end();
          dirs.add(path);
          return res.writeHead(201).end();
        }
        if (req.method === 'PUT') {
          if (req.headers['if-none-match'] === '*' && exists(path)) return res.writeHead(412).end();
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          files.set(path, Buffer.concat(chunks));
          return res.writeHead(201).end();
        }
        if (!exists(path)) return res.writeHead(404).end();
        if (req.method === 'PROPFIND') {
          const children = req.headers.depth === '0' ? [] : [...dirs, ...files.keys()].filter(p => p !== path && (p.slice(0, p.lastIndexOf('/')) || '/') === path);
          return res.writeHead(207, { 'Content-Type': 'application/xml' }).end(xml([path, ...children]));
        }
        if (req.method === 'GET') return res.writeHead(200).end(files.get(path));
        if (req.method === 'MOVE') {
          if (!nativeSupported) return res.writeHead(405).end();
          const target = decodeURIComponent(new URL(req.headers.destination).pathname);
          assert.equal(req.headers.overwrite, 'F');
          if (exists(target)) return res.writeHead(412).end();
          for (const [p, value] of [...files]) {
            if (p === path || p.startsWith(`${path}/`)) { files.set(target + p.slice(path.length), value); files.delete(p); }
          }
          for (const p of [...dirs]) {
            if (p === path || p.startsWith(`${path}/`)) { dirs.add(target + p.slice(path.length)); dirs.delete(p); }
          }
          return res.writeHead(201).end();
        }
        if (req.method === 'DELETE') {
          for (const p of [...files.keys()]) if (p === path || p.startsWith(`${path}/`)) files.delete(p);
          for (const p of [...dirs]) if (p === path || p.startsWith(`${path}/`)) dirs.delete(p);
          return res.writeHead(204).end();
        }
        res.writeHead(405).end();
      } catch (error) {
        res.writeHead(500).end(error.message);
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const client = createClient(`http://127.0.0.1:${server.address().port}`);
      await createDirectoryVerified(client, '/검증');
      await createDirectoryVerified(client, '/검증/하위');
      await saveFileVerified(client, '/검증/한글.md', '# 처음\n', { overwrite: false });
      await saveFileVerified(client, '/검증/한글.md', '# 수정 완료\n');
      await assert.rejects(saveFileVerified(client, '/검증/한글.md', '충돌', { overwrite: false }));
      await moveRemoteItemVerified(client, '/검증/한글.md', '/검증/하위/이름 변경.md');
      await moveRemoteItemVerified(client, '/검증/하위', '/검증/이동 폴더', { isDirectory: true });
      assert.equal(await client.getFileContents('/검증/이동 폴더/이름 변경.md', { format: 'text' }), '# 수정 완료\n');
      assert.equal(await client.exists('/검증/하위'), false);
      await deleteRemoteItemVerified(client, '/검증/이동 폴더/이름 변경.md');
      await deleteRemoteItemVerified(client, '/검증/이동 폴더');
      await deleteRemoteItemVerified(client, '/검증');
      assert.equal(files.size, 0);
      assert.deepEqual([...dirs], ['/']);
      assert.equal(requests.some(([method]) => method === 'COPY'), false);
      assert.equal(requests.filter(([method]) => method === 'MOVE').length, 2);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}

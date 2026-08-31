import assert from 'node:assert/strict';
import http from 'node:http';
import { createClient } from 'webdav';
import { moveFileVerified } from '../src/webdavMoveEngine.js';

// Exercise the actual SDK and HTTP body conversion, including Korean paths.
const source = '/생성형인공지능/Sites에서 음악다운로드.md';
const target = '/생성형인공지능/Sites에서 음악다운로드 (수정).md';
const content = Buffer.from('# 한글 문서\n음악 다운로드\n\u0000');
const files = new Map([[source, content]]);
const requests = [];
const server = http.createServer(async (req, res) => {
  const path = decodeURIComponent(req.url);
  requests.push([req.method, path]);
  if (req.method === 'COPY') {
    res.writeHead(400).end();
  } else if (req.method === 'PUT') {
    assert.equal(req.headers['if-none-match'], '*');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    files.set(path, Buffer.concat(chunks));
    res.writeHead(201).end();
  } else if (!files.has(path)) {
    res.writeHead(404).end();
  } else if (req.method === 'PROPFIND') {
    res.writeHead(207, { 'Content-Type': 'application/xml' });
    res.end(`<d:multistatus xmlns:d="DAV:"><d:response><d:href>${encodeURI(path)}</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>${files.get(path).length}</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`);
  } else if (req.method === 'GET') {
    res.writeHead(200).end(files.get(path));
  } else if (req.method === 'DELETE') {
    assert.deepEqual(files.get(target), content);
    files.delete(path);
    res.writeHead(204).end();
  } else res.writeHead(405).end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const client = createClient(`http://127.0.0.1:${server.address().port}`);
  await moveFileVerified(client, source, target);
  assert.deepEqual(files.get(target), content);
  assert.equal(files.has(source), false);
  assert.deepEqual(requests.filter(([method]) => method !== 'PROPFIND'), [
    ['COPY', source], ['GET', source], ['PUT', target], ['GET', target], ['DELETE', source],
  ]);
  console.log('WebDAV HTTP rename: COPY 400 -> binary GET/PUT -> verified content -> DELETE passed');
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

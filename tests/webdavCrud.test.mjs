import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDirectoryVerified, deleteRemoteItemVerified, moveRemoteItemVerified, saveFileVerified } from '../src/webdavMoveEngine.js';

const makeClient = ({ native = 'success', failUpload, failDelete = false } = {}) => {
  const files = new Map([['/source/a.md', new TextEncoder().encode('# 한글\n원본 내용')], ['/source/nested/b.bin', new Uint8Array([0, 255, 128, 13, 10])]]);
  const dirs = new Set(['/', '/source', '/source/nested', '/target']);
  const calls = [];
  const client = {
    async exists(path) { return files.has(path) || dirs.has(path); },
    async moveFile(from, to, options) {
      calls.push(['MOVE', from, to, options]);
      if (typeof native === 'number') throw Object.assign(new Error('MOVE failed'), { status: native });
      if (native === 'network') throw new TypeError('Failed to fetch');
      if (native === 'noop') return;
      if (native === 'partial') { dirs.add(to); throw new TypeError('Failed to fetch'); }
      for (const [path, bytes] of [...files]) {
        if (path === from || path.startsWith(`${from}/`)) { files.set(to + path.slice(from.length), bytes); files.delete(path); }
      }
      for (const path of [...dirs]) {
        if (path === from || path.startsWith(`${from}/`)) { dirs.add(to + path.slice(from.length)); dirs.delete(path); }
      }
      if (native === 'lost-response') throw new TypeError('Failed to fetch');
    },
    async getDirectoryContents(path) {
      return [...[...dirs].filter(p => p !== path).map(filename => ({ filename, type: 'directory' })), ...[...files.keys()].map(filename => ({ filename, type: 'file' }))]
        .filter(e => e.filename.slice(0, e.filename.lastIndexOf('/')) === path);
    },
    async createDirectory(path) { calls.push(['MKCOL', path]); dirs.add(path); },
    async getFileContents(path, options) {
      calls.push(['GET', path]);
      if (!files.has(path)) throw Object.assign(new Error('Not found'), { status: 404 });
      return options.format === 'text' ? new TextDecoder().decode(files.get(path)) : files.get(path);
    },
    async putFileContents(path, value, options) {
      calls.push(['PUT', path]);
      if (path === failUpload || (options?.overwrite === false && files.has(path))) return false;
      files.set(path, typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value));
      return true;
    },
    async deleteFile(path) {
      calls.push(['DELETE', path]);
      if (failDelete) return; // A server may acknowledge but leave the file.
      files.delete(path);
      dirs.delete(path);
    },
  };
  return { client, files, dirs, calls };
};

for (const isDirectory of [false, true]) {
  for (const native of ['success', 'lost-response']) {
    test(`PLAN A ${isDirectory ? 'folder' : 'file'}: ${native}`, async () => {
      const { client, calls } = makeClient({ native });
      const source = isDirectory ? '/source' : '/source/a.md';
      const target = isDirectory ? '/target/moved' : '/target/a.md';
      await moveRemoteItemVerified(client, source, target, { isDirectory });
      assert.equal(await client.exists(source), false);
      assert.equal(await client.exists(target), true);
      assert.deepEqual(calls, [['MOVE', source, target, { overwrite: false }]]);
    });
  }
}

for (const native of [400, 405, 501, 502, 503, 504, 'network']) {
  test(`PLAN B after MOVE ${native}`, async () => {
    const { client, calls, files } = makeClient({ native });
    await moveRemoteItemVerified(client, '/source/a.md', '/target/a.md');
    assert.equal(files.has('/source/a.md'), false);
    assert.equal(new TextDecoder().decode(files.get('/target/a.md')), '# 한글\n원본 내용');
    assert.deepEqual(calls.map(([method]) => method), ['MOVE', 'GET', 'PUT', 'GET', 'DELETE']);
  });
}

for (const native of [401, 403, 404, 409, 412, 423, 'noop', 'partial']) {
  test(`No PLAN B on denied / ambiguous MOVE ${native}`, async () => {
    const { client, calls, files } = makeClient({ native });
    await assert.rejects(moveRemoteItemVerified(client, '/source/a.md', '/target/a.md'));
    assert.equal(files.has('/source/a.md'), true);
    assert.deepEqual(calls.map(([method]) => method), ['MOVE']);
  });
}

test('PLAN B folder copies every file before deleting any source', async () => {
  const { client, calls, files, dirs } = makeClient({ native: 405 });
  const progress = [];
  await moveRemoteItemVerified(client, '/source', '/target/moved', { isDirectory: true, onProgress: p => progress.push(p) });
  const firstDelete = calls.findIndex(([method]) => method === 'DELETE');
  const finalRead = calls.findLastIndex(([method]) => method === 'GET');
  assert.ok(firstDelete > finalRead);
  assert.equal(files.has('/source/a.md'), false);
  assert.equal(dirs.has('/source'), false);
  assert.deepEqual(files.get('/target/moved/nested/b.bin'), new Uint8Array([0, 255, 128, 13, 10]));
  assert.equal(progress.at(-1).completed, progress.at(-1).total);
});

test('PLAN B later upload failure preserves the ENTIRE original folder', async () => {
  const { client, calls, files, dirs } = makeClient({ native: 405, failUpload: '/target/moved/a.md' });
  await assert.rejects(moveRemoteItemVerified(client, '/source', '/target/moved', { isDirectory: true }));
  assert.equal(files.has('/source/a.md'), true);
  assert.equal(files.has('/source/nested/b.bin'), true);
  assert.equal(dirs.has('/source/nested'), true);
  assert.equal(calls.some(([method]) => method === 'DELETE'), false);
});

test('Create, read, update, delete and collision protection', async () => {
  const { client, files } = makeClient();
  await createDirectoryVerified(client, '/target/새 폴더');
  const path = '/target/새 폴더/새 파일.md';
  await saveFileVerified(client, path, '처음', { overwrite: false });
  await assert.rejects(saveFileVerified(client, path, '덮어쓰기 금지', { overwrite: false }));
  assert.equal(new TextDecoder().decode(files.get(path)), '처음');
  await saveFileVerified(client, path, '수정한 내용');
  assert.equal(await client.getFileContents(path, { format: 'text' }), '수정한 내용');
  await deleteRemoteItemVerified(client, path);
  await deleteRemoteItemVerified(client, '/target/새 폴더');
  assert.equal(await client.exists('/target/새 폴더'), false);
});

test('Deletion is not successful if source remains', async () => {
  const { client, files } = makeClient({ failDelete: true });
  await assert.rejects(deleteRemoteItemVerified(client, '/source/a.md'), /삭제 확인/);
  assert.equal(files.has('/source/a.md'), true);
});

test('Lost DELETE response is recovered through existence check', async () => {
  const { client } = makeClient();
  const remove = client.deleteFile;
  client.deleteFile = async path => { await remove(path); throw new TypeError('Failed to fetch'); };
  await deleteRemoteItemVerified(client, '/source/a.md');
});

test('Root, own descendants, and existing destinations are protected', async () => {
  const { client, calls } = makeClient();
  await assert.rejects(deleteRemoteItemVerified(client, '/'));
  await assert.rejects(moveRemoteItemVerified(client, '/source', '/source/nested/new', { isDirectory: true }));
  await assert.rejects(moveRemoteItemVerified(client, '/source', '/target', { isDirectory: true, overwrite: true }));
  await assert.rejects(moveRemoteItemVerified(client, '/source/a.md', '/source/nested/b.bin'));
  assert.deepEqual(calls, []);
});

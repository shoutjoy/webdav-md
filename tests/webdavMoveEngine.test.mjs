import assert from 'node:assert/strict';
import { createDirectoryVerified, moveFileVerified } from '../src/webdavMoveEngine.js';

const existing = new Set();
await createDirectoryVerified({
  async createDirectory(path) { existing.add(path); },
  async exists(path) { return existing.has(path); },
}, '/target/folder');
assert.equal(existing.has('/target/folder'), true);

for (const scenario of ['success', 'empty', 'binary', 'overwrite', 'mismatch', 'read-failure', 'upload-failure', 'lost-response', 'verify-failure', 'missing-target', 'conflict', 'forbidden', 'delete-failure']) {
  let deleted = false;
  let present = ['conflict', 'overwrite'].includes(scenario);
  const calls = [];
  const bytes = scenario === 'empty' ? new Uint8Array() : scenario === 'binary'
    ? new Uint8Array([99, 0, 255, 128, 13, 10, 99]).subarray(1, 6)
    : new TextEncoder().encode('# 음악 다운로드\n한글 내용\u0000');
  const client = {
    async exists(path) { return path === '/원본.md' ? !deleted : present; },
    async copyFile() { assert.fail('COPY must never be used'); },
    async moveFile() { assert.fail('MOVE must never be used'); },
    async getFileContents(path) {
      calls.push(['GET', path]);
      if (scenario === 'read-failure' || (scenario === 'verify-failure' && path === '/대상/원본.md')) throw new Error('GET failed');
      return path === '/대상/원본.md' && scenario === 'mismatch' ? new Uint8Array(bytes.length) : bytes;
    },
    async putFileContents(path, data, options) {
      calls.push(['PUT', path]);
      assert.equal(path, '/대상/원본.md');
      assert.deepEqual(new Uint8Array(data), new Uint8Array(bytes));
      assert.equal(options.overwrite, scenario === 'overwrite');
      if (scenario === 'upload-failure') return false;
      if (scenario === 'forbidden') throw Object.assign(new Error('Forbidden'), { status: 403 });
      present = scenario !== 'missing-target';
      if (scenario === 'lost-response') throw new TypeError('Failed to fetch');
      return true;
    },
    async deleteFile(path) {
      calls.push(['DELETE', path]);
      if (scenario === 'delete-failure') throw new Error('DELETE failed');
      deleted = true;
    },
  };
  const success = ['success', 'empty', 'binary', 'overwrite'].includes(scenario);
  const result = moveFileVerified(client, '/원본.md', '/대상/원본.md', scenario === 'overwrite');
  if (success) await result;
  else await assert.rejects(result);
  assert.equal(deleted, success, `${scenario}: preserve source on failure`);
  if (success || scenario === 'delete-failure') assert.deepEqual(calls, [
    ['GET', '/원본.md'], ['PUT', '/대상/원본.md'], ['GET', '/대상/원본.md'], ['DELETE', '/원본.md'],
  ]);
  else assert.equal(calls.some(([method]) => method === 'DELETE'), false);
  if (scenario === 'conflict') assert.deepEqual(calls, []);
  if (scenario === 'read-failure') assert.equal(calls.some(([method]) => method === 'PUT'), false);
}
await moveFileVerified({}, '/same.md', '/same.md');
console.log('webdav move engine: GET -> PUT -> content verification -> DELETE safety tests passed');

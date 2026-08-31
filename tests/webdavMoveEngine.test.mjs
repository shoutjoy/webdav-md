import assert from 'node:assert/strict';
import { createDirectoryVerified, moveFileVerified } from '../src/webdavMoveEngine.js';

const operations = [];
const existing = new Set();
const client = {
  async createDirectory(path) { operations.push(['MKCOL', path]); existing.add(path); },
  async copyFile(source, target, options) { operations.push(['COPY', source, target, options]); existing.add(target); },
  async exists(path) { operations.push(['EXISTS', path]); return existing.has(path); },
  async deleteFile(path) { operations.push(['DELETE', path]); },
};

await createDirectoryVerified(client, '/target/folder');
await moveFileVerified(client, '/source/a.md', '/target/folder/a.md');
assert.deepEqual(operations, [
  ['MKCOL', '/target/folder'],
  ['EXISTS', '/target/folder'],
  ['EXISTS', '/target/folder/a.md'],
  ['COPY', '/source/a.md', '/target/folder/a.md', { overwrite: false }],
  ['EXISTS', '/target/folder/a.md'],
  ['DELETE', '/source/a.md'],
]);

let sourceDeleted = false;
const acceptedDespiteLostResponse = {
  async copyFile() { throw new TypeError('Failed to fetch'); },
  async exists() { return this.checked ? true : (this.checked = true, false); },
  async getFileContents() { return new Uint8Array([1, 2, 3]); },
  async deleteFile() { sourceDeleted = true; },
};
await moveFileVerified(acceptedDespiteLostResponse, '/source/b.md', '/target/b.md');
assert.equal(sourceDeleted, true);

for (const scenario of ['success', 'mismatch', 'upload-failure', 'conflict', 'forbidden']) {
  let deleted = false;
  let uploaded = false;
  let present = scenario === 'conflict';
  const bytes = new TextEncoder().encode('# 음악 다운로드\n한글 내용\u0000');
  const fallbackClient = {
    async exists() { return present; },
    async copyFile() { throw Object.assign(new Error('Invalid response'), { status: scenario === 'forbidden' ? 403 : 400 }); },
    async getFileContents(path) { return path === '/새 이름.md' && scenario === 'mismatch' ? new Uint8Array([0]) : bytes; },
    async putFileContents(path, data, options) {
      uploaded = true;
      assert.equal(path, '/새 이름.md');
      assert.deepEqual(new Uint8Array(data), bytes);
      assert.equal(options.overwrite, false);
      if (scenario === 'upload-failure') return false;
      present = true;
      return true;
    },
    async deleteFile() { deleted = true; },
  };
  const result = moveFileVerified(fallbackClient, '/원본.md', '/새 이름.md');
  if (scenario === 'success') await result;
  else await assert.rejects(result);
  assert.equal(deleted, scenario === 'success', `${scenario}: preserve source on failure`);
  if (['conflict', 'forbidden'].includes(scenario)) assert.equal(uploaded, false);
}

console.log('webdav move engine: verified COPY then DELETE workflow passed');

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
  ['COPY', '/source/a.md', '/target/folder/a.md', { overwrite: false }],
  ['EXISTS', '/target/folder/a.md'],
  ['DELETE', '/source/a.md'],
]);

let sourceDeleted = false;
const acceptedDespiteLostResponse = {
  async copyFile() { throw new TypeError('Failed to fetch'); },
  async exists() { return true; },
  async deleteFile() { sourceDeleted = true; },
};
await moveFileVerified(acceptedDespiteLostResponse, '/source/b.md', '/target/b.md');
assert.equal(sourceDeleted, true);

console.log('webdav move engine: verified COPY then DELETE workflow passed');

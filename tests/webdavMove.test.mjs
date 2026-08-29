import assert from 'node:assert/strict';
import { collectDirectoryEntries, shouldFallbackToCopyDelete } from '../src/webdavMove.js';

assert.equal(shouldFallbackToCopyDelete(new TypeError('Failed to fetch')), true);
assert.equal(shouldFallbackToCopyDelete({ status: 400 }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 403 }), true);
assert.equal(shouldFallbackToCopyDelete({ response: { status: 405 } }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 501 }), true);
assert.equal(shouldFallbackToCopyDelete({ status: 401 }), false);
assert.equal(shouldFallbackToCopyDelete({ status: 404 }), false);
assert.equal(shouldFallbackToCopyDelete({ status: 412 }), false);

const requestedPaths = [];
const directoryContents = new Map([
  ['/source', [
    { filename: '/source/nested', type: 'directory' },
    { filename: '/source/root.md', type: 'file' },
  ]],
  ['/source/nested', [
    { filename: '/source/nested/deeper', type: 'directory' },
    { filename: '/source/nested/child.md', type: 'file' },
  ]],
  ['/source/nested/deeper', [
    { filename: '/source/nested/deeper/image.png', type: 'file' },
  ]],
]);
const entries = await collectDirectoryEntries({
  async getDirectoryContents(path) {
    requestedPaths.push(path);
    return directoryContents.get(path) || [];
  },
}, '/source');

assert.deepEqual(requestedPaths, ['/source', '/source/nested', '/source/nested/deeper']);
assert.deepEqual(entries.map((entry) => entry.filename), [
  '/source/nested',
  '/source/nested/deeper',
  '/source/nested/deeper/image.png',
  '/source/nested/child.md',
  '/source/root.md',
]);

console.log('webdav move: fallback policy and recursive directory traversal passed');

import test from 'node:test';
import assert from 'node:assert/strict';
import { getRefreshPaths, mergeDirectoryAdditions } from '../src/webdavRefresh.js';

const file = (path) => ({ name: path.split('/').at(-1), remotePath: path, isDirectory: false });
const folder = (path, entries = []) => ({ name: path.split('/').at(-1), remotePath: path, isDirectory: true, loaded: true, entries });
const makeTree = () => ({ path: '/', isDirectory: true, loaded: true, entries: [folder('/연구', [file('/연구/기존.md')]), folder('/닫힘'), { ...file('/a.dmerge'), isArchive: true, entries: [folder('/archive-only')] }] });

test('refresh lists root and requested known folders, excluding files and archive contents', () => {
  assert.deepEqual(getRefreshPaths(makeTree(), ['/연구/', '/연구', '/unknown', '/a.dmerge', '/archive-only']), ['/', '/연구']);
});

test('new nested files are added while existing nodes and archive cache stay intact', () => {
  const tree = makeTree();
  const oldFile = tree.entries[0].entries[0];
  const result = mergeDirectoryAdditions(tree, '/연구', [file('/연구/새.md'), { ...oldFile, size: 999 }]);
  assert.equal(result.added, 1);
  assert.equal(result.tree.entries[0].entries.find(e => e.remotePath === oldFile.remotePath), oldFile);
  assert.equal(result.tree.entries[1], tree.entries[1]);
  assert.equal(result.tree.entries[2], tree.entries[2]);
  assert.equal(tree.entries[0].entries.length, 1);
});

test('unchanged or repeated server listings are identity-preserving no-ops', () => {
  const tree = makeTree();
  assert.equal(mergeDirectoryAdditions(tree, '/연구', [file('/연구/기존.md')]).tree, tree);
  const first = mergeDirectoryAdditions(tree, '/연구', [file('/연구/새.md'), file('/연구/새.md')]);
  assert.equal(first.added, 1);
  assert.equal(mergeDirectoryAdditions(first.tree, '/연구', [file('/연구/새.md')]).tree, first.tree);
});

test('an empty listing preserves known files and cached folder contents', () => {
  const tree = makeTree();
  assert.equal(mergeDirectoryAdditions(tree, '/', []).tree, tree);
});

test('new root folders can subsequently receive newly discovered contents', () => {
  const tree = makeTree();
  const first = mergeDirectoryAdditions(tree, '/', [folder('/신규')]);
  const second = mergeDirectoryAdditions(first.tree, '/신규', [file('/신규/new.md')]);
  assert.equal(first.added, 1);
  assert.equal(second.added, 1);
  assert.equal(second.tree.entries.find(e => e.remotePath === '/신규').entries[0].name, 'new.md');
});

test('missing targets and self entries cannot create duplicates or overwrite the tree', () => {
  const tree = makeTree();
  assert.equal(mergeDirectoryAdditions(tree, '/missing', [file('/missing/x.md')]).tree, tree);
  assert.equal(mergeDirectoryAdditions(tree, '/', [{ path: '/', remotePath: '/', isDirectory: true }]).tree, tree);
});

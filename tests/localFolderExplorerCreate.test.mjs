import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const explorerScript = readFileSync(resolve(repositoryRoot, 'mdpro/sidebar_left/local-folder-explorer.js'), 'utf8');

function loadExplorer(promptValue = 'untitled.md') {
  const toasts = [];
  const opened = [];
  const context = {
    window: {
      prompt: () => promptValue,
      showToast: (message) => toasts.push(message),
      openFileFromLocalFolderExplorer: async (...args) => opened.push(args)
    },
    document: {
      readyState: 'loading',
      addEventListener() {}
    }
  };
  vm.runInNewContext(explorerScript, context);
  return { explorer: context.window.LocalFolderExplorer, toasts, opened };
}

test('local folder explorer exposes file and folder creation controls', () => {
  assert.match(explorerScript, /id = 'local-folder-new-file'/);
  assert.match(explorerScript, /id = 'local-folder-new-folder'/);
  assert.match(explorerScript, /createFile: createFile/);
  assert.match(explorerScript, /createFolder: createFolder/);
});

test('local folder creation requests write access and uses filesystem handles', () => {
  assert.match(explorerScript, /getPermission\(node\.handle, true, 'readwrite'\)/);
  assert.match(explorerScript, /getFileHandle\(name, \{ create: true \}\)/);
  assert.match(explorerScript, /createWritable\(\)/);
  assert.match(explorerScript, /getDirectoryHandle\(name, \{ create: true \}\)/);
});

test('createFile writes an empty markdown file, refreshes it, and opens it', async () => {
  const entries = [];
  const writes = [];
  const file = { name: 'notes.md', text: async () => '' };
  const fileHandle = {
    name: 'notes.md',
    kind: 'file',
    getFile: async () => file,
    createWritable: async () => ({
      write: async (value) => writes.push(value),
      close: async () => writes.push('closed')
    })
  };
  const directoryHandle = {
    queryPermission: async () => 'granted',
    values: async function* () { yield* entries; },
    getFileHandle: async (name, options) => {
      assert.equal(name, 'notes.md');
      assert.equal(options.create, true);
      entries.push(fileHandle);
      return fileHandle;
    }
  };
  const root = { name: 'root', kind: 'directory', handle: directoryHandle, path: 'root', children: [], loaded: true, expanded: true };
  const { explorer, toasts, opened } = loadExplorer('notes');

  assert.equal(await explorer.createFile(root), true);
  assert.deepEqual(writes, ['', 'closed']);
  assert.equal(opened.length, 1);
  assert.equal(opened[0][1], 'root/notes.md');
  assert.match(toasts.at(-1), /파일을 만들었습니다/);
});

test('createFolder creates the directory and rejects duplicate names', async () => {
  const entries = [];
  const directoryHandle = {
    queryPermission: async () => 'granted',
    values: async function* () { yield* entries; },
    getDirectoryHandle: async (name, options) => {
      assert.equal(options.create, true);
      entries.push({ name, kind: 'directory', values: async function* () {} });
    }
  };
  const root = { name: 'root', kind: 'directory', handle: directoryHandle, path: 'root', children: [], loaded: true, expanded: true };
  const { explorer, toasts } = loadExplorer('자료');

  assert.equal(await explorer.createFolder(root), true);
  assert.equal(await explorer.createFolder(root), false);
  assert.equal(entries[0].name, '자료');
  assert.match(toasts.at(-1), /같은 이름/);
});

test('local folder creation protects existing entries and read-only fallback mode', () => {
  assert.match(explorerScript, /entryExists\(directory\.handle, name\)/);
  assert.match(explorerScript, /createFileButton\.disabled = fallbackMode/);
  assert.match(explorerScript, /createFolderButton\.disabled = fallbackMode/);
  assert.match(explorerScript, /같은 이름의 파일 또는 폴더가 이미 있습니다/);
  assert.match(explorerScript, /toLocaleLowerCase\(\) === normalizedName/);
  assert.match(explorerScript, /con\|prn\|aux\|nul\|com\[1-9\]\|lpt\[1-9\]/);
});

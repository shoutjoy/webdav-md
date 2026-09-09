import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { saveJenaRecord, readJenaRecords, isJenaDataPath, visibleWebdavEntries } from '../src/jenaDataStorage.js';

function fakeClient() {
  const files = new Map();
  const dirs = new Set();
  return { files, dirs, async exists(path) { return dirs.has(path); },
    async createDirectory(path) { dirs.add(path); },
    async putFileContents(path, body) { files.set(path, JSON.parse(body)); return true; } };
}

test('creates JENA_DATA, preserves Korean conversation, confines IDs and updates same file', async () => {
  const client = fakeClient();
  const record = { id: '../../한글/대화', messages: [{ role: 'user', content: '질문' }], updatedAt: 1 };
  const first = await saveJenaRecord(client, record);
  assert.match(first.path, /^\/JENA_DATA\/[a-f0-9]+\.json$/);
  assert.ok(client.dirs.has('/JENA_DATA'));
  assert.deepEqual(client.files.get(first.path), record);
  record.messages.push({ role: 'assistant', content: '답변' });
  assert.equal((await saveJenaRecord(client, record)).path, first.path);
  assert.equal(client.files.size, 1);
  await saveJenaRecord(client, { id: record.id, deleted: true, updatedAt: 2 });
  assert.equal(client.files.get(first.path).messages, undefined);
});

test('disconnection, rejected upload and folder permission failures are reported', async () => {
  await assert.rejects(saveJenaRecord(null, { id: 'a' }), /WebDAV/);
  const client = fakeClient();
  client.putFileContents = async () => false;
  await assert.rejects(saveJenaRecord(client, { id: 'a' }), /실패/);
  client.dirs.clear();
  client.createDirectory = async () => { throw new Error('403'); };
  await assert.rejects(saveJenaRecord(client, { id: 'a' }), /403/);
});

test('local records survive failed upload, retry after reload and skip unchanged successful uploads', async () => {
  const rows = new Map();
  const uploaded = [];
  let failing = true;
  const source = await readFile(new URL('../mdpro/AI_App/dataCenter/ai-data-center.js', import.meta.url), 'utf8');
  function boot() {
    const listeners = new Set();
    const timers = new Map();
    let timerId = 0;
    const database = { transaction() {
      const tx = { objectStore(name) { return {
        put(record) { rows.set(record.id, record); }, delete() {},
        getAll() { const request = {}; queueMicrotask(() => { request.result = name === 'deleted' ? [] : [...rows.values()]; request.onsuccess(); }); return request; },
      }; } };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    } };
    const window = { location: { search: '?webdav=1', origin: 'https://app.test' }, crypto: globalThis.crypto,
      addEventListener(type, fn) { if (type === 'message') listeners.add(fn); },
      removeEventListener(type, fn) { listeners.delete(fn); },
    };
    window.parent = { postMessage(data) {
      uploaded.push(data.record);
      queueMicrotask(() => { for (const listener of [...listeners]) listener({ source: window.parent, origin: window.location.origin,
        data: { type: 'jena-save-result', requestId: data.requestId, ok: !failing, error: 'offline' } }); });
    } };
    vm.runInNewContext(source, { window, URLSearchParams, Map, console,
      document: { getElementById() { return null; } }, localStorage: { getItem() { return '1'; } },
      indexedDB: { open() { const request = {}; queueMicrotask(() => { request.result = database; request.onsuccess(); }); return request; } },
      setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    });
    return { api: window.AIDataCenter, async sync() {
      const entry = [...timers].find(([, value]) => value.delay !== 60000);
      assert.ok(entry); timers.delete(entry[0]); await entry[1].fn();
    } };
  }
  let app = boot();
  await app.api.save({ id: 'conversation:1', recordType: 'conversation', messages: [{ content: '보존' }] });
  await app.sync();
  assert.equal(rows.size, 1);
  assert.equal(uploaded.length, 1);
  app = boot();
  failing = false;
  await app.sync();
  assert.equal(uploaded.length, 2);
  await app.sync();
  assert.equal(uploaded.length, 2);
  await app.api.save({ id: 'conversation:1', messages: [{ content: '수정' }] });
  await app.sync();
  assert.equal(uploaded.length, 3);
  assert.equal(uploaded[2].messages[0].content, '수정');
});


test('hides protected folder and descendants while preserving similarly named user folders', () => {
  const paths = ['/JENA_DATA', '/JENA_DATA/a.json', '/__webdav_proxy/JENA_DATA/a.json', '/jena_data/a.json'];
  for (const path of paths) assert.equal(isJenaDataPath(path), true);
  const entries = [...paths, '/JENA_DATA_OTHER', '/notes/JENA_DATA', '/notes/a.md'].map(filename => ({ filename }));
  assert.deepEqual(visibleWebdavEntries(entries).map(entry => entry.filename), ['/JENA_DATA_OTHER', '/notes/JENA_DATA', '/notes/a.md']);
  assert.equal(visibleWebdavEntries([{ remotePath: '/JENA_DATA/a.json' }]).length, 0);
  assert.deepEqual(
    visibleWebdavEntries(entries, { showHidden: true }).map(entry => entry.filename),
    ['/.mdpro_mset', '/.webdav_temp', '/JENA_DATA_OTHER', '/notes/JENA_DATA', '/notes/a.md'],
  );
  assert.equal(visibleWebdavEntries([{ filename: '/notes/.draft.md' }]).length, 0);
  assert.equal(visibleWebdavEntries([{ filename: '/notes/.draft.md' }], { showHidden: true }).length, 1);
});

test('data center reads only its own JSON records, omits deletion markers and performs no writes', async () => {
  const reads = [];
  const client = {
    async exists() { return true; },
    async getDirectoryContents(path) {
      assert.equal(path, '/JENA_DATA');
      return ['61.json', '62.json', '../outside.json', 'notes.txt', 'folder'].map(name => ({ filename: '/JENA_DATA/' + name, type: name === 'folder' ? 'directory' : 'file' }));
    },
    async getFileContents(path) {
      reads.push(path);
      return JSON.stringify(path.endsWith('61.json') ? { id: 'a', recordType: 'conversation', messages: [{ content: '저장된 대화' }] } : { id: 'b', deleted: true });
    },
  };
  const records = await readJenaRecords(client);
  assert.equal(records.length, 1);
  assert.equal(records[0].messages[0].content, '저장된 대화');
  assert.deepEqual(reads, ['/JENA_DATA/61.json', '/JENA_DATA/62.json']);
  await assert.rejects(readJenaRecords(null), /WebDAV/);
  assert.deepEqual(await readJenaRecords({ exists: async () => false }), []);
});

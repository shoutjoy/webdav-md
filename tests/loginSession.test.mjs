import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_LOGIN_SESSION_KEY,
  clearLoginSession,
  readLoginSession,
  writeLoginSession,
} from '../src/loginSession.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('active login session survives a page reload through session storage', () => {
  const storage = createStorage();
  const credentials = { url: 'https://example.com/webdav', username: 'user', password: 'secret' };

  writeLoginSession(storage, credentials);

  assert.deepEqual(readLoginSession(storage), credentials);
});

test('logout clears the active login session', () => {
  const storage = createStorage();
  writeLoginSession(storage, { url: 'https://example.com', username: 'user', password: 'secret' });

  clearLoginSession(storage);

  assert.equal(storage.getItem(ACTIVE_LOGIN_SESSION_KEY), null);
  assert.equal(readLoginSession(storage), null);
});

test('invalid stored sessions are discarded instead of reconnecting', () => {
  const storage = createStorage();
  storage.setItem(ACTIVE_LOGIN_SESSION_KEY, '{broken');

  assert.equal(readLoginSession(storage), null);
  assert.equal(storage.getItem(ACTIVE_LOGIN_SESSION_KEY), null);
});

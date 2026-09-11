import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDENTIAL_VAULT_WEBDAV_PATH,
  readCredentialVaultFromWebDav,
  validateCredentialVaultEnvelope,
  writeCredentialVaultToWebDav,
} from '../src/credentialVaultStorage.js';

const envelope = {
  version: 1,
  algorithm: 'AES-GCM',
  derivation: 'PBKDF2-SHA256',
  iterations: 310000,
  salt: 'salt',
  iv: 'iv',
  ciphertext: 'ciphertext',
  updatedAt: '2026-09-11T00:00:00.000Z',
};

test('credential vault accepts only encrypted envelopes', () => {
  assert.equal(validateCredentialVaultEnvelope(envelope), envelope);
  assert.throws(() => validateCredentialVaultEnvelope({ apiKey: 'plaintext' }), /지원하지 않는/);
});

test('credential vault reads the hidden WebDAV file', async () => {
  const client = {
    exists: async (path) => path === CREDENTIAL_VAULT_WEBDAV_PATH,
    getFileContents: async () => JSON.stringify(envelope),
  };
  assert.deepEqual(await readCredentialVaultFromWebDav(client), envelope);
});

test('credential vault creates its hidden folder and writes ciphertext', async () => {
  const calls = [];
  let folderExists = false;
  let savedContent = '';
  const client = {
    exists: async (path) => path === '/.webdav_temp' ? folderExists : false,
    createDirectory: async (path) => { calls.push(['mkdir', path]); folderExists = true; return true; },
    putFileContents: async (path, content) => { calls.push(['put', path, content]); savedContent = content; return true; },
    getFileContents: async () => savedContent,
  };
  await writeCredentialVaultToWebDav(client, envelope);
  assert.ok(calls.some((call) => call[0] === 'put' && call[1] === CREDENTIAL_VAULT_WEBDAV_PATH));
  assert.equal(calls.some((call) => String(call[2]).includes('apiKey')), false);
});

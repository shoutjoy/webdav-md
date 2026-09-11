import { createDirectoryVerified, saveFileVerified } from './webdavMoveEngine.js';

export const CREDENTIAL_VAULT_WEBDAV_FOLDER = '/.webdav_temp';
export const CREDENTIAL_VAULT_WEBDAV_PATH = `${CREDENTIAL_VAULT_WEBDAV_FOLDER}/api-credentials.vault.json`;

export function validateCredentialVaultEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('API 키 보관함 형식이 올바르지 않습니다.');
  if (value.version !== 1 || value.algorithm !== 'AES-GCM' || value.derivation !== 'PBKDF2-SHA256') throw new Error('지원하지 않는 API 키 보관함 형식입니다.');
  for (const field of ['salt', 'iv', 'ciphertext']) {
    if (typeof value[field] !== 'string' || !value[field]) throw new Error(`API 키 보관함의 ${field} 값이 없습니다.`);
  }
  return value;
}

export async function readCredentialVaultFromWebDav(client) {
  if (!client) throw new Error('WebDAV에 연결한 후 다시 시도하세요.');
  if (!await client.exists(CREDENTIAL_VAULT_WEBDAV_PATH)) return null;
  const text = await client.getFileContents(CREDENTIAL_VAULT_WEBDAV_PATH, { format: 'text' });
  return validateCredentialVaultEnvelope(JSON.parse(String(text || '')));
}

export async function writeCredentialVaultToWebDav(client, envelope) {
  if (!client) throw new Error('WebDAV에 연결한 후 다시 시도하세요.');
  const validated = validateCredentialVaultEnvelope(envelope);
  if (!await client.exists(CREDENTIAL_VAULT_WEBDAV_FOLDER)) await createDirectoryVerified(client, CREDENTIAL_VAULT_WEBDAV_FOLDER);
  await saveFileVerified(client, CREDENTIAL_VAULT_WEBDAV_PATH, JSON.stringify(validated, null, 2), {
    overwrite: true,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return validated;
}

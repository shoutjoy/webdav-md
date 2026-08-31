import { collectDirectoryEntries, shouldFallbackToCopyDelete } from './webdavMove.js';
import { normalizeRemotePath } from './webdavPaths.js';

const wrapMoveError = (label, path, error) => {
  const wrapped = new Error(`${label} 실패 (${path}): ${error?.message || error}`);
  wrapped.status = error?.status || error?.response?.status;
  return wrapped;
};

export async function createDirectoryVerified(client, targetPath) {
  try {
    await client.createDirectory(targetPath);
  } catch (error) {
    let created = false;
    try { created = await client.exists(targetPath); } catch { /* Preserve the create error. */ }
    if (!created) throw wrapMoveError('대상 폴더 생성', targetPath, error);
  }
  let created = false;
  try {
    created = await client.exists(targetPath);
  } catch (error) {
    throw wrapMoveError('대상 폴더 확인', targetPath, error);
  }
  if (!created) throw new Error(`대상 폴더 생성 확인 실패 (${targetPath})`);
}

export async function copyFileContentsVerified(client, sourcePath, targetPath, overwrite = false) {
  if (sourcePath === targetPath) return;
  // Moving files uses GET -> PUT -> verified GET -> DELETE, never DAV COPY/MOVE.
  const targetExisted = await client.exists(targetPath);
  if (targetExisted && !overwrite) {
    const error = new Error(`같은 이름의 파일이 이미 있습니다 (${targetPath})`);
    error.status = 412;
    throw error;
  }

  const readBytes = async (path) => {
    const data = await client.getFileContents(path, { format: 'binary' });
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    throw new Error(`파일 내용을 확인할 수 없습니다 (${path})`);
  };
  const verifyContents = async (sourceBytes) => {
    const targetBytes = await readBytes(targetPath);
    if (sourceBytes.length !== targetBytes.length || sourceBytes.some((byte, index) => byte !== targetBytes[index])) {
      throw new Error(`복사한 파일의 내용이 원본과 다릅니다. 원본은 보존했습니다 (${targetPath})`);
    }
  };

  let sourceBytes;
  try {
    sourceBytes = await readBytes(sourcePath);
  } catch (error) {
    throw wrapMoveError('원본 파일 읽기', sourcePath, error);
  }
  try {
    // A single PUT creates the file with its complete contents (no empty placeholder).
    const upload = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength);
    const saved = await client.putFileContents(targetPath, upload, { overwrite });
    if (saved === false) throw new Error('대상 파일을 저장하지 못했습니다');
  } catch (error) {
    // Even if the server saved it but the response was lost, keep the source.
    throw wrapMoveError('대상 파일 저장 (원본 보존)', targetPath, error);
  }

  let copied = false;
  try {
    copied = await client.exists(targetPath);
  } catch (error) {
    throw wrapMoveError('대상 파일 확인', targetPath, error);
  }
  if (!copied) throw new Error(`대상 파일 생성 확인 실패 (${targetPath})`);
  await verifyContents(sourceBytes);
}

// PLAN B: kept independently testable; no COPY or MOVE request here.
export async function moveFileVerified(client, sourcePath, targetPath, overwrite = false) {
  if (sourcePath === targetPath) return;
  await copyFileContentsVerified(client, sourcePath, targetPath, overwrite);
  await deleteRemoteItemVerified(client, sourcePath);
}

export async function deleteRemoteItemVerified(client, sourcePath) {
  const path = normalizeRemotePath(sourcePath);
  if (!sourcePath || path === '/') throw new Error('WebDAV ROOT는 삭제할 수 없습니다.');
  let deleteError;
  try {
    await client.deleteFile(path);
  } catch (error) {
    deleteError = error;
  }
  // DELETE can succeed even when its response is lost. Never report success
  // based only on a 2xx response (207 may contain per-item failures).
  if (await client.exists(path)) {
    throw wrapMoveError('삭제 확인', path, deleteError || new Error('서버에 원본이 남아 있습니다'));
  }
}

export async function deleteDirectoryVerified(client, sourcePath) {
  const entries = await client.getDirectoryContents(sourcePath);
  if (entries.some((entry) => normalizeRemotePath(entry.filename) !== normalizeRemotePath(sourcePath))) {
    throw new Error(`원본 폴더에 파일이 남아 있어 삭제하지 않았습니다 (${sourcePath})`);
  }
  await deleteRemoteItemVerified(client, sourcePath);
}

export async function saveFileVerified(client, path, content, options = {}) {
  const saved = await client.putFileContents(path, content, options);
  if (saved === false) {
    const error = new Error(`저장 실패: 같은 이름의 파일이 있거나 저장 조건이 변경되었습니다 (${path})`);
    error.status = 412;
    throw error;
  }
  const actual = await client.getFileContents(path, { format: 'text' });
  if (actual !== content) throw new Error(`저장된 내용이 일치하지 않습니다 (${path})`);
}

export async function moveRemoteItemVerified(client, source, target, { isDirectory = false, overwrite = false, onProgress = () => {} } = {}) {
  const sourcePath = normalizeRemotePath(source);
  const targetPath = normalizeRemotePath(target);
  if (!source || !target || sourcePath === '/' || targetPath === '/') throw new Error('이동 경로를 확인하세요.');
  if (sourcePath === targetPath) return;
  if (targetPath.startsWith(`${sourcePath}/`)) throw new Error('자기 자신의 하위 폴더로 이동할 수 없습니다.');
  const targetExisted = await client.exists(targetPath);
  if (targetExisted && (!overwrite || isDirectory)) {
    const error = new Error(`대상에 같은 이름의 항목이 있습니다 (${targetPath})`);
    error.status = 412;
    throw error;
  }
  onProgress({ completed: 0, total: 1, phase: 'PLAN A · NAS에서 이동', path: sourcePath });
  let moveError;
  try {
    await client.moveFile(sourcePath, targetPath, { overwrite });
  } catch (error) {
    if (!shouldFallbackToCopyDelete(error)) throw error;
    moveError = error;
  }
  const [sourceRemains, targetCreated] = await Promise.all([client.exists(sourcePath), client.exists(targetPath)]);
  if (!sourceRemains && targetCreated) {
    onProgress({ completed: 1, total: 1, phase: 'PLAN A · 이동 확인 완료', path: targetPath });
    return;
  }
  // Do not repeat a MOVE whose result is ambiguous, or overwrite a partial
  // destination. User can inspect both locations without further mutation.
  if (!moveError || !sourceRemains || targetCreated) {
    throw new Error(`NAS 이동 결과를 확정할 수 없어 중단했습니다. 원본과 대상 경로를 확인하세요 (${sourcePath} → ${targetPath})`);
  }

  onProgress({ completed: 0, total: 1, phase: 'PLAN B · 내용 복사 후 검증', path: sourcePath });
  if (!isDirectory) {
    await moveFileVerified(client, sourcePath, targetPath, false);
    onProgress({ completed: 1, total: 1, phase: 'PLAN B · 이동 확인 완료', path: targetPath });
    return;
  }
  const entries = await collectDirectoryEntries(client, sourcePath);
  const directories = [sourcePath, ...entries.filter((entry) => entry.type === 'directory').map((entry) => entry.filename)]
    .sort((a, b) => a.split('/').length - b.split('/').length);
  const files = entries.filter((entry) => entry.type !== 'directory');
  const destinationOf = (path) => `${targetPath}${path.slice(sourcePath.length)}`;
  const total = directories.length * 2 + files.length * 2;
  let completed = 0;
  const progress = (phase, path) => onProgress({ completed: ++completed, total, phase: `PLAN B · ${phase}`, path });
  for (const path of directories) {
    await createDirectoryVerified(client, destinationOf(path));
    progress('대상 폴더 생성', destinationOf(path));
  }
  // Preserve the entire source tree until ALL target files have been saved
  // and byte-verified. A later upload failure must not delete earlier files.
  for (const file of files) {
    await copyFileContentsVerified(client, file.filename, destinationOf(file.filename), false);
    progress('파일 저장·내용 검증', destinationOf(file.filename));
  }
  for (const file of files) {
    await deleteRemoteItemVerified(client, file.filename);
    progress('검증 후 원본 파일 삭제', file.filename);
  }
  for (const path of [...directories].reverse()) {
    await deleteDirectoryVerified(client, path);
    progress('빈 원본 폴더 정리', path);
  }
}

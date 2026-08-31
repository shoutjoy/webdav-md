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

export async function moveFileVerified(client, sourcePath, targetPath, overwrite = false) {
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

  try {
    await client.deleteFile(sourcePath);
  } catch (error) {
    throw wrapMoveError('복사 확인 후 원본 파일 삭제', sourcePath, error);
  }
}

export async function deleteDirectoryVerified(client, sourcePath) {
  try {
    await client.deleteFile(sourcePath);
  } catch (error) {
    throw wrapMoveError('빈 원본 폴더 삭제', sourcePath, error);
  }
}

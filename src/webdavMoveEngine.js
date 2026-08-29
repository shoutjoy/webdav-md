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
  try {
    await client.copyFile(sourcePath, targetPath, { overwrite });
  } catch (error) {
    let copied = false;
    try { copied = await client.exists(targetPath); } catch { /* Preserve the COPY error. */ }
    if (!copied) throw wrapMoveError('서버 내부 파일 복사', targetPath, error);
  }

  let copied = false;
  try {
    copied = await client.exists(targetPath);
  } catch (error) {
    throw wrapMoveError('대상 파일 확인', targetPath, error);
  }
  if (!copied) throw new Error(`대상 파일 생성 확인 실패 (${targetPath})`);

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

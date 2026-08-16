import React, { useEffect, useState, useRef } from 'react';
import { createClient } from 'webdav';
import CodeEditPage from './components/CodeEditPage.jsx';
import FileExplorer from './components/FileExplorer.jsx';
import LoginPage from './components/LoginPage.jsx';
import TopNav from './components/TopNav.jsx';

const SAVED_LOGIN_KEY = 'webdav-viewer-login';
const TEXT_FILE_EXTENSIONS = new Set([
  'bash',
  'c',
  'conf',
  'cpp',
  'cs',
  'css',
  'csv',
  'env',
  'go',
  'h',
  'hpp',
  'html',
  'ini',
  'java',
  'js',
  'jsx',
  'json',
  'log',
  'md',
  'php',
  'py',
  'rb',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

export default function App() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saveLoginInfo, setSaveLoginInfo] = useState(false);
  
  const [isConnected, setIsConnected] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(45);
  const [toastMessage, setToastMessage] = useState('');

  const fileInputRef = useRef(null);
  const clientRef = useRef(null);
  const dragCounterRef = useRef(0);
  const selectedFileRef = useRef(null);
  const editorContentRef = useRef('');
  const splitContainerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const hasEditorChanges = selectedFile && editorContent !== savedContent;

  const joinRemotePath = (dirPath, name) =>
    dirPath === '/' ? `/${name}` : `${dirPath.replace(/\/$/, '')}/${name}`;

  const buildPublicUrl = (baseUrl, remotePath) => {
    const base = baseUrl.trim().replace(/\/$/, '');
    const path = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
    const encoded = path
      .split('/')
      .map((seg, i) => (i === 0 && seg === '' ? '' : encodeURIComponent(seg)))
      .join('/');
    return `${base}${encoded}`;
  };

  const updateHistoryPath = (path, replace = false) => {
    const state = { ...(window.history.state || {}), webdavPath: path };
    if (replace) {
      window.history.replaceState(state, '', window.location.href);
    } else {
      window.history.pushState(state, '', window.location.href);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 2000);
  };

  const handleCopyUrl = async (remotePath, key) => {
    const publicUrl = buildPublicUrl(url, remotePath);
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      showToast('URL이 복사되었습니다.');
    } else {
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  /** 401이면 연결 정보(url·계정)는 유지한 채 로그인 화면으로 복귀 */
  const returnToLoginIfUnauthorized = (err) => {
    if (err?.status !== 401) return false;
    clientRef.current = null;
    setIsConnected(false);
    setFiles([]);
    setCurrentPath('/');
    setError('인증이 필요합니다(401). 비밀번호를 확인한 뒤 다시 접속해 주세요.');
    return true;
  };

  // 연결 및 루트 디렉토리 읽기
  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const baseUrl = url.trim().replace(/\/$/, '');
      clientRef.current = createClient(baseUrl, { username, password });
      const listed = await loadDirectory('/');
      if (listed) {
        if (saveLoginInfo) {
          localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({ url: baseUrl, username }));
        } else {
          localStorage.removeItem(SAVED_LOGIN_KEY);
        }
        updateHistoryPath('/', true);
        setIsConnected(true);
      } else {
        clientRef.current = null;
      }
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        clientRef.current = null;
        setError(`연결 실패: ${err.message}. CORS 설정이나 인증 정보를 확인하세요.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 특정 디렉토리 읽기
  const loadDirectory = async (path) => {
    const client = clientRef.current;
    if (!client) {
      setError('클라이언트가 초기화되지 않았습니다.');
      return false;
    }

    setLoading(true);
    setError('');
    try {
      const items = await client.getDirectoryContents(path);
      const newFiles = items
        .map((item) => ({
          name: item.basename,
          remotePath: item.filename,
          isDirectory: item.type === 'directory',
          size: item.size ?? 0,
          lastModified: item.lastmod ? new Date(item.lastmod) : null,
        }))
        .sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
      setFiles(newFiles);
      setCurrentPath(path);
      return true;
    } catch (err) {
      if (returnToLoginIfUnauthorized(err)) return false;
      setError(`목록 불러오기 실패: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const navigateToDirectory = async (path) => {
    const previousPath = currentPath;
    updateHistoryPath(path);
    const listed = await loadDirectory(path);
    if (!listed) updateHistoryPath(previousPath, true);
  };

  const textFromFileContents = async (data) => {
    if (typeof data === 'string') return data;
    if (data instanceof Blob) return data.text();
    return new TextDecoder().decode(data);
  };

  const isTextFile = (fileName) => {
    const parts = fileName.toLowerCase().split('.');
    if (parts.length === 1) return true;
    return TEXT_FILE_EXTENSIONS.has(parts.at(-1));
  };

  const confirmEditorClose = () => {
    if (!hasEditorChanges) return true;
    return window.confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?');
  };

  const handleOpenFile = async (file) => {
    if (!confirmEditorClose()) return;
    if (!isTextFile(file.name) && !window.confirm('텍스트 파일이 아닐 수 있습니다. 정말 여시겠습니까?')) {
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    setEditorLoading(true);
    setError('');
    try {
      const data = await client.getFileContents(file.remotePath, { format: 'text' });
      const text = await textFromFileContents(data);
      setSelectedFile(file);
      setEditorContent(text);
      setSavedContent(text);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`파일 열기 실패: ${err.message}`);
      }
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveFile = async () => {
    const client = clientRef.current;
    const file = selectedFileRef.current;
    const content = editorContentRef.current;
    if (!client || !file) return;

    setEditorLoading(true);
    setError('');
    try {
      await client.putFileContents(file.remotePath, content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
      setSavedContent(content);
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`저장 실패: ${err.message}`);
      }
    } finally {
      setEditorLoading(false);
    }
  };

  const handleCloseEditor = () => {
    if (!confirmEditorClose()) return;
    setSelectedFile(null);
    setEditorContent('');
    setSavedContent('');
  };

  const handleCopyCode = async () => {
    if (!selectedFile) return;
    const ok = await copyToClipboard(editorContentRef.current);
    if (ok) {
      showToast('파일 내용이 복사되었습니다.');
    } else {
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  const handleResizeStart = (event) => {
    if (!splitContainerRef.current) return;

    const container = splitContainerRef.current;
    const updateWidth = (clientX) => {
      const rect = container.getBoundingClientRect();
      const nextWidth = ((clientX - rect.left) / rect.width) * 100;
      setExplorerWidth(Math.min(70, Math.max(30, nextWidth)));
    };
    const handlePointerMove = (moveEvent) => updateWidth(moveEvent.clientX);
    const handlePointerUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    event.preventDefault();
    updateWidth(event.clientX);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // 파일 다운로드
  const handleDownload = async (fileName) => {
    const client = clientRef.current;
    if (!client) return;

    try {
      setLoading(true);
      const filePath = joinRemotePath(currentPath, fileName);
      const data = await client.getFileContents(filePath);
      const blob = new Blob([data], { type: 'application/octet-stream' });
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`다운로드 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const ensureParentDirectories = async (client, filePath) => {
    const parts = filePath.split('/').filter(Boolean);
    parts.pop();
    let dirPath = '';
    for (const part of parts) {
      dirPath += `/${part}`;
      try {
        await client.createDirectory(dirPath);
      } catch {
        // directory may already exist
      }
    }
  };

  const uploadFile = async (file, relativePath) => {
    const client = clientRef.current;
    if (!client) return;

    const filePath = joinRemotePath(currentPath, relativePath || file.name);
    await ensureParentDirectories(client, filePath);
    const body = await file.arrayBuffer();
    await client.putFileContents(filePath, body, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });
  };

  const readDirectoryEntry = async (dirEntry, basePath = '') => {
    const files = [];
    const reader = dirEntry.createReader();

    const readEntries = () =>
      new Promise((resolve, reject) => reader.readEntries(resolve, reject));

    let entries = [];
    let batch;
    do {
      batch = await readEntries();
      entries = entries.concat(batch);
    } while (batch.length > 0);

    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const relativePath = basePath ? `${basePath}/${file.name}` : file.name;
        files.push({ file, relativePath });
      } else if (entry.isDirectory) {
        const subPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        const subFiles = await readDirectoryEntry(entry, subPath);
        files.push(...subFiles);
      }
    }
    return files;
  };

  const collectDropFiles = async (dataTransfer) => {
    const items = [...dataTransfer.items];
    const result = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (!entry) continue;
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        result.push({ file, relativePath: file.name });
      } else if (entry.isDirectory) {
        const dirFiles = await readDirectoryEntry(entry, entry.name);
        result.push(...dirFiles);
      }
    }

    if (result.length === 0 && dataTransfer.files.length > 0) {
      for (const file of dataTransfer.files) {
        result.push({ file, relativePath: file.name });
      }
    }
    return result;
  };

  const uploadFiles = async (fileEntries) => {
    const client = clientRef.current;
    if (!client || fileEntries.length === 0) return;

    setLoading(true);
    setError('');
    try {
      for (const { file, relativePath } of fileEntries) {
        await uploadFile(file, relativePath);
      }
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`업로드 실패: ${err.message} (서버의 CORS 설정에서 PUT 허용 여부를 확인하세요)`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드
  const handleUpload = async (e) => {
    const selected = [...e.target.files];
    if (selected.length === 0) return;

    await uploadFiles(selected.map((file) => ({ file, relativePath: file.name })));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (loading) return;

    const fileEntries = await collectDropFiles(e.dataTransfer);
    await uploadFiles(fileEntries);
  };

  // 파일 삭제
  const handleDelete = async (fileName) => {
    if (!window.confirm(`'${fileName}'을(를) 정말 삭제하시겠습니까?`)) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      await client.deleteFile(joinRemotePath(currentPath, fileName));
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`삭제 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일 이름 변경
  const handleRename = async (oldName) => {
    const newName = window.prompt('새 이름을 입력하세요:', oldName);
    if (!newName || newName === oldName) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      const oldPath = joinRemotePath(currentPath, oldName);
      const newPath = joinRemotePath(currentPath, newName);
      await client.moveFile(oldPath, newPath);
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`이름 변경 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const savedLogin = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
      if (savedLogin?.url || savedLogin?.username) {
        setUrl(savedLogin.url || '');
        setUsername(savedLogin.username || '');
        setSaveLoginInfo(true);
      }
    } catch {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handlePopState = (event) => {
      loadDirectory(event.state?.webdavPath || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isConnected]);

  useEffect(() => {
    if (!hasEditorChanges) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasEditorChanges]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 이전 폴더로 이동
  const goUp = () => {
    if (currentPath === '/') return;
    window.history.back();
  };

  const openDirectory = (file) => {
    const nextPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    navigateToDirectory(nextPath);
  };

  // 파일 크기 포맷터
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 날짜 포맷터
  const formatDate = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // 로그인 화면 렌더링
  if (!isConnected) {
    return (
      <LoginPage
        url={url}
        username={username}
        password={password}
        saveLoginInfo={saveLoginInfo}
        loading={loading}
        error={error}
        onUrlChange={setUrl}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onSaveLoginInfoChange={setSaveLoginInfo}
        onSubmit={handleConnect}
      />
    );
  }

  // 메인 파일 매니저 렌더링
  return (
    <div className="min-h-screen overflow-hidden bg-gray-50 p-4 sm:p-6">
      <div className={`${selectedFile ? 'max-w-[min(1800px,98vw)]' : 'max-w-7xl'} mx-auto`}>
        <TopNav
          currentPath={currentPath}
          publicUrl={buildPublicUrl(url, currentPath)}
          loading={loading}
          error={error}
          copiedKey={copiedKey}
          fileInputRef={fileInputRef}
          onGoBack={goUp}
          onUpload={handleUpload}
          onRefresh={() => loadDirectory(currentPath)}
          onCopyFolderUrl={() => handleCopyUrl(currentPath, 'folder')}
          onDisconnect={() => {
            clientRef.current = null;
            setIsConnected(false);
          }}
        />

        <div
          ref={splitContainerRef}
          className={`mt-3 flex max-h-[calc(100vh-180px)] min-h-0 flex-col overflow-hidden lg:flex-row ${selectedFile ? 'gap-1' : 'lg:block gap-3'}`}
        >
          <FileExplorer
            files={files}
            loading={loading}
            editorLoading={editorLoading}
            copiedKey={copiedKey}
            isDragging={isDragging}
            selectedFile={selectedFile}
            explorerWidth={explorerWidth}
            formatBytes={formatBytes}
            formatDate={formatDate}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onOpenDirectory={openDirectory}
            onCopyUrl={handleCopyUrl}
            onOpenFile={handleOpenFile}
            onDownload={handleDownload}
            onRename={handleRename}
            onDelete={handleDelete}
          />

          {selectedFile && (
            <>
              <div
                className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center rounded-md hover:bg-gray-200 lg:flex"
                onPointerDown={handleResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="탐색기와 에디터 너비 조절"
                title="너비 조절"
              >
                <div className="h-10 w-2 rounded-full bg-gray-300" />
              </div>
              <CodeEditPage
                selectedFile={selectedFile}
                editorContent={editorContent}
                editorLoading={editorLoading}
                hasEditorChanges={hasEditorChanges}
                explorerWidth={explorerWidth}
                onContentChange={setEditorContent}
                onSave={handleSaveFile}
                onCopy={handleCopyCode}
                onClose={handleCloseEditor}
              />
            </>
          )}
        </div>
      </div>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

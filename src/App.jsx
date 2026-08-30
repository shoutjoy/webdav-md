import React, { useCallback, useEffect, useState, useRef } from 'react';
import { create } from 'zustand';
import { createClient } from 'webdav';
import MdproEditor from './components/MdproEditor.jsx';
import FileExplorer from './components/FileExplorer.jsx';
import LoginPage from './components/LoginPage.jsx';
import TopNav from './components/TopNav.jsx';
import MobileWdocButton from './components/MobileWdocButton.jsx';
import RenameModal from './components/RenameModal.jsx';
import CreateDestinationModal from './components/CreateDestinationModal.jsx';
import { normalizeRemotePath } from './webdavPaths.js';
import { collectDirectoryEntries, shouldFallbackToCopyDelete } from './webdavMove.js';
import { createDirectoryVerified, deleteDirectoryVerified, moveFileVerified } from './webdavMoveEngine.js';
import { isDmergeFileName, readDmergeArchive } from './dmergeArchive.js';
import { clearLoginSession, readLoginSession, writeLoginSession } from './loginSession.js';

const SAVED_LOGIN_KEY = 'webdav-viewer-login';
const EXPLORER_WIDTH_KEY = 'webdav-explorer-width';
const MOBILE_EXPLORER_WIDTH_KEY = 'webdav-mobile-explorer-width';
const EXPLORER_COMPACT_KEY = 'webdav-explorer-compact';
const DEFAULT_EXPLORER_WIDTH = 20;
const MOBILE_DEFAULT_EXPLORER_WIDTH = 33.333;
const MIN_EXPLORER_WIDTH_PX = 100;
const MAX_EXPLORER_WIDTH = 72;
const LOCAL_WEB_DAV_PROXY_PATH = '/__webdav_proxy';
const WEB_DAV_REQUEST_TIMEOUT_MS = 20000;
const PROXIED_WEB_DAV_HOSTS = new Set(['webdav.freemath.synology.me']);

const getClientBaseUrl = (serverUrl) => {
  const target = new URL(serverUrl);
  const currentHost = window.location.hostname.toLowerCase();
  const isLocalApp = import.meta.env.DEV || currentHost === 'localhost' || currentHost === '127.0.0.1';

  if (isLocalApp && PROXIED_WEB_DAV_HOSTS.has(target.hostname.toLowerCase())) {
    return `${window.location.origin}${LOCAL_WEB_DAV_PROXY_PATH}${target.pathname.replace(/\/$/, '')}`;
  }

  return serverUrl;
};
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
const MEDIA_FILE_TYPES = {
  mp3: 'audio',
  ogg: 'audio',
  wav: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  pdf: 'pdf',
};
const FMA_IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);
const MEDIA_MIME_TYPES = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

const getDirectoryName = (path) => {
  if (path === '/') return '/';
  return path.replace(/\/$/, '').split('/').filter(Boolean).at(-1) || '/';
};

const createDirectoryNode = (path, entries = [], loaded = false) => ({
  path,
  name: getDirectoryName(path),
  isDirectory: true,
  loaded,
  entries,
});

const findDirectoryNode = (node, targetPath) => {
  if (!node) return null;
  if (normalizeRemotePath(node.path || node.remotePath) === normalizeRemotePath(targetPath)) return node;

  for (const entry of node.entries || []) {
    if (!entry.isDirectory && !entry.isArchive) continue;
    const match = findDirectoryNode(entry, targetPath);
    if (match) return match;
  }

  return null;
};

const hydrateDirectoryEntries = (entries, tree) =>
  entries.map((entry) => {
    if (!entry.isDirectory && !entry.isArchive) return entry;

    const existingNode = findDirectoryNode(tree, entry.remotePath);
    return {
      ...entry,
      entries: existingNode?.entries || [],
      loaded: existingNode?.loaded || false,
    };
  });

const updateDirectoryNode = (node, targetPath, nextEntries) => {
  if (!node) return node;
  if (normalizeRemotePath(node.path || node.remotePath) === normalizeRemotePath(targetPath)) {
    return {
      ...node,
      loaded: true,
      entries: nextEntries,
    };
  }

  let changed = false;
  const entries = (node.entries || []).map((entry) => {
    if (!entry.isDirectory && !entry.isArchive) return entry;

    const updated = updateDirectoryNode(entry, targetPath, nextEntries);
    if (updated !== entry) changed = true;
    return updated;
  });

  return changed ? { ...node, entries } : node;
};

const mapWebDavEntries = (items) => items
  .map((item) => ({
    name: item.basename,
    remotePath: normalizeRemotePath(item.filename),
    isDirectory: item.type === 'directory',
    size: item.size ?? 0,
    lastModified: item.lastmod ? new Date(item.lastmod) : null,
    ...(item.type !== 'directory' && isDmergeFileName(item.basename)
      ? { isArchive: true, loaded: false, entries: [] }
      : {}),
  }))
  .filter((item) => item.name && item.name !== '..');

const buildDirectoryTree = (entries) => {
  const root = createDirectoryNode('/', [], true);
  const directoryMap = new Map([['/', root]]);
  const ensureDirectory = (path) => {
    const normalized = normalizeRemotePath(path);
    if (directoryMap.has(normalized)) return directoryMap.get(normalized);
    const parts = normalized.split('/').filter(Boolean);
    const name = parts.pop();
    const parentPath = parts.length ? `/${parts.join('/')}` : '/';
    const parent = ensureDirectory(parentPath);
    const node = createDirectoryNode(normalized, [], true);
    node.name = name;
    parent.entries.push(node);
    directoryMap.set(normalized, node);
    return node;
  };
  entries.forEach((entry) => {
    const remotePath = normalizeRemotePath(entry.remotePath);
    if (remotePath === '/') return;
    if (entry.isDirectory) {
      const node = ensureDirectory(remotePath);
      Object.assign(node, entry, { remotePath, path: remotePath, entries: node.entries, loaded: true });
      return;
    }
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    const parent = ensureDirectory(parts.length ? `/${parts.join('/')}` : '/');
    parent.entries.push({ ...entry, remotePath });
  });
  const sortNode = (node) => {
    node.entries.sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : (a.isDirectory ? -1 : 1));
    node.entries.filter((item) => item.isDirectory).forEach(sortNode);
  };
  sortNode(root);
  return root;
};

const useDirectoryStore = create((set) => ({
  currentPath: '/',
  currentFiles: [],
  directoryTree: createDirectoryNode('/'),
  setDirectoryContents: (path, rawEntries) =>
    set((state) => {
      const currentFiles = hydrateDirectoryEntries(rawEntries, state.directoryTree);
      const directoryTree = updateDirectoryNode(state.directoryTree, path, currentFiles);

      return {
        currentPath: path,
        currentFiles,
        directoryTree,
      };
    }),
  setArchiveContents: (path, entries) =>
    set((state) => ({
      directoryTree: updateDirectoryNode(state.directoryTree, path, entries),
    })),
  resetDirectoryState: () =>
    set({
      currentPath: '/',
      currentFiles: [],
      directoryTree: createDirectoryNode('/'),
    }),
  setFullDirectoryTree: (entries) => set(() => {
    const directoryTree = buildDirectoryTree(entries);
    return { currentPath: '/', currentFiles: directoryTree.entries, directoryTree };
  }),
}));

export default function App() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saveLoginInfo, setSaveLoginInfo] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [, setSavedContent] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [isWebDavSaving, setIsWebDavSaving] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const savedWidth = Number.parseFloat(localStorage.getItem(isMobile ? MOBILE_EXPLORER_WIDTH_KEY : EXPLORER_WIDTH_KEY));
    return Number.isFinite(savedWidth)
      ? Math.min(MAX_EXPLORER_WIDTH, Math.max(0, savedWidth))
      : (isMobile ? MOBILE_DEFAULT_EXPLORER_WIDTH : DEFAULT_EXPLORER_WIDTH);
  });
  const [isExplorerCompact, setIsExplorerCompact] = useState(() => localStorage.getItem(EXPLORER_COMPACT_KEY) === 'true');
  const [isExplorerOpen, setIsExplorerOpen] = useState(() => (
    window.matchMedia('(max-width: 767px)').matches
      ? false
      : localStorage.getItem('webdav-explorer-open') !== 'false'
  ));
  const [isDarkTheme, setIsDarkTheme] = useState(() => localStorage.getItem('md_viewer_theme') === 'dark');
  const [toastMessage, setToastMessage] = useState('');
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [createDestinationType, setCreateDestinationType] = useState('');
  const [moveProgress, setMoveProgress] = useState(null);
  const [mobileWdocRect, setMobileWdocRect] = useState(null);

  const fileInputRef = useRef(null);
  const clientRef = useRef(null);
  const dragCounterRef = useRef(0);
  const selectedFileRef = useRef(null);
  const lastTextFileRef = useRef(null);
  const editorContentRef = useRef('');
  const splitContainerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const mediaPreviewUrlRef = useRef('');
  const dmergeCacheRef = useRef(new Map());
  const nextWebDavFmaImportRef = useRef('');
  const [editorBinary, setEditorBinary] = useState(null);
  const [fmaImportBatch, setFmaImportBatch] = useState(null);
  const [isSelectingFmaFolder, setIsSelectingFmaFolder] = useState(false);
  const currentPath = useDirectoryStore((state) => state.currentPath);
  const files = useDirectoryStore((state) => state.currentFiles);
  const directoryTree = useDirectoryStore((state) => state.directoryTree);
  const setDirectoryContents = useDirectoryStore((state) => state.setDirectoryContents);
  const setDirectoryContentsForArchive = useDirectoryStore((state) => state.setArchiveContents);
  const resetDirectoryState = useDirectoryStore((state) => state.resetDirectoryState);
  const setFullDirectoryTree = useDirectoryStore((state) => state.setFullDirectoryTree);

  const hasEditorChanges = selectedFile?.viewMode === 'text' && editorDirty;

  const createConfiguredWebDavClient = () => {
    const baseUrl = url.trim().replace(/\/$/, '');
    const clientBaseUrl = getClientBaseUrl(baseUrl);
    const usesLocalProxy = new URL(clientBaseUrl, window.location.origin).pathname.startsWith(LOCAL_WEB_DAV_PROXY_PATH);
    const client = createClient(clientBaseUrl, {
      username,
      password,
      ...(usesLocalProxy ? { remoteBasePath: '/' } : {}),
    });
    clientRef.current = client;
    return client;
  };

  const joinRemotePath = (dirPath, name) =>
    dirPath === '/' ? `/${name}` : `${dirPath.replace(/\/$/, '')}/${name}`;

  const nextAvailableName = (fileName, usedNames) => {
    const dotIndex = fileName.lastIndexOf('.');
    const hasExtension = dotIndex > 0;
    const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
    const extension = hasExtension ? fileName.slice(dotIndex) : '';
    let index = 1;
    let candidate = `${baseName} (${index})${extension}`;
    while (usedNames.has(candidate.toLocaleLowerCase())) {
      index += 1;
      candidate = `${baseName} (${index})${extension}`;
    }
    return candidate;
  };

  const buildPublicUrl = (baseUrl, remotePath) => {
    const base = baseUrl.trim().replace(/\/$/, '');
    const path = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
    const encoded = path
      .split('/')
      .map((seg, i) => (i === 0 && seg === '' ? '' : encodeURIComponent(seg)))
      .join('/');
    return `${base}${encoded}`;
  };

  const moveRemoteItem = async (client, sourcePath, targetPath, isDirectory = false, overwrite = false, options = {}) => {
    const reportProgress = options.onProgress || (() => {});
    if (!options.copyDeleteOnly) {
      try {
        await client.customRequest(sourcePath, {
          method: 'MOVE',
          headers: {
            Destination: buildPublicUrl(url, targetPath),
            Overwrite: overwrite ? 'T' : 'F',
          },
        });
        reportProgress({ completed: 1, total: 1, path: targetPath });
        return;
      } catch (error) {
        if (!shouldFallbackToCopyDelete(error)) throw error;
      }
    }

    const sourceStat = isDirectory ? null : await client.stat(sourcePath);
    const moveDirectory = isDirectory || sourceStat?.type === 'directory';
    if (!moveDirectory) {
      reportProgress({ completed: 0, total: 1, phase: '2단계 · 파일을 하나씩 이동', path: sourcePath });
      await moveFileVerified(client, sourcePath, targetPath, overwrite);
      reportProgress({ completed: 1, total: 1, phase: '2단계 · 이동 완료', path: targetPath });
      return;
    }

    // Depth: infinity is not consistently implemented by WebDAV servers.
    // Traverse each directory explicitly so a folder move includes every
    // nested file and subfolder before the source is removed.
    let entries;
    try {
      entries = await collectDirectoryEntries(client, sourcePath);
    } catch (error) {
      const wrapped = new Error(`원본 폴더 내용 읽기 실패 (${sourcePath}): ${error?.message || error}`);
      wrapped.status = error?.status || error?.response?.status;
      throw wrapped;
    }
    const directories = entries
      .filter((entry) => entry.type === 'directory')
      .map((entry) => normalizeRemotePath(entry.filename))
      .filter((path) => path !== sourcePath)
      .sort((a, b) => a.split('/').length - b.split('/').length);
    const filesToCopy = entries.filter((entry) => entry.type !== 'directory');
    const directoryCount = 1 + directories.length;
    const total = directoryCount * 2 + filesToCopy.length;
    let completed = 0;
    reportProgress({ completed, total, phase: '1단계 · 대상 폴더 구조 생성', path: sourcePath });
    await createDirectoryVerified(client, targetPath);
    completed += 1;
    reportProgress({ completed, total, phase: '1단계 · 대상 폴더 구조 생성', path: targetPath });
    for (const directoryPath of directories) {
      const relativePath = directoryPath.slice(sourcePath.length).replace(/^\/+/, '');
      if (relativePath) {
        const createdPath = joinRemotePath(targetPath, relativePath);
        await createDirectoryVerified(client, createdPath);
        completed += 1;
        reportProgress({ completed, total, phase: '1단계 · 대상 폴더 구조 생성', path: createdPath });
      }
    }
    reportProgress({ completed, total, phase: '2단계 · 파일을 하나씩 이동', path: filesToCopy[0]?.filename || targetPath });
    for (const entry of filesToCopy) {
      const entryPath = normalizeRemotePath(entry.filename);
      const relativePath = entryPath.slice(sourcePath.length).replace(/^\/+/, '');
      const copiedPath = joinRemotePath(targetPath, relativePath);
      await moveFileVerified(client, entryPath, copiedPath, false);
      completed += 1;
      reportProgress({ completed, total, phase: '2단계 · 파일을 하나씩 이동', path: copiedPath });
    }
    const deepestDirectoriesFirst = [...directories].sort((a, b) => b.split('/').length - a.split('/').length);
    for (const directoryPath of deepestDirectoriesFirst) {
      await deleteDirectoryVerified(client, directoryPath);
      completed += 1;
      reportProgress({ completed, total, phase: '2단계 · 원본 정리', path: directoryPath });
    }
    await deleteDirectoryVerified(client, sourcePath);
    completed += 1;
    reportProgress({ completed, total, phase: '2단계 · 이동 완료', path: targetPath });
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
  const clearMediaPreview = useCallback(() => {
    if (mediaPreviewUrlRef.current) URL.revokeObjectURL(mediaPreviewUrlRef.current);
    mediaPreviewUrlRef.current = '';
    setMediaPreviewUrl('');
  }, []);

  const returnToLoginIfUnauthorized = useCallback((err) => {
    if (err?.status !== 401) return false;
    clearLoginSession(sessionStorage);
    clientRef.current = null;
    dmergeCacheRef.current.clear();
    setIsConnected(false);
    resetDirectoryState();
    setSelectedFile(null);
    setEditorContent('');
    setSavedContent('');
    clearMediaPreview();
    setError('인증이 필요합니다(401). 비밀번호를 확인한 뒤 다시 접속해 주세요.');
    return true;
  }, [clearMediaPreview, resetDirectoryState]);

  // 연결 및 루트 디렉토리 읽기
  const connectWithCredentials = async ({
    nextUrl = url,
    nextUsername = username,
    nextPassword = password,
    rememberLogin = null,
  } = {}) => {
    setLoading(true);
    setError('');

    try {
      const baseUrl = nextUrl.trim().replace(/\/$/, '');
      const clientBaseUrl = getClientBaseUrl(baseUrl);
      const usesLocalProxy = new URL(clientBaseUrl, window.location.origin).pathname.startsWith(LOCAL_WEB_DAV_PROXY_PATH);
      clientRef.current = createClient(clientBaseUrl, {
        username: nextUsername,
        password: nextPassword,
        ...(usesLocalProxy ? { remoteBasePath: '/' } : {}),
      });
      const listed = await loadFullTree();
      if (listed) {
        writeLoginSession(sessionStorage, {
          url: baseUrl,
          username: nextUsername,
          password: nextPassword,
        });
        if (rememberLogin === true) {
          localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({ url: baseUrl, username: nextUsername }));
        } else if (rememberLogin === false) {
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
        setError(`연결 실패: ${err.message}. 로컬 앱 서버, WebDAV 주소 또는 인증 정보를 확인하세요.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 특정 디렉토리 읽기
  const loadDirectory = useCallback(async (path) => {
    const client = clientRef.current;
    if (!client) {
      setError('클라이언트가 초기화되지 않았습니다.');
      return false;
    }

    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), WEB_DAV_REQUEST_TIMEOUT_MS);
    try {
      const normalizedPath = normalizeRemotePath(path);
      let items;
      try {
        items = await client.getDirectoryContents(normalizedPath, { signal: controller.signal });
      } catch (firstError) {
        if (firstError?.status !== 404 || normalizedPath === '/') throw firstError;
        const alternatePath = normalizedPath.endsWith('/')
          ? normalizedPath.replace(/\/+$/, '') || '/'
          : `${normalizedPath}/`;
        items = await client.getDirectoryContents(alternatePath, { signal: controller.signal });
      }
      const newFiles = mapWebDavEntries(items)
        .sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
      setDirectoryContents(normalizedPath, newFiles);
      return true;
    } catch (err) {
      if (returnToLoginIfUnauthorized(err)) return false;
      const message = err?.name === 'AbortError'
        ? 'WebDAV 서버가 20초 안에 응답하지 않았습니다.'
        : err.message;
      setError(`목록 불러오기 실패: ${message}`);
      return false;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [returnToLoginIfUnauthorized, setDirectoryContents]);

  const loadFullTree = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return false;
    setLoading(true);
    setError('');
    try {
      let entries;
      try {
        entries = mapWebDavEntries(await client.getDirectoryContents('/', { deep: true }));
      } catch (deepError) {
        if (deepError?.status === 401) throw deepError;
        const collected = [];
        const visited = new Set();
        const walk = async (path) => {
          const normalizedPath = normalizeRemotePath(path);
          if (visited.has(normalizedPath)) return;
          visited.add(normalizedPath);
          const children = mapWebDavEntries(await client.getDirectoryContents(normalizedPath));
          collected.push(...children);
          for (const child of children) {
            if (child.isDirectory) await walk(child.remotePath);
          }
        };
        await walk('/');
        entries = collected;
      }
      setFullDirectoryTree(entries);
      return true;
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) setError(`전체 폴더 트리 불러오기 실패: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [returnToLoginIfUnauthorized, setFullDirectoryTree]);

  const navigateToDirectory = async (path) => {
    const previousPath = currentPath;
    updateHistoryPath(path);
    const listed = await loadDirectory(path);
    if (!listed) updateHistoryPath(previousPath, true);
    return listed;
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

  const getFileExtension = (fileName) => fileName.toLowerCase().split('.').at(-1) || '';

  const getMediaFileType = (fileName) => MEDIA_FILE_TYPES[getFileExtension(fileName)] || '';

  const isFmaImageFile = (fileName) => FMA_IMAGE_EXTENSIONS.has(getFileExtension(fileName));

  const isDocxFile = (fileName) => getFileExtension(fileName) === 'docx';

  const confirmEditorClose = () => {
    if (!hasEditorChanges) return true;
    return window.confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?');
  };

  const handleEditorDocumentChange = (content, dirty) => {
    editorContentRef.current = String(content ?? '');
    setEditorDirty(Boolean(dirty));
  };

  const saveBeforeOpeningFile = async (file) => {
    if (!hasEditorChanges) return true;
    const currentName = selectedFileRef.current?.name || '현재 문서';
    const nextName = file?.name || '선택한 파일';
    const shouldSave = window.confirm(
      `“${currentName}”의 내용이 변경되었습니다.\n변경 내용을 저장한 뒤 “${nextName}” 파일로 이동할까요?\n\n취소하면 현재 문서에 머뭅니다.`,
    );
    if (!shouldSave) return false;
    return handleSaveFile(editorContentRef.current);
  };

  const closeMobileWdocExplorer = () => {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    setIsExplorerOpen(false);
    localStorage.setItem('webdav-explorer-open', 'false');
  };

  const handleOpenFile = async (file) => {
    const currentPath = normalizeRemotePath(selectedFileRef.current?.remotePath || '/');
    const nextPath = normalizeRemotePath(file?.remotePath || '/');
    if (selectedFileRef.current && currentPath === nextPath && !file.isArchiveEntry) return;
    if (!(await saveBeforeOpeningFile(file))) return;
    if (file.isArchiveEntry) return handleOpenDmergeEntry(file);
    const fmaImage = isFmaImageFile(file.name);
    const fmaImportMode = fmaImage && nextWebDavFmaImportRef.current === 'image' ? 'append' : 'replace';
    if (fmaImage) {
      nextWebDavFmaImportRef.current = '';
      setIsSelectingFmaFolder(false);
    }
    const mediaType = getMediaFileType(file.name);
    const docxFile = isDocxFile(file.name);
    if (!isTextFile(file.name) && !fmaImage && !mediaType && !docxFile && !window.confirm('텍스트 파일이 아닐 수 있습니다. 정말 여시겠습니까?')) {
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    const remotePath = normalizeRemotePath(file.remotePath);
    const nextViewMode = fmaImage ? 'fma' : mediaType ? 'media' : docxFile ? 'docx' : 'text';
    setSelectedFile({ ...file, remotePath, viewMode: nextViewMode, fmaImportMode });
    setEditorBinary(null);
    setEditorContent('');
    setSavedContent('');
    setEditorDirty(false);
    editorContentRef.current = '';
    setEditorBinary(null);
    setEditorLoading(true);
    setError('');
    try {
      clearMediaPreview();
      if (fmaImage) {
        const data = await client.getFileContents(remotePath);
        setFmaImportBatch(null);
        setSelectedFile({ ...file, remotePath, viewMode: 'fma', fmaImportMode });
        setEditorContent('');
        setSavedContent('');
        setEditorBinary(data);
      } else if (mediaType) {
        const data = await client.getFileContents(remotePath);
        const mime = MEDIA_MIME_TYPES[getFileExtension(file.name)] || 'application/octet-stream';
        const blob = new Blob([data], { type: mime });
        setSelectedFile({ ...file, remotePath, viewMode: 'media' });
        setEditorContent('');
        setSavedContent('');
        setMediaPreviewUrl(URL.createObjectURL(blob));
      } else if (docxFile) {
        const data = await client.getFileContents(remotePath);
        setSelectedFile({ ...file, remotePath, viewMode: 'docx' });
        setEditorContent('');
        setSavedContent('');
        setEditorBinary(data);
      } else {
        const data = await client.getFileContents(remotePath, { format: 'text' });
        const text = await textFromFileContents(data);
        setSelectedFile({ ...file, remotePath, viewMode: 'text' });
        setEditorContent(text);
        setSavedContent(text);
        setEditorDirty(false);
        editorContentRef.current = text;
      }
      closeMobileWdocExplorer();
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`파일 열기 실패: ${err.message}`);
      }
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveFile = async (nextContent) => {
    const client = clientRef.current;
    const selected = selectedFileRef.current;
    const file = selected?.viewMode === 'text' ? selected : lastTextFileRef.current;
    const content = typeof nextContent === 'string' ? nextContent : editorContentRef.current;
    if (!client || !file || file.viewMode !== 'text') return false;

    setEditorLoading(true);
    setIsWebDavSaving(true);
    setError('');
    try {
      await client.putFileContents(file.remotePath, content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
      setSavedContent(content);
      setEditorContent(content);
      setEditorDirty(false);
      editorContentRef.current = content;
      showToast(`원본 위치에 저장했습니다: ${file.remotePath}`);
      await loadDirectory(currentPath);
      return true;
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`저장 실패: ${err.message}`);
      }
      return false;
    } finally {
      setIsWebDavSaving(false);
      setEditorLoading(false);
    }
  };

  const handleSaveFileAs = async (nextContent, sourcePath) => {
    const client = clientRef.current;
    if (!client) return;
    const normalizedSource = normalizeRemotePath(sourcePath || selectedFileRef.current?.remotePath || '/document.md');
    const parts = normalizedSource.split('/').filter(Boolean);
    const sourceName = parts.pop() || 'document.md';
    const dotIndex = sourceName.lastIndexOf('.');
    const copyName = dotIndex > 0
      ? `${sourceName.slice(0, dotIndex)}-copy${sourceName.slice(dotIndex)}`
      : `${sourceName}-copy.md`;
    const parentPath = parts.length ? `/${parts.join('/')}` : '/';
    const suggestedPath = parentPath === '/' ? `/${copyName}` : `${parentPath}/${copyName}`;
    const enteredPath = window.prompt('새 WebDAV 전체 경로를 입력하세요.', suggestedPath);
    if (!enteredPath) return;
    const targetPath = normalizeRemotePath(enteredPath);
    if (targetPath === normalizedSource) {
      showToast('다른 파일 경로를 입력해 주세요.');
      return;
    }
    setEditorLoading(true);
    setIsWebDavSaving(true);
    setError('');
    try {
      if (await client.exists(targetPath) && !window.confirm(`이미 존재하는 파일입니다. 덮어쓸까요?\n${targetPath}`)) return;
      const content = String(nextContent ?? '');
      await client.putFileContents(targetPath, content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      const name = targetPath.split('/').filter(Boolean).at(-1) || copyName;
      const nextFile = { ...(selectedFileRef.current || {}), name, remotePath: targetPath, viewMode: 'text' };
      setSelectedFile(nextFile);
      selectedFileRef.current = nextFile;
      lastTextFileRef.current = nextFile;
      setEditorContent(content);
      setSavedContent(content);
      setEditorDirty(false);
      editorContentRef.current = content;
      showToast(`새 WebDAV 파일로 저장했습니다: ${targetPath}`);
      await loadFullTree();
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) setError(`다른 이름으로 저장 실패: ${err.message}`);
    } finally {
      setIsWebDavSaving(false);
      setEditorLoading(false);
    }
  };

  const handleSaveImageToFolder = async (image) => {
    const client = clientRef.current;
    const sourceFile = selectedFileRef.current;
    if (!client || !sourceFile || !image?.src) return;

    setEditorLoading(true);
    setIsWebDavSaving(true);
    setError('');
    try {
      const sourcePath = normalizeRemotePath(sourceFile.remotePath);
      const sourceParts = sourcePath.split('/').filter(Boolean);
      sourceParts.pop();
      const parentPath = sourceParts.length ? `/${sourceParts.join('/')}` : '';
      const imageFolderPath = `${parentPath}/IMAGE`;
      await ensureParentDirectories(client, `${imageFolderPath}/placeholder`);
      try {
        await client.createDirectory(imageFolderPath);
      } catch {
        // IMAGE folder may already exist
      }

      const response = await fetch(String(image.src));
      if (!response.ok) throw new Error(`이미지 데이터를 읽지 못했습니다 (${response.status})`);
      const body = await response.arrayBuffer();
      const rawName = String(image.name || image.path || `fma-image-${Date.now()}.png`).split(/[\\/]/).pop();
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_') || `fma-image-${Date.now()}.png`;
      const dotIndex = safeName.lastIndexOf('.');
      const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
      const extension = dotIndex > 0 ? safeName.slice(dotIndex) : '.png';
      let targetName = `${baseName}${extension}`;
      let targetPath = `${imageFolderPath}/${targetName}`;
      let copyNumber = 2;
      while (await client.exists(targetPath)) {
        targetName = `${baseName} (${copyNumber})${extension}`;
        targetPath = `${imageFolderPath}/${targetName}`;
        copyNumber += 1;
      }
      await client.putFileContents(targetPath, body, {
        headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' },
      });
      showToast(`IMAGE 폴더에 저장했습니다: ${targetPath}`);
      await loadFullTree();
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) setError(`IMAGE 폴더 저장 실패: ${err.message}`);
    } finally {
      setIsWebDavSaving(false);
      setEditorLoading(false);
    }
  };

  const getDmergeArchive = async (archiveRemotePath) => {
    const normalizedPath = normalizeRemotePath(archiveRemotePath);
    const cached = dmergeCacheRef.current.get(normalizedPath);
    if (cached) return cached;
    const client = clientRef.current;
    if (!client) throw new Error('WebDAV 연결이 없습니다.');
    const data = await client.getFileContents(normalizedPath);
    const archive = await readDmergeArchive(data, normalizedPath);
    dmergeCacheRef.current.set(normalizedPath, archive);
    return archive;
  };

  const handleOpenDmerge = async (file) => {
    const archivePath = normalizeRemotePath(file.remotePath);
    setLoading(true);
    setError('');
    try {
      const archive = await getDmergeArchive(archivePath);
      setDirectoryContentsForArchive(archivePath, archive.documents);
      return true;
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) setError(`DMerge 열기 실패: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (event) => {
    event.preventDefault();
    connectWithCredentials({ rememberLogin: saveLoginInfo });
  };

  const handleOpenDmergeEntry = async (file) => {
    setEditorLoading(true);
    setError('');
    try {
      const archive = await getDmergeArchive(file.archiveRemotePath);
      const entry = archive.zip.file(file.archivePath);
      if (!entry) throw new Error('묶음 안에서 DOCX 파일을 찾지 못했습니다.');
      const arrayBuffer = await entry.async('arraybuffer');
      clearMediaPreview();
      setSelectedFile({ ...file, viewMode: 'docx' });
      setEditorContent('');
      setSavedContent('');
      setEditorBinary(arrayBuffer);
      closeMobileWdocExplorer();
    } catch (err) {
      setError(`묶음 문서 열기 실패: ${err.message}`);
    } finally {
      setEditorLoading(false);
    }
  };

  const toggleExplorer = useCallback(() => {
    setIsExplorerOpen((open) => {
      localStorage.setItem('webdav-explorer-open', String(!open));
      return !open;
    });
  }, []);

  const toggleMobileWdoc = () => {
    if (!isExplorerOpen && isExplorerCompact) {
      setIsExplorerCompact(false);
      localStorage.setItem(EXPLORER_COMPACT_KEY, 'false');
    }
    toggleExplorer();
  };

  const openExplorer = () => {
    nextWebDavFmaImportRef.current = 'image';
    setIsSelectingFmaFolder(false);
    setIsExplorerOpen(true);
    setIsExplorerCompact(false);
    localStorage.setItem('webdav-explorer-open', 'true');
    localStorage.setItem(EXPLORER_COMPACT_KEY, 'false');
    showToast('WebDAV에서 추가할 이미지를 선택하세요.');
  };

  const openFolderExplorer = () => {
    nextWebDavFmaImportRef.current = 'folder';
    setIsSelectingFmaFolder(true);
    setIsExplorerOpen(true);
    setIsExplorerCompact(false);
    localStorage.setItem('webdav-explorer-open', 'true');
    localStorage.setItem(EXPLORER_COMPACT_KEY, 'false');
    showToast('FMA에 추가할 WebDAV 폴더를 선택하세요.');
  };

  const handleCloseEditor = () => {
    if (!confirmEditorClose()) return;
    clearMediaPreview();
    setSelectedFile(null);
    setEditorContent('');
    setSavedContent('');
    setEditorBinary(null);
    setFmaImportBatch(null);
    nextWebDavFmaImportRef.current = '';
    setIsSelectingFmaFolder(false);
  };

  const handleResizeStart = (event) => {
    if (!splitContainerRef.current) return;

    const container = splitContainerRef.current;
    const updateWidth = (clientX) => {
      const rect = container.getBoundingClientRect();
      const nextWidth = ((clientX - rect.left) / rect.width) * 100;
      const minWidth = (MIN_EXPLORER_WIDTH_PX / rect.width) * 100;
      setExplorerWidth(Math.min(MAX_EXPLORER_WIDTH, Math.max(minWidth, nextWidth)));
    };
    const handlePointerMove = (moveEvent) => updateWidth(moveEvent.clientX);
    const handlePointerUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-split-resizing');
      setExplorerWidth((width) => {
        const storageKey = window.matchMedia('(max-width: 767px)').matches ? MOBILE_EXPLORER_WIDTH_KEY : EXPLORER_WIDTH_KEY;
        localStorage.setItem(storageKey, String(width));
        return width;
      });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    event.preventDefault();
    updateWidth(event.clientX);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-split-resizing');
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
  const handleDelete = async (fileOrName) => {
    const fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name;
    const remotePath = normalizeRemotePath(
      typeof fileOrName === 'string'
        ? joinRemotePath(currentPath, fileOrName)
        : fileOrName?.remotePath || joinRemotePath(currentPath, fileName),
    );
    if (!fileName || remotePath === '/') {
      setError('삭제할 파일 경로를 확인할 수 없습니다.');
      return;
    }
    if (!window.confirm(`'${fileName}'을(를) 정말 삭제하시겠습니까?`)) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      await client.deleteFile(remotePath);
      if (selectedFile?.remotePath && normalizeRemotePath(selectedFile.remotePath) === remotePath) {
        setSelectedFile(null);
        setEditorContent('');
        setSavedContent('');
        setEditorBinary(null);
        clearMediaPreview();
      }
      await loadFullTree();
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`삭제 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일 이름 변경 (모달 열기)
  const handleOpenRenameModal = (item) => {
    const target = typeof item === 'string'
      ? { name: item, remotePath: joinRemotePath(currentPath, item) }
      : item;
    if (!target?.name || !target?.remotePath) {
      setError('이름을 변경할 항목의 경로를 확인할 수 없습니다.');
      return;
    }
    setRenameTarget(target);
    setIsRenameModalOpen(true);
  };

  // 파일 이름 변경 (모달 확인)
  const handleConfirmRename = async (newName) => {
    const oldName = renameTarget?.name || '';
    if (!newName || newName === oldName) {
      setIsRenameModalOpen(false);
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      const oldPath = normalizeRemotePath(renameTarget.remotePath);
      const parentPath = oldPath.split('/').slice(0, -1).join('/') || '/';
      const newPath = joinRemotePath(parentPath, newName);
      await moveRemoteItem(client, oldPath, newPath, Boolean(renameTarget.isDirectory));
      if (selectedFile?.remotePath && normalizeRemotePath(selectedFile.remotePath) === oldPath) {
        setSelectedFile((file) => ({ ...file, name: newName, remotePath: newPath }));
      }
      await loadFullTree();
      showToast(`'${oldName}'이(가) '${newName}'으로 변경되었습니다.`);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`이름 변경 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setIsRenameModalOpen(false);
      setRenameTarget(null);
    }
  };

  // 파일 이름 변경 (모달 취소)
  const handleCancelRename = () => {
    setIsRenameModalOpen(false);
    setRenameTarget(null);
  };

  // 새 파일 만들기
  const handleCreateFile = async (targetDirectory = currentPath) => {
    const client = clientRef.current;
    if (!client) return;
    const creationDirectory = typeof targetDirectory === 'string' ? targetDirectory : currentPath;

    const enteredName = window.prompt('새 Markdown 파일 이름을 입력하세요:', '새 문서.md');
    if (!enteredName) return;
    const trimmedName = enteredName.trim();
    if (!trimmedName || /[\\/]/.test(trimmedName)) {
      setError('파일 이름에는 / 또는 \\ 문자를 사용할 수 없습니다.');
      return;
    }
    const fileName = /\.md$/i.test(trimmedName) ? trimmedName : `${trimmedName}.md`;
    const normalizedTargetDirectory = normalizeRemotePath(creationDirectory);
    const targetEntries = findDirectoryNode(directoryTree, normalizedTargetDirectory)?.entries || [];
    if (targetEntries.some((file) => file.name.toLocaleLowerCase() === fileName.toLocaleLowerCase())) {
      setError(`'${fileName}' 파일이 이미 있습니다.`);
      return;
    }

    const filePath = joinRemotePath(normalizedTargetDirectory, fileName);
    setLoading(true);
    setError('');
    try {
      await client.putFileContents(filePath, '', {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
      await loadDirectory(normalizedTargetDirectory);
      showToast(`Markdown 파일을 만들었습니다: ${filePath}`);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`생성 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일/폴더를 다른 WebDAV 폴더로 이동
  const handleMove = async (item, requestedTargetDirectory, options = {}) => {
    const sourcePath = normalizeRemotePath(item?.remotePath);
    if (!item?.name || sourcePath === '/') {
      setError('이동할 항목의 경로를 확인할 수 없습니다.');
      return false;
    }

    const sourceParts = sourcePath.split('/').filter(Boolean);
    sourceParts.pop();
    const sourceDirectory = sourceParts.length ? `/${sourceParts.join('/')}` : '/';
    const targetDirectory = normalizeRemotePath(requestedTargetDirectory);
    const targetNode = findDirectoryNode(directoryTree, targetDirectory);
    if (!targetNode?.isDirectory) {
      setError(`대상 폴더를 찾을 수 없습니다: ${targetDirectory}`);
      return false;
    }
    if (targetDirectory === sourceDirectory) {
      setError('현재 폴더와 다른 대상 폴더를 선택하세요.');
      return false;
    }
    if (item.isDirectory && (targetDirectory === sourcePath || targetDirectory.startsWith(`${sourcePath}/`))) {
      setError('폴더를 자기 자신 또는 하위 폴더로 이동할 수 없습니다.');
      return false;
    }
    const usedNames = new Set((targetNode.entries || []).map((entry) => entry.name.toLocaleLowerCase()));
    const hasDuplicate = usedNames.has(item.name.toLocaleLowerCase());
    let targetName = item.name;
    if (hasDuplicate) {
      if (options.conflictPolicy === 'rename') targetName = nextAvailableName(item.name, usedNames);
      else if (options.conflictPolicy !== 'overwrite' || item.isDirectory) {
        setError(item.isDirectory ? '같은 이름의 폴더는 덮어쓸 수 없습니다. 이름 바꾸기를 선택하세요.' : `대상 폴더에 '${item.name}' 항목이 이미 있습니다.`);
        return false;
      }
    }

    const targetPath = joinRemotePath(targetDirectory, targetName);
    const client = createConfiguredWebDavClient();
    setLoading(true);
    setError('');
    try {
      setMoveProgress({ percent: 0, completed: 0, total: 1, phase: item.isDirectory ? '1단계 · 대상 폴더 구조 생성' : '2단계 · 파일을 하나씩 이동', path: sourcePath });
      await moveRemoteItem(client, sourcePath, targetPath, item.isDirectory, hasDuplicate && options.conflictPolicy === 'overwrite', {
        copyDeleteOnly: true,
        onProgress: ({ completed, total, phase, path }) => setMoveProgress({
          percent: Math.round((completed / Math.max(total, 1)) * 100), completed, total, phase, path,
        }),
      });
      if (!await client.exists(targetPath)) throw new Error('서버에서 이동 결과를 확인할 수 없습니다.');
      if (selectedFile?.remotePath) {
        const openPath = normalizeRemotePath(selectedFile.remotePath);
        if (openPath === sourcePath || (item.isDirectory && openPath.startsWith(`${sourcePath}/`))) {
          const movedOpenPath = `${targetPath}${openPath.slice(sourcePath.length)}`;
          const nextSelectedFile = { ...selectedFile, remotePath: movedOpenPath };
          setSelectedFile(nextSelectedFile);
          selectedFileRef.current = nextSelectedFile;
        }
      }
      await loadFullTree();
      const normalizedCurrentPath = normalizeRemotePath(currentPath);
      if (normalizedCurrentPath === sourcePath || (item.isDirectory && normalizedCurrentPath.startsWith(`${sourcePath}/`))) {
        const movedCurrentPath = `${targetPath}${normalizedCurrentPath.slice(sourcePath.length)}`;
        updateHistoryPath(movedCurrentPath, true);
        await loadDirectory(movedCurrentPath);
      }
      showToast(`이동했습니다: ${sourcePath} → ${targetPath}`);
      return true;
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) setError(`이동 실패: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleMoveSelected = async (items, requestedTargetDirectory, options = {}) => {
    const moveItems = (Array.isArray(items) ? items : []).filter((item) => item?.name && item?.remotePath);
    if (!moveItems.length) return false;
    const targetDirectory = normalizeRemotePath(requestedTargetDirectory);
    const targetNode = findDirectoryNode(directoryTree, targetDirectory);
    if (!targetNode?.isDirectory) {
      setError(`대상 폴더를 찾을 수 없습니다: ${targetDirectory}`);
      return false;
    }

    const existingTargetNames = new Set((targetNode.entries || []).map((entry) => entry.name.toLocaleLowerCase()));
    const targetNames = new Set(existingTargetNames);
    const plannedOriginalNames = new Set();
    const plannedItems = [];
    for (const item of moveItems) {
      const sourcePath = normalizeRemotePath(item.remotePath);
      const parts = sourcePath.split('/').filter(Boolean);
      parts.pop();
      const sourceDirectory = parts.length ? `/${parts.join('/')}` : '/';
      if (sourceDirectory === targetDirectory) {
        setError(`'${item.name}'은(는) 이미 대상 폴더에 있습니다.`);
        return false;
      }
      if (item.isDirectory && (targetDirectory === sourcePath || targetDirectory.startsWith(`${sourcePath}/`))) {
        setError(`'${item.name}' 폴더를 자기 자신 또는 하위 폴더로 이동할 수 없습니다.`);
        return false;
      }
      const normalizedName = item.name.toLocaleLowerCase();
      const duplicateExisting = existingTargetNames.has(normalizedName);
      const duplicateSelected = plannedOriginalNames.has(normalizedName);
      const duplicate = duplicateExisting || duplicateSelected;
      let targetName = item.name;
      if (duplicate) {
        if (options.conflictPolicy === 'rename') {
          targetName = nextAvailableName(item.name, targetNames);
        } else if (duplicateSelected || options.conflictPolicy !== 'overwrite' || item.isDirectory) {
          setError(item.isDirectory ? `같은 이름의 '${item.name}' 폴더는 덮어쓸 수 없습니다.` : `대상 폴더에 '${item.name}' 항목이 이미 있습니다.`);
          return false;
        }
      }
      const targetNameKey = targetName.toLocaleLowerCase();
      targetNames.add(targetNameKey);
      plannedOriginalNames.add(normalizedName);
      plannedItems.push({ item, sourcePath, targetName, overwrite: duplicateExisting && options.conflictPolicy === 'overwrite' });
    }

    const client = createConfiguredWebDavClient();
    setLoading(true);
    setError('');
    setMoveProgress({ percent: 0, completed: 0, total: plannedItems.length, phase: '1단계 · 대상 폴더 구조 생성', path: '' });
    const movedPairs = [];
    try {
      const moveResults = [];
      for (let itemIndex = 0; itemIndex < plannedItems.length; itemIndex += 1) {
        const { item, sourcePath, targetName, overwrite } = plannedItems[itemIndex];
        const targetPath = joinRemotePath(targetDirectory, targetName);
        try {
          await moveRemoteItem(client, sourcePath, targetPath, item.isDirectory, overwrite, {
            copyDeleteOnly: true,
            onProgress: ({ completed, total, phase, path }) => setMoveProgress({
              percent: Math.round(((itemIndex + completed / Math.max(total, 1)) / plannedItems.length) * 100),
              completed: itemIndex, total: plannedItems.length, phase, path,
            }),
          });
          if (!await client.exists(targetPath)) throw new Error(`'${targetName}' 이동 결과를 서버에서 확인할 수 없습니다.`);
          moveResults.push({ status: 'fulfilled', value: { sourcePath, targetPath, isDirectory: item.isDirectory, name: targetName } });
        } catch (reason) {
          moveResults.push({ status: 'rejected', reason });
        }
      }
      moveResults.forEach((result) => {
        if (result.status === 'fulfilled') movedPairs.push(result.value);
      });
      const failedResults = moveResults.filter((result) => result.status === 'rejected');
      if (failedResults.length) {
        const firstError = failedResults[0].reason;
        throw new Error(`${failedResults.length}개 이동 실패: ${firstError?.message || firstError}`);
      }
      if (selectedFile?.remotePath) {
        const openPath = normalizeRemotePath(selectedFile.remotePath);
        const pair = movedPairs.find(({ sourcePath, isDirectory }) => openPath === sourcePath || (isDirectory && openPath.startsWith(`${sourcePath}/`)));
        if (pair) {
          const nextSelectedFile = { ...selectedFile, remotePath: `${pair.targetPath}${openPath.slice(pair.sourcePath.length)}` };
          setSelectedFile(nextSelectedFile);
          selectedFileRef.current = nextSelectedFile;
        }
      }
      await loadFullTree();
      const normalizedCurrentPath = normalizeRemotePath(currentPath);
      const currentPair = movedPairs.find(({ sourcePath, isDirectory }) =>
        isDirectory && (normalizedCurrentPath === sourcePath || normalizedCurrentPath.startsWith(`${sourcePath}/`)));
      if (currentPair) {
        const movedCurrentPath = `${currentPair.targetPath}${normalizedCurrentPath.slice(currentPair.sourcePath.length)}`;
        updateHistoryPath(movedCurrentPath, true);
        await loadDirectory(movedCurrentPath);
      }
      showToast(`${movedPairs.length}개 항목을 이동했습니다: ${targetDirectory}`);
      return true;
    } catch (err) {
      await loadFullTree();
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`선택이동 실패 (${movedPairs.length}/${moveItems.length}개 완료): ${err.message}`);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 새 폴더 만들기
  const handleCreateFolder = async (targetDirectory = currentPath) => {
    const client = clientRef.current;
    if (!client) return;
    const creationDirectory = typeof targetDirectory === 'string' ? targetDirectory : currentPath;

    const enteredName = window.prompt('새 폴더 이름을 입력하세요:', '새 폴더');
    if (!enteredName) return;
    const folderName = enteredName.trim();
    if (!folderName || /[\\/]/.test(folderName)) {
      setError('폴더 이름에는 / 또는 \\ 문자를 사용할 수 없습니다.');
      return;
    }
    const normalizedTargetDirectory = normalizeRemotePath(creationDirectory);
    const targetEntries = findDirectoryNode(directoryTree, normalizedTargetDirectory)?.entries || [];
    if (targetEntries.some((file) => file.name.toLocaleLowerCase() === folderName.toLocaleLowerCase())) {
      setError(`'${folderName}' 항목이 이미 있습니다.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const folderPath = joinRemotePath(normalizedTargetDirectory, folderName);
      await client.createDirectory(folderPath);
      await loadDirectory(normalizedTargetDirectory);
      showToast(`폴더를 만들었습니다: ${folderPath}`);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`폴더 생성 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmCreateDestination = (targetDirectory) => {
    const type = createDestinationType;
    setCreateDestinationType('');
    if (type === 'folder') handleCreateFolder(targetDirectory);
    else if (type === 'file') handleCreateFile(targetDirectory);
  };

  useEffect(() => {
    let savedLogin = null;
    try {
      savedLogin = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
    } catch {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }

    const activeSession = readLoginSession(sessionStorage);
    if (activeSession) {
      setUrl(activeSession.url);
      setUsername(activeSession.username);
      setPassword(activeSession.password);
      setSaveLoginInfo(Boolean(savedLogin?.url || savedLogin?.username));
      connectWithCredentials({
        nextUrl: activeSession.url,
        nextUsername: activeSession.username,
        nextPassword: activeSession.password,
      });
      return;
    }

    if (savedLogin?.url || savedLogin?.username) {
      setUrl(savedLogin.url || '');
      setUsername(savedLogin.username || '');
      setSaveLoginInfo(true);
    }
    // 저장된 세션의 자동 접속은 앱이 처음 열릴 때 한 번만 수행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const handlePopState = (event) => {
      loadDirectory(event.state?.webdavPath || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isConnected, loadDirectory]);

  useEffect(() => {
    if (!isConnected || !clientRef.current) return;
    const activeDirectory = findDirectoryNode(directoryTree, currentPath);
    if (activeDirectory?.loaded) return;
    loadDirectory(currentPath);
  }, [currentPath, directoryTree, isConnected, loadDirectory]);

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
    if (!isExplorerOpen) return;

    const closeMobileExplorerFromBackdrop = (event) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('#webdav-explorer-panel, .mobile-wdoc-button, .split-resizer')) return;
      setIsExplorerOpen(false);
      localStorage.setItem('webdav-explorer-open', 'false');
    };

    document.addEventListener('pointerdown', closeMobileExplorerFromBackdrop, true);
    return () => document.removeEventListener('pointerdown', closeMobileExplorerFromBackdrop, true);
  }, [isExplorerOpen]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
    if (selectedFile?.viewMode === 'text') lastTextFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  useEffect(() => {
    mediaPreviewUrlRef.current = mediaPreviewUrl;
  }, [mediaPreviewUrl]);

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

  const openDirectory = async (file) => {
    const folderPath = normalizeRemotePath(file.remotePath);
    if (nextWebDavFmaImportRef.current === 'folder') {
      const client = clientRef.current;
      if (!client) return false;
      nextWebDavFmaImportRef.current = '';
      setIsSelectingFmaFolder(false);
      setEditorLoading(true);
      setError('');
      try {
        const entries = await client.getDirectoryContents(folderPath, { deep: true });
        const imageEntries = entries.filter((entry) => entry.type !== 'directory' && isFmaImageFile(entry.basename));
        if (!imageEntries.length) throw new Error('선택한 폴더에 지원되는 이미지가 없습니다.');
        const imported = [];
        for (const entry of imageEntries) {
          imported.push({
            name: entry.basename,
            binaryContent: await client.getFileContents(normalizeRemotePath(entry.filename)),
            lastModified: entry.lastmod ? new Date(entry.lastmod).getTime() : Date.now(),
          });
        }
        setFmaImportBatch({ id: Date.now(), entries: imported });
        showToast(`${imported.length}개 이미지를 FMA에 추가했습니다.`);
        return true;
      } catch (err) {
        if (!returnToLoginIfUnauthorized(err)) setError(`WebDAV 폴더 추가 실패: ${err.message}`);
        return false;
      } finally {
        setEditorLoading(false);
      }
    }
    return navigateToDirectory(folderPath);
  };

  const handleResizeKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    setExplorerWidth((width) => {
      const containerWidth = splitContainerRef.current?.getBoundingClientRect().width || 1;
      const minWidth = (MIN_EXPLORER_WIDTH_PX / containerWidth) * 100;
      const keyboardStep = (20 / containerWidth) * 100;
      const nextWidth = event.key === 'Home'
        ? DEFAULT_EXPLORER_WIDTH
        : Math.min(MAX_EXPLORER_WIDTH, Math.max(minWidth, width + (event.key === 'ArrowRight' ? keyboardStep : -keyboardStep)));
      const storageKey = window.matchMedia('(max-width: 767px)').matches ? MOBILE_EXPLORER_WIDTH_KEY : EXPLORER_WIDTH_KEY;
      localStorage.setItem(storageKey, String(nextWidth));
      return nextWidth;
    });
  };

  const resetExplorerWidth = () => {
    const defaultWidth = window.matchMedia('(max-width: 767px)').matches
      ? MOBILE_DEFAULT_EXPLORER_WIDTH
      : DEFAULT_EXPLORER_WIDTH;
    setExplorerWidth(defaultWidth);
    const storageKey = window.matchMedia('(max-width: 767px)').matches ? MOBILE_EXPLORER_WIDTH_KEY : EXPLORER_WIDTH_KEY;
    localStorage.setItem(storageKey, String(defaultWidth));
  };

  const toggleExplorerCompact = () => {
    setIsExplorerCompact((compact) => {
      localStorage.setItem(EXPLORER_COMPACT_KEY, String(!compact));
      return !compact;
    });
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
    <div className={`webdav-shell ${isDarkTheme ? 'dark bg-[#111827]' : 'bg-[#eef2f7]'} min-h-screen overflow-hidden p-4 text-slate-800 transition-colors dark:text-slate-100 sm:p-6`}>
      <div className="mx-auto max-w-[min(1800px,98vw)]">
        <MobileWdocButton open={isExplorerOpen} onToggle={toggleMobileWdoc} onPositionChange={setMobileWdocRect} />
        <TopNav
          currentPath={currentPath}
          publicUrl={buildPublicUrl(url, currentPath)}
          loading={loading}
          error={error}
          copiedKey={copiedKey}
          fileInputRef={fileInputRef}
          onGoBack={goUp}
          onUpload={handleUpload}
          onNewFile={() => setCreateDestinationType('file')}
          onNewFolder={() => setCreateDestinationType('folder')}
          onRefresh={loadFullTree}
          explorerOpen={isExplorerOpen}
          mobileWdocRect={mobileWdocRect}
          onToggleExplorer={toggleExplorer}

          onCopyFolderUrl={() => handleCopyUrl(currentPath, 'folder')}
          onDisconnect={() => {
            clearLoginSession(sessionStorage);
            clientRef.current = null;
            dmergeCacheRef.current.clear();
            setIsConnected(false);
            resetDirectoryState();
            setSelectedFile(null);
            setEditorContent('');
            setSavedContent('');
            setEditorBinary(null);
            clearMediaPreview();
          }}
        />

        <div
          ref={splitContainerRef}
          className="webdav-app-layout flex max-h-[calc(100vh-2rem)] min-h-[calc(100vh-2rem)] flex-col gap-1 overflow-hidden lg:flex-row"
          style={{ '--mobile-explorer-width': `${explorerWidth}%` }}
        >
          {isExplorerOpen && <div id="webdav-explorer-panel" className="webdav-explorer-panel" style={{ flexBasis: `${explorerWidth}%` }}><FileExplorer
            files={files}
            directoryTree={directoryTree}
            loading={loading}
            moveProgress={moveProgress}
            editorLoading={editorLoading}
            copiedKey={copiedKey}
            isDragging={isDragging}
            editorOpen
            explorerWidth={explorerWidth}
            compact={isExplorerCompact}
            folderSelectionMode={isSelectingFmaFolder}
            formatBytes={formatBytes}
            formatDate={formatDate}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onOpenDirectory={openDirectory}
            onOpenArchive={handleOpenDmerge}
            onCopyUrl={handleCopyUrl}
            onOpenFile={handleOpenFile}
            onDownload={handleDownload}
            onRename={handleOpenRenameModal}
            onMove={handleMove}
            onMoveSelected={handleMoveSelected}
            onDelete={handleDelete}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRequestCreateFile={() => setCreateDestinationType('file')}
            onRequestCreateFolder={() => setCreateDestinationType('folder')}
            onToggleCompact={toggleExplorerCompact}
          /></div>}

          {isExplorerOpen && !isExplorerCompact && <div
            className="split-resizer shrink-0"
            onPointerDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
            onDoubleClick={resetExplorerWidth}
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={MAX_EXPLORER_WIDTH}
            aria-valuenow={Math.round(explorerWidth)}
            aria-valuetext={`WebDAV 목록 너비 ${Math.round(explorerWidth)}%, 최소 ${MIN_EXPLORER_WIDTH_PX}px`}
            tabIndex={0}
            aria-label="탐색기와 MDPRO 너비 조절"
            title="드래그 또는 방향키로 MDPRO 너비 조절 · 더블클릭으로 초기화"
          ><div className="split-resizer-grip" /></div>}
          <MdproEditor
            selectedFile={selectedFile}
            content={editorContent}
            binaryContent={editorBinary}
            fmaImportBatch={fmaImportBatch}
            loading={editorLoading}
            saving={isWebDavSaving}
            explorerWidth={isExplorerOpen && !isExplorerCompact ? explorerWidth : 0}
            onSave={handleSaveFile}
            onSaveAs={handleSaveFileAs}
            onDocumentChange={handleEditorDocumentChange}
            onSaveImageToFolder={handleSaveImageToFolder}
            onClose={handleCloseEditor}
            onToggleExplorer={toggleExplorer}
            onOpenExplorer={openExplorer}
            onOpenFolderExplorer={openFolderExplorer}
            onThemeChange={setIsDarkTheme}
          />
        </div>
      </div>

      <RenameModal
        isOpen={isRenameModalOpen}
        currentName={renameTarget?.name || ''}
        onConfirm={handleConfirmRename}
        onCancel={handleCancelRename}
        loading={loading}
      />

      <CreateDestinationModal
        key={createDestinationType || 'closed'}
        type={createDestinationType}
        directoryTree={directoryTree}
        loading={loading}
        onConfirm={confirmCreateDestination}
        onCancel={() => setCreateDestinationType('')}
      />

      {toastMessage && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl dark:border dark:border-slate-600">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

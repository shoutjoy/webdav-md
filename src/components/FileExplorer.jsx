import { useEffect, useRef, useState } from 'react';
import { Archive, Check, ChevronDown, ChevronRight, Copy, Download, Edit, Eye, EyeOff, FileInput, FilePlus2, FileText, Folder, FolderInput, FolderOpen, FolderPlus, MousePointer2, PanelLeftClose, PanelLeftOpen, Settings, Share2, Trash2, Upload, X } from 'lucide-react';
import MoveDestinationModal from './MoveDestinationModal.jsx';

const FILE_TOOLS_VISIBLE_KEY = 'webdav-file-tools-visible';
const FILE_TOOLS_MODE_KEY = 'webdav-file-tools-mode';
const FILE_TOOLS_MODES = ['hover', 'always', 'hidden'];
const FILE_TOOLS_MODE_LABELS = {
  hover: '마우스를 올릴 때 표시',
  always: '항상 표시',
  hidden: '숨김',
};

function getInitialFileToolsMode() {
  try {
    const savedMode = localStorage.getItem(FILE_TOOLS_MODE_KEY);
    if (FILE_TOOLS_MODES.includes(savedMode)) return savedMode;
    return localStorage.getItem(FILE_TOOLS_VISIBLE_KEY) === 'false' ? 'hidden' : 'hover';
  } catch {
    return 'hover';
  }
}

function collectDirectoryPaths(entries, paths = new Set()) {
  for (const entry of entries || []) {
    if (!entry.isDirectory) continue;
    paths.add(entry.remotePath);
    collectDirectoryPaths(entry.entries, paths);
  }
  return paths;
}

function TreeItem({ item, depth, expandedPaths, selectedFolderPath, selectionMode, checkedPaths, fileToolsMode, loading, editorLoading, copiedKey, formatBytes, onToggleFolder, onToggleExpanded, onToggleChecked, onCopyUrl, onShareFile, onOpenFile, onDownload, onRename, onMove, onDelete, onCreateFile, onCreateFolder }) {
  const expandable = item.isDirectory || item.isArchive;
  const expanded = expandable && expandedPaths.has(item.remotePath);
  const children = (item.entries || []).filter((child) => child.name !== '..');
  const itemKey = `tree-${item.remotePath}`;
  return <>
    <div className={`group flex min-h-9 items-center border-b border-slate-100 pr-2 text-sm transition dark:border-slate-800 ${item.isDirectory && selectedFolderPath === item.remotePath ? 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'}`} style={{ paddingLeft: `${8 + depth * 18}px` }} role="treeitem" aria-expanded={expandable ? expanded : undefined} aria-selected={item.isDirectory ? selectedFolderPath === item.remotePath : undefined}>
      {expandable ? <button type="button" onClick={() => selectionMode ? onToggleExpanded(item) : onToggleFolder(item)} className="grid h-8 w-5 shrink-0 place-items-center text-slate-400" aria-label={expanded ? `${item.name} 접기` : `${item.name} 펼치기`}>
        {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
      </button> : <span className="w-5 shrink-0"/>}
      {selectionMode && !item.isArchiveEntry && <input
        type="checkbox"
        checked={checkedPaths.has(item.remotePath)}
        onChange={() => onToggleChecked(item)}
        onClick={(event) => event.stopPropagation()}
        className="mr-1.5 h-3.5 w-3.5 shrink-0 accent-indigo-600"
        aria-label={`${item.name} 선택`}
      />}
      <button type="button" onClick={() => selectionMode && !item.isArchiveEntry ? onToggleChecked(item) : (expandable ? onToggleFolder(item) : onOpenFile(item))} className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left" aria-label={selectionMode && !item.isArchiveEntry ? `${item.name} 이동 항목 선택` : item.remotePath}>
        {item.isDirectory ? (expanded ? <FolderOpen size={16} className="shrink-0 text-amber-400"/> : <Folder size={16} className="shrink-0 text-amber-400"/>) : item.isArchive ? <Archive size={16} className="shrink-0 text-indigo-500"/> : <FileText size={15} className="shrink-0 text-blue-500 dark:text-blue-400"/>}
        <span className="min-w-0 truncate">{item.name}</span>
        {expandable && item.loaded && <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">{children.length}</span>}
        {!item.isDirectory && !item.isArchiveEntry && <span className="ml-auto shrink-0 pl-2 text-[10px] text-slate-400">{formatBytes(item.size)}</span>}
        {item.isArchiveEntry && !item.included && <span className="ml-auto shrink-0 pl-2 text-[10px] text-slate-400">제외됨</span>}
      </button>
      {item.isDirectory && !selectionMode && <div className="ml-1 hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
        <button type="button" onClick={(event) => { event.stopPropagation(); onCreateFile(item.remotePath); }} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title={`${item.name}에 파일 생성`} aria-label={`${item.name} 폴더에 파일 생성`}><FilePlus2 size={14}/></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onCreateFolder(item.remotePath); }} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title={`${item.name}에 폴더 생성`} aria-label={`${item.name} 폴더에 폴더 생성`}><FolderPlus size={14}/></button>
      </div>}
      {fileToolsMode !== 'hidden' && <div className={`ml-1 shrink-0 items-center gap-0.5 ${fileToolsMode === 'always' ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'}`}>
        {!item.isArchiveEntry && (item.isDirectory ? <button type="button" onClick={() => onCopyUrl(item.remotePath, itemKey)} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="폴더 원본 URL 복사">{copiedKey === itemKey ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button> : <button type="button" onClick={() => onShareFile(item)} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="pwShare / openShare 링크 만들기"><Share2 size={14}/></button>)}
        {!item.isDirectory && !item.isArchive && <button type="button" onClick={() => onOpenFile(item)} disabled={editorLoading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 dark:hover:bg-slate-700" title="열기 (이미지는 FMA)"><Eye size={14}/></button>}
        {!item.isDirectory && !item.isArchiveEntry && <button type="button" onClick={() => onDownload(item.name)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="다운로드"><Download size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={() => onRename(item)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="이름 변경"><Edit size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={() => onMove(item)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="다른 폴더로 이동" aria-label={`${item.name} 다른 폴더로 이동`}><FileInput size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(item); }} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="삭제"><Trash2 size={14}/></button>}
      </div>}
    </div>
    {expanded && children.map((child) => <TreeItem key={child.remotePath} item={child} depth={depth + 1} expandedPaths={expandedPaths} selectedFolderPath={selectedFolderPath} selectionMode={selectionMode} checkedPaths={checkedPaths} fileToolsMode={fileToolsMode} loading={loading} editorLoading={editorLoading} copiedKey={copiedKey} formatBytes={formatBytes} onToggleFolder={onToggleFolder} onToggleExpanded={onToggleExpanded} onToggleChecked={onToggleChecked} onCopyUrl={onCopyUrl} onShareFile={onShareFile} onOpenFile={onOpenFile} onDownload={onDownload} onRename={onRename} onMove={onMove} onDelete={onDelete} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder}/>)}
  </>;
}

export default function FileExplorer({ files, directoryTree, loading, moveProgress, editorLoading, copiedKey, isDragging, explorerWidth, compact, folderSelectionMode, formatBytes, onDragEnter, onDragLeave, onDragOver, onDrop, onOpenDirectory, onOpenArchive, onCopyUrl, onShareFile, onOpenFile, onDownload, onRename, onMove, onMoveSelected, onDelete, onCreateFile, onCreateFolder, onRequestCreateFile, onRequestCreateFolder, onToggleCompact, showHiddenItems, onShowHiddenItemsChange, defaultSharePassword, onDefaultSharePasswordChange }) {
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['/']));
  const [selectedFolderPath, setSelectedFolderPath] = useState('/');
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState(() => new Map());
  const [moveRequest, setMoveRequest] = useState(null);
  const [moveActionError, setMoveActionError] = useState('');
  const [fileToolsMode, setFileToolsMode] = useState(getInitialFileToolsMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsWindowRef = useRef(null);
  const [settingsPosition, setSettingsPosition] = useState(null);
  const fileToolsNextMode = FILE_TOOLS_MODES[(FILE_TOOLS_MODES.indexOf(fileToolsMode) + 1) % FILE_TOOLS_MODES.length];
  const checkedPaths = new Set(checkedItems.keys());
  const rootEntries = (directoryTree?.entries?.length ? directoryTree.entries : files).filter((item) => item.name !== '..');
  const directoryPaths = collectDirectoryPaths(rootEntries);
  const allFoldersExpanded = directoryPaths.size > 0 && [...directoryPaths].every((path) => expandedPaths.has(path));
  const toggleAllFolders = () => {
    setExpandedPaths(allFoldersExpanded ? new Set(['/']) : new Set(['/', ...directoryPaths]));
  };
  const toggleFolder = async (item) => {
    if (item.isDirectory) {
      setSelectedFolderPath(item.remotePath);
      const opened = await onOpenDirectory(item);
      if (!opened) return;
    }
    if (folderSelectionMode && item.isDirectory) {
      return;
    }
    const willExpand = !expandedPaths.has(item.remotePath);
    setExpandedPaths((paths) => {
      const next = new Set(paths);
      if (willExpand) next.add(item.remotePath); else next.delete(item.remotePath);
      return next;
    });
    if (willExpand && !item.loaded && item.isArchive) {
      const opened = await onOpenArchive(item);
      if (!opened) {
        setExpandedPaths((paths) => {
          const next = new Set(paths);
          next.delete(item.remotePath);
          return next;
        });
      }
    }
  };
  const toggleChecked = (item) => {
    setCheckedItems((items) => {
      const next = new Map(items);
      if (next.has(item.remotePath)) {
        next.delete(item.remotePath);
      } else {
        for (const path of next.keys()) {
          if (path.startsWith(`${item.remotePath}/`) || item.remotePath.startsWith(`${path}/`)) next.delete(path);
        }
        next.set(item.remotePath, item);
      }
      return next;
    });
  };
  const toggleExpandedOnly = async (item) => {
    const willExpand = !expandedPaths.has(item.remotePath);
    setExpandedPaths((paths) => {
      const next = new Set(paths);
      if (willExpand) next.add(item.remotePath); else next.delete(item.remotePath);
      return next;
    });
    if (willExpand && item.isArchive && !item.loaded) await onOpenArchive(item);
  };
  const moveCheckedItems = async () => {
    if (!selectionMode) {
      setSelectionMode(true);
      return;
    }
    if (!checkedItems.size) {
      setSelectionMode(false);
      return;
    }
    setMoveActionError('');
    setMoveRequest({ items: [...checkedItems.values()], bulk: true });
  };
  const toggleFileTools = () => {
    setFileToolsMode((mode) => {
      const next = FILE_TOOLS_MODES[(FILE_TOOLS_MODES.indexOf(mode) + 1) % FILE_TOOLS_MODES.length];
      try {
        localStorage.setItem(FILE_TOOLS_MODE_KEY, next);
      } catch {
        // Keep the in-memory preference when browser storage is unavailable.
      }
      return next;
    });
  };
  useEffect(() => {
    if (!settingsOpen) return;
    const fitSettingsWindow = () => {
      const rect = settingsWindowRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSettingsPosition((position) => {
        const current = position || {
          x: Math.max(8, window.innerWidth - rect.width - 28),
          y: Math.max(8, Math.min(72, window.innerHeight - rect.height - 8)),
        };
        return {
          x: Math.max(8, Math.min(current.x, window.innerWidth - rect.width - 8)),
          y: Math.max(8, Math.min(current.y, window.innerHeight - rect.height - 8)),
        };
      });
    };
    const frame = requestAnimationFrame(fitSettingsWindow);
    window.addEventListener('resize', fitSettingsWindow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fitSettingsWindow);
    };
  }, [settingsOpen]);
  const startSettingsDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button, input, a, select')) return;
    const windowElement = settingsWindowRef.current;
    if (!windowElement) return;
    const rect = windowElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const move = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      setSettingsPosition({
        x: Math.max(8, Math.min(moveEvent.clientX - offsetX, window.innerWidth - rect.width - 8)),
        y: Math.max(8, Math.min(moveEvent.clientY - offsetY, window.innerHeight - rect.height - 8)),
      });
    };
    const finish = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };
  const confirmMove = async (targetDirectory, options) => {
    if (!moveRequest) return;
    setMoveActionError('');
    try {
      const moved = moveRequest.bulk
        ? await onMoveSelected(moveRequest.items, targetDirectory, options)
        : await onMove(moveRequest.items[0], targetDirectory, options);
      if (moved) {
        setCheckedItems(new Map());
        setSelectionMode(false);
        setMoveRequest(null);
      } else {
        setMoveActionError('이동되지 않았습니다. 같은 위치·중복 파일·서버 권한을 확인하세요.');
      }
    } catch (error) {
      setMoveActionError(`최종 이동 실패: ${error?.message || error}`);
    }
  };
  if (compact) return <aside className="webdav-compact-rail" aria-label="접힌 WebDAV 목록">
    <button type="button" className="webdav-compact-button" onClick={onToggleCompact} title="WebDAV 목록 펼치기" aria-label="WebDAV 목록 펼치기">
      <PanelLeftOpen size={18}/>
    </button>
    <strong className="webdav-compact-label">WebDAV</strong>
  </aside>;

  return <div className="webdav-explorer-root relative min-h-0 max-h-[calc(100vh-2rem)] min-w-[100px] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" style={{ flexBasis: `${explorerWidth}%` }} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop} role="tree" aria-label="WebDAV 폴더 트리">
    <div className="webdav-explorer-bar sticky top-0 z-10">
      <span className="mdpro-stage-dot" aria-hidden="true"/>
      <strong>WebDAV</strong>
      <button type="button" className="webdav-explorer-label text-left" onClick={() => setSelectedFolderPath('/')} title="루트 폴더를 생성 위치로 선택">{selectedFolderPath === '/' ? '폴더 트리' : selectedFolderPath}</button>
      <div className="webdav-explorer-actions" aria-label="새 항목 만들기">
        <button type="button" className={`webdav-selection-move ${selectionMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100' : ''}`} onClick={moveCheckedItems} disabled={loading} title={selectionMode ? (checkedItems.size ? `선택한 ${checkedItems.size}개 항목을 함께 이동` : '선택이동 취소') : '이동할 항목 선택 시작'} aria-label={selectionMode ? (checkedItems.size ? `선택이동 실행 ${checkedItems.size}개` : '선택이동 취소') : '선택이동 시작'}><FolderInput size={15}/><span>{selectionMode ? (checkedItems.size ? `이동 ${checkedItems.size}` : '선택취소') : '선택이동'}</span></button>
        {selectionMode && <button type="button" onClick={() => { setCheckedItems(new Map()); setSelectionMode(false); setMoveRequest(null); setMoveActionError(''); }} disabled={loading} title="선택이동 모드 해제" aria-label="선택이동 모드 해제"><X size={16}/></button>}
        <button type="button" onClick={onRequestCreateFile} disabled={loading} title="ROOT부터 위치를 선택해 새 Markdown 파일 만들기" aria-label="새 Markdown 파일 생성 위치 선택"><FilePlus2 size={16}/></button>
        <button type="button" onClick={onRequestCreateFolder} disabled={loading} title="ROOT부터 위치를 선택해 새 폴더 만들기" aria-label="새 폴더 생성 위치 선택"><FolderPlus size={16}/></button>
        <button type="button" className={fileToolsMode !== 'hover' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100' : ''} onClick={toggleFileTools} title={`파일 행 도구: ${FILE_TOOLS_MODE_LABELS[fileToolsMode]} (클릭: ${FILE_TOOLS_MODE_LABELS[fileToolsNextMode]})`} aria-label={`파일 행 도구 ${FILE_TOOLS_MODE_LABELS[fileToolsMode]}. 클릭하여 ${FILE_TOOLS_MODE_LABELS[fileToolsNextMode]}로 전환`}>{fileToolsMode === 'always' ? <Eye size={16}/> : fileToolsMode === 'hidden' ? <EyeOff size={16}/> : <MousePointer2 size={16}/>}</button>
        <button type="button" onClick={() => setSettingsOpen(true)} title="WebDAV 설정" aria-label="WebDAV 설정 열기"><Settings size={16}/></button>
        <button type="button" onClick={toggleAllFolders} disabled={directoryPaths.size === 0} className={allFoldersExpanded ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100' : ''} title={allFoldersExpanded ? '모든 폴더 닫기' : '모든 폴더 열기'} aria-label={allFoldersExpanded ? '모든 폴더 닫기' : '모든 폴더 열기'} aria-pressed={allFoldersExpanded}><ChevronDown size={16} className={`transition-transform ${allFoldersExpanded ? 'rotate-180' : ''}`}/></button>
      </div>
      <button type="button" className="webdav-collapse-button" onClick={onToggleCompact} title="WebDAV를 한 줄 띠로 접기" aria-label="WebDAV를 한 줄 띠로 접기"><PanelLeftClose size={16}/></button>
    </div>
    {isDragging && <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-indigo-600 pointer-events-none dark:bg-slate-900/90"><Upload size={20} className="mr-2"/>파일/폴더를 여기에 놓으세요</div>}
    {rootEntries.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{loading ? 'WebDAV 파일 목록을 불러오는 중입니다…' : '폴더가 비어있습니다.'}</div>}
    {rootEntries.map((item) => <TreeItem key={item.remotePath} item={item} depth={0} expandedPaths={expandedPaths} selectedFolderPath={selectedFolderPath} selectionMode={selectionMode} checkedPaths={checkedPaths} fileToolsMode={fileToolsMode} loading={loading} editorLoading={editorLoading} copiedKey={copiedKey} formatBytes={formatBytes} onToggleFolder={toggleFolder} onToggleExpanded={toggleExpandedOnly} onToggleChecked={toggleChecked} onCopyUrl={onCopyUrl} onShareFile={onShareFile} onOpenFile={onOpenFile} onDownload={onDownload} onRename={onRename} onMove={(item) => { setMoveActionError(''); setMoveRequest({ items: [item], bulk: false }); }} onDelete={onDelete} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder}/>)}
    {settingsOpen && <div
      ref={settingsWindowRef}
      className="webdav-settings-window w-full max-w-sm overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      style={settingsPosition ? { left: `${settingsPosition.x}px`, top: `${settingsPosition.y}px` } : undefined}
      role="dialog"
      aria-modal="false"
      aria-labelledby="webdav-settings-title"
    >
        <div className="webdav-settings-window-bar flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700" onPointerDown={startSettingsDrag}>
          <Settings size={18} className="mr-2 text-indigo-600"/>
          <h2 id="webdav-settings-title" className="flex-1 font-semibold">WebDAV 설정</h2>
          <button type="button" onClick={() => setSettingsOpen(false)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="WebDAV 설정 닫기"><X size={18}/></button>
        </div>
        <div className="p-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70">
            <input type="checkbox" checked={showHiddenItems} onChange={(event) => onShowHiddenItemsChange(event.target.checked)} disabled={loading} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"/>
            <span><span className="block text-sm font-medium">숨김 파일 보이기</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">이름이 점(.)으로 시작하는 숨김 폴더와 파일을 목록에 표시합니다.</span></span>
          </label>
          <label className="mt-3 block rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-sm font-medium">전체 기본 공유 비밀번호</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">새 pwShare의 기본값입니다. 공유할 때 파일별로 바꿀 수 있습니다.</span>
            <input type="password" value={defaultSharePassword} onChange={(event) => onDefaultSharePasswordChange(event.target.value)} placeholder="기본 비밀번호" className="mt-2 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600"/>
          </label>
        </div>
    </div>}
    <MoveDestinationModal key={moveRequest?.items?.map((item) => item.remotePath).join('|') || 'closed'} items={moveRequest?.items} directoryTree={directoryTree} loading={loading} progress={moveProgress} actionError={moveActionError} onConfirm={confirmMove} onCancel={() => { if (!loading) { setMoveRequest(null); setMoveActionError(''); } }}/>
  </div>;
}

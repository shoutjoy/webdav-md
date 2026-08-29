import { useState } from 'react';
import { Archive, Check, ChevronDown, ChevronRight, Copy, Download, Edit, Eye, EyeOff, FileInput, FilePlus2, FileText, Folder, FolderInput, FolderOpen, FolderPlus, PanelLeftClose, PanelLeftOpen, Trash2, Upload, X } from 'lucide-react';
import MoveDestinationModal from './MoveDestinationModal.jsx';

const FILE_TOOLS_VISIBLE_KEY = 'webdav-file-tools-visible';

function getInitialFileToolsVisible() {
  try {
    return localStorage.getItem(FILE_TOOLS_VISIBLE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function TreeItem({ item, depth, expandedPaths, selectedFolderPath, selectionMode, checkedPaths, fileToolsVisible, loading, editorLoading, copiedKey, formatBytes, onToggleFolder, onToggleExpanded, onToggleChecked, onCopyUrl, onOpenFile, onDownload, onRename, onMove, onDelete, onCreateFile, onCreateFolder }) {
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
      <button type="button" onClick={() => selectionMode && !item.isArchiveEntry ? onToggleChecked(item) : (expandable ? onToggleFolder(item) : onOpenFile(item))} className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left" title={selectionMode && !item.isArchiveEntry ? `${item.name} 이동 항목 선택` : item.remotePath}>
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
      {fileToolsVisible && <div className="ml-1 hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
        {!item.isArchiveEntry && <button type="button" onClick={() => onCopyUrl(item.remotePath, itemKey)} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="URL 복사">{copiedKey === itemKey ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>}
        {!item.isDirectory && !item.isArchive && <button type="button" onClick={() => onOpenFile(item)} disabled={editorLoading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 dark:hover:bg-slate-700" title="열기 (이미지는 FMA)"><Eye size={14}/></button>}
        {!item.isDirectory && !item.isArchiveEntry && <button type="button" onClick={() => onDownload(item.name)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="다운로드"><Download size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={() => onRename(item)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="이름 변경"><Edit size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={() => onMove(item)} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700" title="다른 폴더로 이동" aria-label={`${item.name} 다른 폴더로 이동`}><FileInput size={14}/></button>}
        {!item.isArchiveEntry && <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(item); }} disabled={loading} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="삭제"><Trash2 size={14}/></button>}
      </div>}
    </div>
    {expanded && children.map((child) => <TreeItem key={child.remotePath} item={child} depth={depth + 1} expandedPaths={expandedPaths} selectedFolderPath={selectedFolderPath} selectionMode={selectionMode} checkedPaths={checkedPaths} fileToolsVisible={fileToolsVisible} loading={loading} editorLoading={editorLoading} copiedKey={copiedKey} formatBytes={formatBytes} onToggleFolder={onToggleFolder} onToggleExpanded={onToggleExpanded} onToggleChecked={onToggleChecked} onCopyUrl={onCopyUrl} onOpenFile={onOpenFile} onDownload={onDownload} onRename={onRename} onMove={onMove} onDelete={onDelete} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder}/>)}
  </>;
}

export default function FileExplorer({ files, directoryTree, loading, editorLoading, copiedKey, isDragging, explorerWidth, compact, folderSelectionMode, formatBytes, onDragEnter, onDragLeave, onDragOver, onDrop, onOpenDirectory, onOpenArchive, onCopyUrl, onOpenFile, onDownload, onRename, onMove, onMoveSelected, onDelete, onCreateFile, onCreateFolder, onRequestCreateFile, onRequestCreateFolder, onToggleCompact }) {
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['/']));
  const [selectedFolderPath, setSelectedFolderPath] = useState('/');
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedItems, setCheckedItems] = useState(() => new Map());
  const [moveRequest, setMoveRequest] = useState(null);
  const [moveActionError, setMoveActionError] = useState('');
  const [fileToolsVisible, setFileToolsVisible] = useState(getInitialFileToolsVisible);
  const checkedPaths = new Set(checkedItems.keys());
  const rootEntries = (directoryTree?.entries?.length ? directoryTree.entries : files).filter((item) => item.name !== '..');
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
    setFileToolsVisible((visible) => {
      const next = !visible;
      try {
        localStorage.setItem(FILE_TOOLS_VISIBLE_KEY, String(next));
      } catch {
        // Keep the in-memory preference when browser storage is unavailable.
      }
      return next;
    });
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

  return <div className="relative min-h-0 max-h-[calc(100vh-2rem)] min-w-[100px] overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" style={{ flexBasis: `${explorerWidth}%` }} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop} role="tree" aria-label="WebDAV 폴더 트리">
    <div className="webdav-explorer-bar sticky top-0 z-10">
      <span className="mdpro-stage-dot" aria-hidden="true"/>
      <strong>WebDAV</strong>
      <button type="button" className="webdav-explorer-label text-left" onClick={() => setSelectedFolderPath('/')} title="루트 폴더를 생성 위치로 선택">{selectedFolderPath === '/' ? '폴더 트리' : selectedFolderPath}</button>
      <div className="webdav-explorer-actions" aria-label="새 항목 만들기">
        <button type="button" className={`webdav-selection-move ${selectionMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100' : ''}`} onClick={moveCheckedItems} disabled={loading} title={selectionMode ? (checkedItems.size ? `선택한 ${checkedItems.size}개 항목을 함께 이동` : '선택이동 취소') : '이동할 항목 선택 시작'} aria-label={selectionMode ? (checkedItems.size ? `선택이동 실행 ${checkedItems.size}개` : '선택이동 취소') : '선택이동 시작'}><FolderInput size={15}/><span>{selectionMode ? (checkedItems.size ? `이동 ${checkedItems.size}` : '선택취소') : '선택이동'}</span></button>
        {selectionMode && <button type="button" onClick={() => { setCheckedItems(new Map()); setSelectionMode(false); setMoveRequest(null); setMoveActionError(''); }} disabled={loading} title="선택이동 모드 해제" aria-label="선택이동 모드 해제"><X size={16}/></button>}
        <button type="button" onClick={onRequestCreateFile} disabled={loading} title="ROOT부터 위치를 선택해 새 Markdown 파일 만들기" aria-label="새 Markdown 파일 생성 위치 선택"><FilePlus2 size={16}/></button>
        <button type="button" onClick={onRequestCreateFolder} disabled={loading} title="ROOT부터 위치를 선택해 새 폴더 만들기" aria-label="새 폴더 생성 위치 선택"><FolderPlus size={16}/></button>
        <button type="button" className={!fileToolsVisible ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100' : ''} onClick={toggleFileTools} title={fileToolsVisible ? '파일 행 도구 숨기기' : '파일 행 도구 표시'} aria-label={fileToolsVisible ? '파일 행 도구 숨기기' : '파일 행 도구 표시'} aria-pressed={!fileToolsVisible}>{fileToolsVisible ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
      </div>
      <button type="button" className="webdav-collapse-button" onClick={onToggleCompact} title="WebDAV를 한 줄 띠로 접기" aria-label="WebDAV를 한 줄 띠로 접기"><PanelLeftClose size={16}/></button>
    </div>
    {isDragging && <div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-indigo-400 bg-indigo-50/90 text-indigo-600 pointer-events-none dark:bg-slate-900/90"><Upload size={20} className="mr-2"/>파일/폴더를 여기에 놓으세요</div>}
    {rootEntries.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{loading ? 'WebDAV 파일 목록을 불러오는 중입니다…' : '폴더가 비어있습니다.'}</div>}
    {rootEntries.map((item) => <TreeItem key={item.remotePath} item={item} depth={0} expandedPaths={expandedPaths} selectedFolderPath={selectedFolderPath} selectionMode={selectionMode} checkedPaths={checkedPaths} fileToolsVisible={fileToolsVisible} loading={loading} editorLoading={editorLoading} copiedKey={copiedKey} formatBytes={formatBytes} onToggleFolder={toggleFolder} onToggleExpanded={toggleExpandedOnly} onToggleChecked={toggleChecked} onCopyUrl={onCopyUrl} onOpenFile={onOpenFile} onDownload={onDownload} onRename={onRename} onMove={(item) => { setMoveActionError(''); setMoveRequest({ items: [item], bulk: false }); }} onDelete={onDelete} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder}/>)}
    <MoveDestinationModal key={moveRequest?.items?.map((item) => item.remotePath).join('|') || 'closed'} items={moveRequest?.items} directoryTree={directoryTree} loading={loading} actionError={moveActionError} onConfirm={confirmMove} onCancel={() => { if (!loading) { setMoveRequest(null); setMoveActionError(''); } }}/>
  </div>;
}

import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, X } from 'lucide-react';

function findDirectory(node, targetPath) {
  if (!node) return null;
  if ((node.path || node.remotePath || '/') === targetPath) return node;
  for (const entry of node.entries || []) {
    if (!entry.isDirectory) continue;
    const found = findDirectory(entry, targetPath);
    if (found) return found;
  }
  return null;
}

function FolderChoice({ node, depth, expandedPaths, selectedPath, blockedPaths, blockedDestinationPaths, onToggle, onSelect }) {
  const path = node.path || node.remotePath || '/';
  const folders = (node.entries || []).filter((entry) => entry.isDirectory);
  const expanded = expandedPaths.has(path);
  const blocked = blockedDestinationPaths.has(path)
    || [...blockedPaths].some((sourcePath) => path === sourcePath || path.startsWith(`${sourcePath}/`));

  return <>
    <div className={`flex items-center rounded-md ${selectedPath === path ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
      <button type="button" onClick={() => onToggle(path)} className="grid h-8 w-7 shrink-0 place-items-center text-slate-400" aria-label={expanded ? `${node.name} 접기` : `${node.name} 펼치기`} disabled={!folders.length}>
        {folders.length ? (expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span/>}
      </button>
      <button type="button" onClick={() => onSelect(path)} disabled={blocked} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-35" title={blocked ? '이 폴더 또는 하위 폴더로는 이동할 수 없습니다.' : path}>
        {expanded ? <FolderOpen size={16} className="shrink-0 text-amber-400"/> : <Folder size={16} className="shrink-0 text-amber-400"/>}
        <span className="truncate">{path === '/' ? 'WebDAV 루트' : node.name}</span>
        {selectedPath === path && <span className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-300">선택됨</span>}
      </button>
    </div>
    {expanded && folders.map((folder) => <FolderChoice key={folder.remotePath} node={folder} depth={depth + 1} expandedPaths={expandedPaths} selectedPath={selectedPath} blockedPaths={blockedPaths} blockedDestinationPaths={blockedDestinationPaths} onToggle={onToggle} onSelect={onSelect}/>)}
  </>;
}

export default function MoveDestinationModal({ items, directoryTree, loading, progress, actionError, onConfirm, onCancel }) {
  const [selectedPath, setSelectedPath] = useState('');
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['/']));
  const [conflictingItems, setConflictingItems] = useState([]);
  if (!items?.length) return null;
  const blockedPaths = new Set(items.filter((item) => item.isDirectory).map((item) => item.remotePath));
  const blockedDestinationPaths = new Set(items.map((item) => {
    const parts = String(item.remotePath || '/').split('/').filter(Boolean);
    parts.pop();
    return parts.length ? `/${parts.join('/')}` : '/';
  }));
  const toggle = (path) => setExpandedPaths((paths) => {
    const next = new Set(paths);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });
  const confirmDestination = () => {
    const targetEntries = findDirectory(directoryTree, selectedPath)?.entries || [];
    const existingNames = new Set(targetEntries.map((entry) => entry.name.toLocaleLowerCase()));
    const seenNames = new Set();
    const conflicts = items.filter((item) => {
      const name = item.name.toLocaleLowerCase();
      const conflict = existingNames.has(name) || seenNames.has(name);
      seenNames.add(name);
      return conflict;
    });
    if (conflicts.length) {
      setConflictingItems(conflicts);
      return;
    }
    onConfirm(selectedPath, { conflictPolicy: 'reject' });
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="move-destination-title">
    <div className="flex max-h-[min(680px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0 flex-1"><h2 id="move-destination-title" className="font-semibold">이동할 폴더 선택</h2><p className="truncate text-xs text-slate-500">선택한 {items.length}개 항목의 새 위치</p></div>
        <button type="button" onClick={onCancel} disabled={loading} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="닫기"><X size={18}/></button>
      </div>
      {conflictingItems.length > 0 ? <div className="min-h-48 flex-1 overflow-auto p-5">
        <h3 className="font-semibold text-amber-700 dark:text-amber-300">같은 이름의 파일이 있습니다</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">대상 폴더에 있는 {conflictingItems.length}개 파일을 어떻게 처리할까요?</p>
        <div className="mt-3 max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-950">
          {conflictingItems.map((item) => <div key={item.remotePath} className="truncate py-1">{item.name}</div>)}
        </div>
        <div className="mt-4 grid gap-2">
          <button type="button" disabled={loading || conflictingItems.some((item) => item.isDirectory)} onClick={() => onConfirm(selectedPath, { conflictPolicy: 'overwrite' })} className="rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">기존 파일 덮어쓰기<span className="mt-0.5 block text-xs font-normal opacity-75">대상 폴더의 같은 이름 파일을 새 파일로 교체합니다.</span></button>
          <button type="button" disabled={loading} onClick={() => onConfirm(selectedPath, { conflictPolicy: 'rename' })} className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-left text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">이름 바꾸어 저장<span className="mt-0.5 block text-xs font-normal opacity-75">확장자를 유지하고 (1), (2)를 붙여 함께 보관합니다.</span></button>
        </div>
      </div> : <div className="min-h-48 flex-1 overflow-auto p-2" role="tree">
        <FolderChoice node={directoryTree} depth={0} expandedPaths={expandedPaths} selectedPath={selectedPath} blockedPaths={blockedPaths} blockedDestinationPaths={blockedDestinationPaths} onToggle={toggle} onSelect={setSelectedPath}/>
      </div>}
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">선택 위치: <span className="font-mono text-slate-800 dark:text-slate-200">{selectedPath || '폴더를 선택하세요'}</span></div>
      {loading && progress && <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700" aria-live="polite">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300"><span>파일 복사 및 확인 중</span><span>{progress.percent}%</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percent}>
          <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-200" style={{ width: `${progress.percent}%` }}/>
        </div>
        <div className="mt-1 truncate text-[10px] text-slate-500" title={progress.path}>{progress.path || '이동 준비 중…'}</div>
      </div>}
      {actionError && <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{actionError}</div>}
      <div className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
        <button type="button" onClick={conflictingItems.length ? () => setConflictingItems([]) : onCancel} disabled={loading} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">{conflictingItems.length ? '뒤로' : '취소'}</button>
        {!conflictingItems.length && <button type="button" onClick={confirmDestination} disabled={loading || !selectedPath} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{loading ? '이동 중…' : '이 위치로 이동'}</button>}
      </div>
    </div>
  </div>;
}

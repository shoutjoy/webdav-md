import { useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, Folder, FolderOpen, FolderPlus, X } from 'lucide-react';

function FolderChoice({ node, depth, expandedPaths, selectedPath, onToggle, onSelect }) {
  const path = node.path || node.remotePath || '/';
  const folders = (node.entries || []).filter((entry) => entry.isDirectory);
  const expanded = expandedPaths.has(path);
  return <>
    <div className={`flex items-center rounded-md ${selectedPath === path ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
      <button type="button" onClick={() => onToggle(path)} className="grid h-8 w-7 shrink-0 place-items-center text-slate-400" aria-label={expanded ? `${node.name} 접기` : `${node.name} 펼치기`} disabled={!folders.length}>{folders.length ? (expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span/>}</button>
      <button type="button" onClick={() => onSelect(path)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left text-sm" title={path}>
        {expanded ? <FolderOpen size={16} className="shrink-0 text-amber-400"/> : <Folder size={16} className="shrink-0 text-amber-400"/>}
        <span className="truncate">{path === '/' ? 'WebDAV ROOT' : node.name}</span>
        {selectedPath === path && <span className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-300">생성 위치</span>}
      </button>
    </div>
    {expanded && folders.map((folder) => <FolderChoice key={folder.remotePath} node={folder} depth={depth + 1} expandedPaths={expandedPaths} selectedPath={selectedPath} onToggle={onToggle} onSelect={onSelect}/>)}
  </>;
}

export default function CreateDestinationModal({ type, directoryTree, loading, onConfirm, onCancel }) {
  const [selectedPath, setSelectedPath] = useState('/');
  const [expandedPaths, setExpandedPaths] = useState(() => new Set(['/']));
  if (!type) return null;
  const isFolder = type === 'folder';
  const label = isFolder ? '폴더' : '파일';
  const Icon = isFolder ? FolderPlus : FilePlus2;
  const toggle = (path) => setExpandedPaths((paths) => { const next = new Set(paths); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="create-destination-title">
    <div className="flex max-h-[min(680px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700"><Icon size={18} className="mr-2 shrink-0 text-indigo-600"/><div className="min-w-0 flex-1"><h2 id="create-destination-title" className="font-semibold">새 {label} 생성 위치</h2><p className="text-xs text-slate-500">ROOT부터 생성할 폴더를 선택하세요.</p></div><button type="button" onClick={onCancel} disabled={loading} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="닫기"><X size={18}/></button></div>
      <div className="min-h-48 flex-1 overflow-auto p-2" role="tree"><FolderChoice node={directoryTree} depth={0} expandedPaths={expandedPaths} selectedPath={selectedPath} onToggle={toggle} onSelect={setSelectedPath}/></div>
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">선택 위치: <span className="font-mono text-slate-800 dark:text-slate-200">{selectedPath}</span></div>
      <div className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700"><button type="button" onClick={onCancel} disabled={loading} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">취소</button><button type="button" onClick={() => onConfirm(selectedPath)} disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">이 위치에 {label} 생성</button></div>
    </div>
  </div>;
}

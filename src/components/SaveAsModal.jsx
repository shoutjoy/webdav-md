import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileOutput, Folder, FolderOpen, X } from 'lucide-react';

function FolderChoice({ node, depth, expandedPaths, selectedPath, onToggle, onSelect }) {
  const path = node.path || node.remotePath || '/';
  const folders = (node.entries || []).filter((entry) => entry.isDirectory);
  const expanded = expandedPaths.has(path);
  return <>
    <div className={`flex items-center rounded-md ${selectedPath === path ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100' : ''}`} style={{ paddingLeft: `${8 + depth * 18}px` }}>
      <button type="button" onClick={() => onToggle(path)} className="grid h-8 w-7 shrink-0 place-items-center text-slate-400" aria-label={expanded ? `${node.name} 접기` : `${node.name} 펼치기`} disabled={!folders.length}>
        {folders.length ? (expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span/>}
      </button>
      <button type="button" onClick={() => onSelect(path)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left text-sm" title={path}>
        {expanded ? <FolderOpen size={16} className="shrink-0 text-amber-400"/> : <Folder size={16} className="shrink-0 text-amber-400"/>}
        <span className="truncate">{path === '/' ? 'WebDAV ROOT' : node.name}</span>
        {selectedPath === path && <span className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-300">저장 위치</span>}
      </button>
    </div>
    {expanded && folders.map((folder) => <FolderChoice key={folder.remotePath} node={folder} depth={depth + 1} expandedPaths={expandedPaths} selectedPath={selectedPath} onToggle={onToggle} onSelect={onSelect}/>)}
  </>;
}

export default function SaveAsModal({ request, directoryTree, loading, onConfirm, onCancel }) {
  const [selectedPath, setSelectedPath] = useState(request?.parentPath || '/');
  const [fileName, setFileName] = useState(request?.suggestedName || 'document.md');
  const [expandedPaths, setExpandedPaths] = useState(() => {
    const parts = String(request?.parentPath || '/').split('/').filter(Boolean);
    const paths = new Set(['/']);
    let path = '';
    for (const part of parts) { path += `/${part}`; paths.add(path); }
    return paths;
  });
  const validationError = useMemo(() => {
    const name = fileName.trim();
    if (!name) return '파일명을 입력하세요.';
    if (name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) return '파일명에 \\ / : * ? " < > | 문자를 사용할 수 없습니다.';
    return '';
  }, [fileName]);
  if (!request) return null;
  const targetPath = selectedPath === '/' ? `/${fileName.trim()}` : `${selectedPath}/${fileName.trim()}`;
  const toggle = (path) => setExpandedPaths((paths) => { const next = new Set(paths); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const submit = (event) => {
    event.preventDefault();
    if (!validationError && !loading) onConfirm(selectedPath, fileName.trim());
  };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="save-as-title">
    <form onSubmit={submit} className="flex max-h-[min(720px,92vh)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center border-b border-slate-200 px-4 py-3 dark:border-slate-700"><FileOutput size={18} className="mr-2 shrink-0 text-indigo-600"/><div className="min-w-0 flex-1"><h2 id="save-as-title" className="font-semibold">WebDAV에 다른 이름으로 저장</h2><p className="text-xs text-slate-500">저장할 폴더와 새 파일명을 선택하세요.</p></div><button type="button" onClick={onCancel} disabled={loading} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="닫기"><X size={18}/></button></div>
      <div className="min-h-48 flex-1 overflow-auto p-2" role="tree"><FolderChoice node={directoryTree} depth={0} expandedPaths={expandedPaths} selectedPath={selectedPath} onToggle={toggle} onSelect={setSelectedPath}/></div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-700">
        <label htmlFor="save-as-file-name" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">새 파일명</label>
        <input id="save-as-file-name" autoFocus value={fileName} onChange={(event) => setFileName(event.target.value)} disabled={loading} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-950 dark:focus:ring-indigo-900" />
        {validationError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationError}</p>}
        <p className="mt-2 truncate text-xs text-slate-500" title={targetPath}>저장 경로: <span className="font-mono text-slate-800 dark:text-slate-200">{targetPath}</span></p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700"><button type="button" onClick={onCancel} disabled={loading} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">취소</button><button type="submit" disabled={loading || Boolean(validationError)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{loading ? '저장 중…' : '새 파일로 저장'}</button></div>
    </form>
  </div>;
}

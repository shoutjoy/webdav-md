import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Copy, FilePlus, LogOut, Menu, PanelLeft, RefreshCw, Upload, X } from 'lucide-react';

const WD_DOCK_POSITION_KEY = 'webdav-wd-dock-position-v3';
const VIEWPORT_MARGIN = 16;

const clampDockPosition = (x, y, width, height) => ({
  x: Math.min(Math.max(VIEWPORT_MARGIN, x), Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)),
  y: Math.min(Math.max(VIEWPORT_MARGIN, y), Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN)),
});

export default function TopNav({ currentPath, publicUrl, loading, error, copiedKey, fileInputRef, onGoBack, onUpload, onNewFile, onRefresh, explorerOpen, onToggleExplorer, onCopyFolderUrl, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WD_DOCK_POSITION_KEY) || 'null');
      return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? saved : null;
    } catch {
      return null;
    }
  });
  const dockRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (position) return;
    const alignTopRight = () => {
      if (!dockRef.current) return;
      const dockRect = dockRef.current.getBoundingClientRect();
      setPosition(clampDockPosition(
        window.innerWidth - dockRect.width - VIEWPORT_MARGIN,
        VIEWPORT_MARGIN,
        dockRect.width,
        dockRect.height,
      ));
    };
    const frame = window.requestAnimationFrame(alignTopRight);
    return () => window.cancelAnimationFrame(frame);
  }, [position]);

  useEffect(() => {
    const keepDockInViewport = () => {
      if (!position || !dockRef.current) return;
      const rect = dockRef.current.getBoundingClientRect();
      const next = clampDockPosition(position.x, position.y, rect.width, rect.height);
      if (next.x !== position.x || next.y !== position.y) setPosition(next);
    };
    window.addEventListener('resize', keepDockInViewport);
    keepDockInViewport();
    return () => window.removeEventListener('resize', keepDockInViewport);
  }, [position]);

  useEffect(() => {
    if (position) localStorage.setItem(WD_DOCK_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  const handleDockPointerDown = (event) => {
    if (event.button !== 0 || !dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDockPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    suppressClickRef.current = true;
    setPosition(clampDockPosition(drag.left + deltaX, drag.top + deltaY, drag.width, drag.height));
  };

  const handleDockPointerUp = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleDockClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((value) => !value);
  };

  const dockIsOnLeft = position && position.x < window.innerWidth / 2;

  return <>
    <div
      ref={dockRef}
      className={`fixed z-50 ${position ? '' : 'right-4 top-4 opacity-0'}`}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <button
        type="button"
        onClick={handleDockClick}
        onPointerDown={handleDockPointerDown}
        onPointerMove={handleDockPointerMove}
        onPointerUp={handleDockPointerUp}
        onPointerCancel={handleDockPointerUp}
        className="flex h-10 touch-none select-none items-center gap-2 rounded-full border border-slate-600 bg-slate-900 px-3 text-white shadow-[0_8px_24px_rgba(15,23,42,0.32)] hover:bg-slate-800 active:cursor-grabbing dark:border-slate-500 dark:shadow-[0_10px_30px_rgba(0,0,0,0.72),0_0_0_1px_rgba(148,163,184,0.18)]"
        aria-label={open ? 'WD Dock 접기' : 'WD Dock 열기'}
        aria-expanded={open}
      >
        <span className="text-xs font-semibold tracking-wide">WD Dock</span>
        {open ? <X size={18}/> : <Menu size={18}/>} 
      </button>
      {open && <div className={`absolute top-[calc(100%+0.4rem)] w-[min(470px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white/95 text-slate-800 shadow-2xl backdrop-blur dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-[0_18px_48px_rgba(0,0,0,0.78),0_0_0_1px_rgba(148,163,184,0.16)] ${dockIsOnLeft ? 'left-0' : 'right-0'}`}>
        <div className="flex items-center gap-1.5 border-b border-slate-200 p-2 dark:border-slate-700">
          <button onClick={onGoBack} disabled={currentPath === '/' || loading} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="상위 폴더"><ArrowLeft size={16}/></button>
          <div className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2.5 py-1.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{currentPath}</div>
          <button onClick={onToggleExplorer} className={`rounded-md p-1.5 ${explorerOpen ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`} title="탐색기 열기/접기"><PanelLeft size={16}/></button>
          <input type="file" ref={fileInputRef} onChange={onUpload} className="hidden" multiple/>
          <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="rounded-md bg-indigo-600 p-1.5 text-white disabled:opacity-40" title="업로드"><Upload size={16}/></button>
          <button onClick={onNewFile} disabled={loading} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" title="새 파일"><FilePlus size={16}/></button>
          <button onClick={onRefresh} disabled={loading} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" title="새로고침"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          <button onClick={onDisconnect} className="rounded-md p-1.5 text-red-600 hover:bg-red-50" title="연결 종료"><LogOut size={16}/></button>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-slate-500"><span>접속 URL</span><span className="min-w-0 flex-1 truncate font-mono text-slate-700">{publicUrl}</span><button onClick={onCopyFolderUrl} disabled={loading} className="rounded p-1 hover:bg-slate-100" title="URL 복사">{copiedKey === 'folder' ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}</button></div>
      </div>}
    </div>
    {error && <div className="fixed bottom-5 left-1/2 z-50 flex max-w-[min(760px,90vw)] -translate-x-1/2 items-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-xl"><AlertCircle size={17} className="mr-2 shrink-0"/>{error}</div>}
  </>;
}

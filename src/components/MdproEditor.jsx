import { useEffect, useRef, useState } from 'react';

const FMA_WIDTH_KEY = 'webdav-fma-panel-width';
const APP_BASE_URL = import.meta.env.BASE_URL;
const MDPRO_URL = `${APP_BASE_URL}mdpro/index.html?webdav=1`;
const FMA_URL = `${APP_BASE_URL}mdpro/Apps/fmaviewer/index.html?embedded=1`;

export default function MdproEditor({ selectedFile, content, binaryContent, fmaImportBatch, loading, saving, explorerWidth, onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onClose, onToggleExplorer, onOpenExplorer, onOpenFolderExplorer, onThemeChange }) {
  const mdproFrameRef = useRef(null);
  const fmaFrameRef = useRef(null);
  const documentRef = useRef({ selectedFile, content, binaryContent, fmaImportBatch });
  const callbacksRef = useRef({ onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onToggleExplorer, onOpenExplorer, onOpenFolderExplorer, onThemeChange });
  const [fmaWidth, setFmaWidth] = useState(() => {
    const saved = Number.parseFloat(localStorage.getItem(FMA_WIDTH_KEY));
    return Number.isFinite(saved) ? Math.min(78, Math.max(32, saved)) : 58;
  });

  useEffect(() => { documentRef.current = { selectedFile, content, binaryContent, fmaImportBatch }; }, [selectedFile, content, binaryContent, fmaImportBatch]);
  useEffect(() => { callbacksRef.current = { onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onToggleExplorer, onOpenExplorer, onOpenFolderExplorer, onThemeChange }; }, [onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onToggleExplorer, onOpenExplorer, onOpenFolderExplorer, onThemeChange]);

  const sendFmaContent = () => {
    const current = documentRef.current;
    if (current.fmaImportBatch?.entries?.length) {
      const files = current.fmaImportBatch.entries.map((entry) => new File([entry.binaryContent], entry.name, {
        type: getImageMimeType(entry.name), lastModified: entry.lastModified || Date.now(),
      }));
      fmaFrameRef.current?.contentWindow?.postMessage({ type: 'fmaviewer-open-files', files, selectedName: files[0]?.name || '', importMode: 'append' }, window.location.origin);
      return;
    }
    if (current.selectedFile?.viewMode !== 'fma' || !current.binaryContent) return;
    const file = new File([current.binaryContent], current.selectedFile.name, {
      type: getImageMimeType(current.selectedFile.name),
      lastModified: current.selectedFile.lastModified?.getTime?.() || Date.now(),
    });
    fmaFrameRef.current?.contentWindow?.postMessage({
      type: 'fmaviewer-open-files', files: [file], selectedName: current.selectedFile.name,
      importMode: current.selectedFile.fmaImportMode === 'append' ? 'append' : 'replace',
    }, window.location.origin);
  };

  const attachWebdavBridge = () => {
    const frameDocument = mdproFrameRef.current?.contentDocument;
    if (!frameDocument || frameDocument.getElementById('webdav-host-bridge-script')) return;
    const script = frameDocument.createElement('script');
    script.id = 'webdav-host-bridge-script';
    script.src = `${APP_BASE_URL}mdpro/js/webdav-host-bridge.js?v=20260830-save-before-file-switch-1`;
    frameDocument.body.appendChild(script);
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      if (event.source === mdproFrameRef.current?.contentWindow) {
        if (event.data.type === 'mdpro-ready') {
          const current = documentRef.current;
          if (current.selectedFile && current.selectedFile.viewMode !== 'fma') {
            mdproFrameRef.current.contentWindow.postMessage({ type: 'webdav-open-document', content: current.content, binaryContent: current.binaryContent, fileName: current.selectedFile.name, path: current.selectedFile.remotePath }, window.location.origin);
          }
        }
        if (event.data.type === 'webdav-save-document') {
          Promise.resolve(callbacksRef.current.onSave(String(event.data.content ?? ''), event.data.path)).then((saved) => {
            if (saved) mdproFrameRef.current?.contentWindow?.postMessage({ type: 'webdav-document-saved', path: event.data.path }, window.location.origin);
          });
        }
        if (event.data.type === 'webdav-save-document-as') callbacksRef.current.onSaveAs(String(event.data.content ?? ''), event.data.path);
        if (event.data.type === 'webdav-document-changed') {
          const activePath = documentRef.current.selectedFile?.remotePath;
          if (!activePath || activePath === event.data.path) {
            callbacksRef.current.onDocumentChange?.(String(event.data.content ?? ''), Boolean(event.data.dirty));
          }
        }
        if (event.data.type === 'webdav-toggle-explorer') callbacksRef.current.onToggleExplorer();
        if (event.data.type === 'mdpro-theme-changed') callbacksRef.current.onThemeChange(event.data.theme === 'dark');
      }
      if (event.source === fmaFrameRef.current?.contentWindow) {
        if (event.data.type === 'fmaviewer-ready') sendFmaContent();
        if (event.data.type === 'fmaviewer-request-webdav-explorer') callbacksRef.current.onOpenExplorer();
        if (event.data.type === 'fmaviewer-request-webdav-folder') callbacksRef.current.onOpenFolderExplorer();
        if (event.data.type === 'fmaviewer-save-to-webdav-image-folder') callbacksRef.current.onSaveImageToFolder(event.data.image);
        if (event.data.type === 'fmaviewer-send-to-mdpro-img' || event.data.type === 'fmaviewer-open-image-insert') {
          mdproFrameRef.current?.contentWindow?.postMessage({ type: 'webdav-open-image-insert', image: event.data.image }, window.location.origin);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (selectedFile && selectedFile.viewMode !== 'fma') {
      mdproFrameRef.current?.contentWindow?.postMessage({ type: 'webdav-open-document', content, binaryContent, fileName: selectedFile.name, path: selectedFile.remotePath }, window.location.origin);
    }
    if (selectedFile?.viewMode === 'fma' || fmaImportBatch) sendFmaContent();
  }, [binaryContent, content, fmaImportBatch, selectedFile]);

  const isFmaOpen = selectedFile?.viewMode === 'fma';
  const clickFmaControl = (controlId) => {
    fmaFrameRef.current?.contentDocument?.getElementById(controlId)?.click();
  };
  const startFmaResize = (event) => {
    const host = event.currentTarget.parentElement;
    const resize = (clientX) => {
      const rect = host.getBoundingClientRect();
      setFmaWidth(Math.min(78, Math.max(32, ((rect.right - clientX) / rect.width) * 100)));
    };
    const move = (moveEvent) => resize(moveEvent.clientX);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.classList.remove('is-split-resizing');
      setFmaWidth((width) => { localStorage.setItem(FMA_WIDTH_KEY, String(width)); return width; });
    };
    document.body.classList.add('is-split-resizing');
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    resize(event.clientX);
  };

  return <section className="mdpro-stage" style={{ flexBasis: `${100 - explorerWidth}%` }}>
    <div className="mdpro-stage-bar"><span className="mdpro-stage-dot"/><strong>MDPRO</strong><span className="mdpro-stage-path">{selectedFile?.remotePath || 'WebDAV에서 문서를 선택하세요'}</span>{isFmaOpen && <button type="button" onClick={onClose}>FMA 닫기</button>}</div>
    {loading && !saving && <div className="mdpro-loading">WebDAV 파일을 여는 중…</div>}
    {saving && <div className="mdpro-saving" role="status" aria-live="polite"><span>WebDAV에 저장합니다.</span></div>}
    <div className="mdpro-workspace">
      <iframe ref={mdproFrameRef} src={MDPRO_URL} onLoad={attachWebdavBridge} title="MDPRO 문서 편집기" className="mdpro-frame mdpro-frame-mobile-fullscreen" allow="fullscreen" allowFullScreen />
      {isFmaOpen && <>
        <div className="fma-panel-resizer" onPointerDown={startFmaResize} role="separator" aria-label="문서와 FMA 너비 조절" title="드래그하여 문서와 FMA 크기 조절"><span/></div>
        <aside className="fma-dock" style={{ flexBasis: `${fmaWidth}%` }}>
          <div className="fma-dock-bar">
            <strong>FMA</strong><span>{selectedFile.name}</span>
            <button type="button" className="fma-dock-action" onClick={() => clickFmaControl('btnThemeToggle')} title="FMA 테마 전환" aria-label="FMA 테마 전환">☀</button>
            <button type="button" className="fma-dock-action" onClick={() => clickFmaControl('btnSettings')} title="FMA 설정 열기" aria-label="FMA 설정 열기">⚙</button>
            <button type="button" onClick={onClose} title="FMA 닫기" aria-label="FMA 닫기">×</button>
          </div>
          <iframe ref={fmaFrameRef} src={FMA_URL} title="FMA 이미지 뷰어" className="fma-frame" />
        </aside>
      </>}
    </div>
  </section>;
}

function getImageMimeType(fileName) {
  const extension = String(fileName || '').toLowerCase().split('.').at(-1);
  return { avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif', jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' }[extension] || 'application/octet-stream';
}

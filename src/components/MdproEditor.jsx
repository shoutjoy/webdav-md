import { useEffect, useRef, useState } from 'react';
import PanelResizeHandles from './PanelResizeHandles.jsx';

const FMA_WIDTH_KEY = 'webdav-fma-panel-width';
const APP_BASE_URL = import.meta.env.BASE_URL;
const MDPRO_URL = `${APP_BASE_URL}mdpro/index.html?webdav=1&editor=cm6&ui=20260912-mobile-header-portal-2`;
const FMA_URL = `${APP_BASE_URL}mdpro/Apps/fmaviewer/index.html?embedded=1`;

export default function MdproEditor({ onReadJenaRecords, onSaveJenaRecord, onSaveSettingsMset, onLoadSettingsMset, onReadCredentialVault, onWriteCredentialVault, selectedFile, content, binaryContent, fmaImportBatch, loading, saving, explorerWidth, panelResizeEnabled, onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onClose, onToggleExplorer, onShowDocumentExplorer, onOpenExplorer, onOpenFolderExplorer, onOpenRecentWork, onRequestCreateFile, onOpenTocPopup, onThemeChange, autosaveEnabled }) {
  const mdproFrameRef = useRef(null);
  const mdproStageRef = useRef(null);
  const fmaFrameRef = useRef(null);
  const jenaReadRef = useRef(onReadJenaRecords);
  useEffect(() => { jenaReadRef.current = onReadJenaRecords; }, [onReadJenaRecords]);
  const jenaSaveRef = useRef(onSaveJenaRecord);
  useEffect(() => { jenaSaveRef.current = onSaveJenaRecord; }, [onSaveJenaRecord]);
  const settingsMsetRef = useRef({ save: onSaveSettingsMset, load: onLoadSettingsMset });
  useEffect(() => { settingsMsetRef.current = { save: onSaveSettingsMset, load: onLoadSettingsMset }; }, [onSaveSettingsMset, onLoadSettingsMset]);
  const credentialVaultRef = useRef({ read: onReadCredentialVault, write: onWriteCredentialVault });
  useEffect(() => { credentialVaultRef.current = { read: onReadCredentialVault, write: onWriteCredentialVault }; }, [onReadCredentialVault, onWriteCredentialVault]);
  const documentRef = useRef({ selectedFile, content, binaryContent, fmaImportBatch });
  const callbacksRef = useRef({ onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onToggleExplorer, onShowDocumentExplorer, onOpenExplorer, onOpenFolderExplorer, onOpenRecentWork, onRequestCreateFile, onOpenTocPopup, onThemeChange });
  const autosaveEnabledRef = useRef(autosaveEnabled);
  const autosaveTimerRef = useRef(null);
  const autosaveSequenceRef = useRef(0);
  const autosaveQueueRef = useRef(Promise.resolve());
  const [fmaWidth, setFmaWidth] = useState(() => {
    const saved = Number.parseFloat(localStorage.getItem(FMA_WIDTH_KEY));
    return Number.isFinite(saved) ? Math.min(78, Math.max(32, saved)) : 58;
  });

  useEffect(() => { documentRef.current = { selectedFile, content, binaryContent, fmaImportBatch }; }, [selectedFile, content, binaryContent, fmaImportBatch]);
  useEffect(() => {
    autosaveEnabledRef.current = autosaveEnabled;
    if (!autosaveEnabled && autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, [autosaveEnabled]);
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    autosaveSequenceRef.current += 1;
  }, [selectedFile?.remotePath]);
  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);
  useEffect(() => {
    callbacksRef.current = {
      onSave,
      onSaveAs,
      onDocumentChange,
      onSaveImageToFolder,
      onToggleExplorer,
      onShowDocumentExplorer,
      onOpenExplorer,
      onOpenFolderExplorer,
      onOpenRecentWork,
      onRequestCreateFile,
      onOpenTocPopup,
      onThemeChange,
    };
  }, [onSave, onSaveAs, onDocumentChange, onSaveImageToFolder, onToggleExplorer, onShowDocumentExplorer, onOpenExplorer, onOpenFolderExplorer, onOpenRecentWork, onRequestCreateFile, onOpenTocPopup, onThemeChange]);

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
    script.src = `${APP_BASE_URL}mdpro/js/webdav-host-bridge.js?v=20260912-save-and-close-1`;
    frameDocument.body.appendChild(script);
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      if (event.source === mdproFrameRef.current?.contentWindow) {
        if (event.origin === window.location.origin && event.data.type === 'jena-read-records' && typeof event.data.requestId === 'string') {
          const source = event.source;
          const requestId = event.data.requestId;
          Promise.resolve().then(() => jenaReadRef.current()).then(
            records => source.postMessage({ type: 'jena-read-result', requestId, ok: true, records }, window.location.origin),
            error => source.postMessage({ type: 'jena-read-result', requestId, ok: false, error: error.message }, window.location.origin),
          );
        }
        if (event.origin === window.location.origin && event.data.type === 'jena-save-record' && typeof event.data.requestId === 'string') {
          const source = event.source;
          const requestId = event.data.requestId;
          Promise.resolve().then(() => jenaSaveRef.current(event.data.record)).then(
            result => source.postMessage({ type: 'jena-save-result', requestId, ok: true, ...result }, window.location.origin),
            error => source.postMessage({ type: 'jena-save-result', requestId, ok: false, error: error.message }, window.location.origin),
          );
        }
        if (event.origin === window.location.origin && /^mdpro-settings-mset-(save|load)$/.test(event.data.type || '') && typeof event.data.requestId === 'string') {
          const source = event.source;
          const requestId = event.data.requestId;
          const isSave = event.data.type === 'mdpro-settings-mset-save';
          const operation = isSave
            ? () => settingsMsetRef.current.save(String(event.data.content ?? ''))
            : () => settingsMsetRef.current.load();
          Promise.resolve().then(operation).then(
            result => source.postMessage({ type: 'mdpro-settings-mset-result', requestId, ok: true, ...(isSave ? {} : { content: String(result ?? '') }) }, window.location.origin),
            error => source.postMessage({ type: 'mdpro-settings-mset-result', requestId, ok: false, error: error.message }, window.location.origin),
          );
        }
        if (event.origin === window.location.origin && /^mdpro-credential-vault-(read|write)$/.test(event.data.type || '') && typeof event.data.requestId === 'string') {
          const source = event.source;
          const requestId = event.data.requestId;
          const isWrite = event.data.type === 'mdpro-credential-vault-write';
          const operation = isWrite ? () => credentialVaultRef.current.write(event.data.envelope) : () => credentialVaultRef.current.read();
          Promise.resolve().then(operation).then(
            result => source.postMessage({ type: 'mdpro-credential-vault-result', requestId, ok: true, envelope: result || null }, window.location.origin),
            error => source.postMessage({ type: 'mdpro-credential-vault-result', requestId, ok: false, error: error.message }, window.location.origin),
          );
        }

        if (event.data.type === 'mdpro-ready') {
          const current = documentRef.current;
          if (current.selectedFile && current.selectedFile.viewMode !== 'fma') {
            mdproFrameRef.current.contentWindow.postMessage({ type: 'webdav-open-document', content: current.content, binaryContent: current.binaryContent, fileName: current.selectedFile.name, path: current.selectedFile.remotePath }, window.location.origin);
          }
        }
        if (event.data.type === 'webdav-save-document' || event.data.type === 'webdav-save-document-and-close') {
          if (event.data.path !== documentRef.current.selectedFile?.remotePath) return;
          Promise.resolve(callbacksRef.current.onSave(String(event.data.content ?? ''), event.data.path)).then((saved) => {
            if (!saved) return;
            mdproFrameRef.current?.contentWindow?.postMessage({ type: 'webdav-document-saved', path: event.data.path }, window.location.origin);
            if (event.data.type === 'webdav-save-document-and-close') {
              callbacksRef.current.onClose?.({ skipConfirm: true });
              callbacksRef.current.onShowDocumentExplorer?.();
            }
          });
        }
        if (event.data.type === 'webdav-save-document-as') callbacksRef.current.onSaveAs(String(event.data.content ?? ''), event.data.path);
        if (event.data.type === 'webdav-close-document') {
          callbacksRef.current.onClose?.({ skipConfirm: true });
        }
        if (event.data.type === 'webdav-document-changed') {
          const activePath = documentRef.current.selectedFile?.remotePath;
          if (!activePath || activePath === event.data.path) {
            callbacksRef.current.onDocumentChange?.(String(event.data.content ?? ''), Boolean(event.data.dirty));
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            if (autosaveEnabledRef.current && event.data.dirty && activePath) {
              const sequence = ++autosaveSequenceRef.current;
              const nextContent = String(event.data.content ?? '');
              const nextPath = activePath;
              autosaveTimerRef.current = setTimeout(() => {
                autosaveQueueRef.current = autosaveQueueRef.current.then(() => callbacksRef.current.onSave(nextContent, nextPath, { autosave: true }));
                autosaveQueueRef.current.then((saved) => {
                  if (saved && sequence === autosaveSequenceRef.current) {
                    mdproFrameRef.current?.contentWindow?.postMessage({ type: 'webdav-document-saved', path: nextPath }, window.location.origin);
                  }
                });
              }, 1500);
            }
          }
        }
        if (event.data.type === 'webdav-document-opened' && event.data.applied !== true) {
          console.error(`MDPRO가 WebDAV 문서를 적용하지 못했습니다: ${event.data.path || ''}`);
        }
        if (event.data.type === 'mdpro-open-toc-popup') callbacksRef.current.onOpenTocPopup?.(String(event.data.content ?? ''));
        if (event.data.type === 'webdav-toggle-explorer') callbacksRef.current.onToggleExplorer();
        if (event.origin === window.location.origin && event.data.type === 'webdav-open-recent-work') callbacksRef.current.onOpenRecentWork?.();
        if (event.origin === window.location.origin && event.data.type === 'webdav-create-new-file') callbacksRef.current.onRequestCreateFile?.();
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
  const stagePath = String(selectedFile?.remotePath || '');
  const stageTitle = selectedFile?.name || stagePath.split('/').filter(Boolean).at(-1) || 'WebDAV에서 문서를 선택하세요';
  const stageDirectory = stagePath && stagePath.endsWith(stageTitle)
    ? stagePath.slice(0, -stageTitle.length)
    : '';
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

  return <section ref={mdproStageRef} className="mdpro-stage" style={{ flexBasis: `${100 - explorerWidth}%` }}>
    {panelResizeEnabled && <PanelResizeHandles edges={['top', 'bottom', 'left', 'right', 'bottom-right']}/>}
    <div className="mdpro-stage-bar" title="2초간 누른 뒤 드래그하여 MDPRO 창 이동 · 더블클릭으로 원위치"><span className="mdpro-stage-dot"/><strong>MDPRO</strong><span className="mdpro-stage-path" title={stagePath || stageTitle}>{stageDirectory && <span className="mdpro-stage-directory">{stageDirectory}</span>}<span className="mdpro-stage-title">{stageTitle}</span></span>{isFmaOpen && <button type="button" onClick={onClose}>FMA 닫기</button>}</div>
    {loading && !saving && <div className="mdpro-loading">WebDAV 파일을 여는 중…</div>}
    {saving && <div className="mdpro-saving" role="status" aria-live="polite"><span>WebDAV에 저장합니다.</span></div>}
    <div className="mdpro-workspace">
      <iframe key={MDPRO_URL} ref={mdproFrameRef} src={MDPRO_URL} onLoad={attachWebdavBridge} title="MDPRO 문서 편집기" className="mdpro-frame" />
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

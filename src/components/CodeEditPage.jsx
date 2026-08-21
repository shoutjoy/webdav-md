import { useEffect, useReducer, useRef, useState } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import { Save, X, Copy, Eye, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

function MarkdownPreview({ content, zoomLevel }) {
  const html = md.render(content || '');
  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        transform: `scale(${zoomLevel})`,
        transformOrigin: 'top left',
      }}
    />
  );
}


function MediaPreview({ url, type, fileName, zoomLevel }) {
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        미리보기를 준비하는 중...
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="flex h-full items-center justify-center overflow-auto bg-gray-100 p-4">
        <img
          src={url}
          alt={fileName}
          className="max-h-full max-w-full h-full w-full object-contain"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center',
          }}
        />
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-gray-50 p-6">
        <p className="max-w-full truncate text-sm text-gray-600">{fileName}</p>
        <audio key={url} src={url} controls className="w-full max-w-xl" />
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="flex h-full items-center justify-center bg-black p-4">
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center',
          }}
        >
          <video key={url} src={url} controls playsInline className="max-h-full max-w-full w-full h-full" />
        </div>
      </div>
    );
  }

  if (type === 'pdf') {
    return (
      <iframe
        key={url}
        src={url}
        title={fileName}
        className="h-full w-full border-0 bg-gray-100"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      이 파일은 미리볼 수 없습니다.
    </div>
  );
}

function zoomReducer(state, action) {
  switch (action.type) {
    case 'INCREMENT':
      return Math.min(3, state + 0.1);
    case 'DECREMENT':
      return Math.max(0.5, state - 0.1);
    case 'RESET':
      return 1;
    default:
      return state;
  }
}

export default function CodeEditPage({
  selectedFile,
  editorContent,
  editorLoading,
  hasEditorChanges,
  explorerWidth,
  mediaPreviewUrl,
  mediaPreviewType,
  onContentChange,
  onCopy,
  onSave,
  onClose,
}) {
  const editorContainerRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const [markdownPreviewPath, setMarkdownPreviewPath] = useState('');
  const [zoomLevel, dispatch] = useReducer(zoomReducer, 1);

  const isMediaView = selectedFile?.viewMode === 'media';
  const isMarkdownFile = !isMediaView && /\.md$/i.test(selectedFile?.remotePath || '');
  const isMarkdownView = isMarkdownFile && markdownPreviewPath === selectedFile?.remotePath;

  // Reset zoom level when selected file or view mode changes
  useEffect(() => {
    dispatch({ type: 'RESET' });
  }, [selectedFile?.remotePath, isMediaView]);

  useEffect(() => {
    if (isMediaView || !selectedFile || !editorContainerRef.current) return;

    editorContainerRef.current.innerHTML = '';
    const editor = CodeMirror(editorContainerRef.current, {
      value: editorContent,
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      extraKeys: {
        'Ctrl-S': () => onSave(),
        'Cmd-S': () => onSave(),
      },
    });

    editor.setSize('100%', '100%');
    editor.on('change', (instance) => {
      onContentChange(instance.getValue());
    });
    codeMirrorRef.current = editor;

    setTimeout(() => editor.refresh(), 0);
    return () => {
      codeMirrorRef.current = null;
    };
  }, [selectedFile?.remotePath, isMediaView]);

  useEffect(() => {
    const editor = codeMirrorRef.current;
    if (editor && editor.getValue() !== editorContent) {
      editor.setValue(editorContent);
    }
  }, [editorContent]);

  useEffect(() => {
    if (isMarkdownView) return;
    const editor = codeMirrorRef.current;
    if (!editor) return;
    setTimeout(() => editor.refresh(), 0);
  }, [isMarkdownView]);

  // Handle Ctrl + Wheel zoom for editor and preview
  useEffect(() => {
    const contentDiv = editorContainerRef.current;
    if (!contentDiv) return;

    const handleWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      
      if (e.deltaY < 0) {
        dispatch({ type: 'INCREMENT' });
      } else {
        dispatch({ type: 'DECREMENT' });
      }
    };

    contentDiv.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentDiv.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Handle Ctrl + Wheel zoom for markdown preview
  useEffect(() => {
    const markdownPreview = document.querySelector('.markdown-preview');
    if (!markdownPreview) return;

    const handleWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      
      if (e.deltaY < 0) {
        dispatch({ type: 'INCREMENT' });
      } else {
        dispatch({ type: 'DECREMENT' });
      }
    };

    markdownPreview.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      markdownPreview.removeEventListener('wheel', handleWheel);
    };
  }, [isMarkdownView]);

  const handleZoomIn = () => dispatch({ type: 'INCREMENT' });
  const handleZoomOut = () => dispatch({ type: 'DECREMENT' });
  const handleZoomReset = () => dispatch({ type: 'RESET' });

  // Show zoom controls when in markdown preview or media view
  const showZoomControls = isMarkdownView || isMediaView;

  return (
    <div
      className="flex min-h-0 max-h-[calc(100vh-180px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ flexBasis: `${100 - explorerWidth}%` }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm text-gray-700">
            {hasEditorChanges && <span className="mr-1 font-bold text-red-600">*</span>}
            {selectedFile.remotePath}
          </div>
        </div>
        {isMarkdownFile && (
          <button
            onClick={() => {
              setMarkdownPreviewPath((path) =>
                path === selectedFile.remotePath ? '' : selectedFile.remotePath
              );
            }}
            className={`rounded p-1.5 ${
              isMarkdownView
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
            }`}
            title={isMarkdownView ? '편집' : '미리보기'}
          >
            {isMarkdownView ? <Pencil size={18} /> : <Eye size={18} />}
          </button>
        )}
        {!isMediaView && (
          <button
            onClick={onSave}
            disabled={editorLoading || !hasEditorChanges}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
            title="저장"
          >
            <Save size={18} />
          </button>
        )}
        {/* Zoom Controls - show in preview modes */}
        {showZoomControls && (
          <>
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
              title="축소"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="확대 비율 초기화"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
              title="확대"
            >
              <ZoomIn size={18} />
            </button>
          </>
        )}
        <button
          onClick={onClose}
          disabled={editorLoading}
          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
          title="닫기"
        >
          <X size={18} />
        </button>
        {!isMediaView && (
          <button
            onClick={onCopy}
            disabled={editorLoading}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
            title="파일 내용 복사"
          >
            <Copy size={18} />
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {editorLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-600">
            불러오는 중...
          </div>
        )}
        {isMediaView ? (
          <MediaPreview
            url={mediaPreviewUrl}
            type={mediaPreviewType}
            fileName={selectedFile.name}
            zoomLevel={zoomLevel}
          />
        ) : (
          <>
            <div
              ref={editorContainerRef}
              className={`h-full text-sm ${isMarkdownView ? 'hidden' : ''}`}
            />
            {isMarkdownView && <MarkdownPreview content={editorContent} zoomLevel={zoomLevel} />}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import { Save, X } from 'lucide-react';

export default function CodeEditPage({
  selectedFile,
  editorContent,
  editorLoading,
  hasEditorChanges,
  explorerWidth,
  onContentChange,
  onSave,
  onClose,
}) {
  const editorContainerRef = useRef(null);
  const codeMirrorRef = useRef(null);

  useEffect(() => {
    if (!selectedFile || !editorContainerRef.current) return;

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
  }, [selectedFile?.remotePath]);

  useEffect(() => {
    const editor = codeMirrorRef.current;
    if (editor && editor.getValue() !== editorContent) {
      editor.setValue(editorContent);
    }
  }, [editorContent]);

  return (
    <div
      className="flex min-h-0 max-h-[calc(100vh-180px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ flexBasis: `${100 - explorerWidth}%` }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm text-gray-700">{selectedFile.remotePath}</div>
          {hasEditorChanges && <div className="text-xs text-amber-600">저장되지 않은 변경사항</div>}
        </div>
        <button
          onClick={onSave}
          disabled={editorLoading || !hasEditorChanges}
          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-40"
          title="저장"
        >
          <Save size={18} />
        </button>
        <button
          onClick={onClose}
          disabled={editorLoading}
          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"
          title="닫기"
        >
          <X size={18} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {editorLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-600">
            불러오는 중...
          </div>
        )}
        <div ref={editorContainerRef} className="h-full text-sm" />
      </div>
    </div>
  );
}

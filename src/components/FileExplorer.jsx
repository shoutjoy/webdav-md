import { Upload } from 'lucide-react';
import FileExplorerItem from './FileExplorerItem.jsx';

export default function FileExplorer({
  files,
  loading,
  editorLoading,
  copiedKey,
  isDragging,
  selectedFile,
  explorerWidth,
  formatBytes,
  formatDate,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onOpenDirectory,
  onCopyUrl,
  onOpenFile,
  onDownload,
  onRename,
  onDelete,
}) {
  return (
    <div
      className="relative min-h-0 max-h-[calc(100vh-180px)] overflow-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-sm"
      style={selectedFile ? { flexBasis: `${explorerWidth}%` } : undefined}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90 border-2 border-dashed border-blue-400 pointer-events-none">
          <div className="text-blue-600 font-medium flex items-center gap-2">
            <Upload size={20} />
            파일/폴더를 여기에 놓으세요
          </div>
        </div>
      )}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-200">
            <th className="p-3 font-medium w-full">이름</th>
            <th className="p-3 font-medium whitespace-nowrap">크기</th>
            <th className="p-3 font-medium whitespace-nowrap">수정일</th>
            <th className="p-3 font-medium whitespace-nowrap text-right">작업</th>
          </tr>
        </thead>
        <tbody>
          {files.length === 0 && !loading && (
            <tr>
              <td colSpan="4" className="p-8 text-center text-gray-500">
                폴더가 비어있습니다.
              </td>
            </tr>
          )}
          {files.map((file, idx) => (
            <FileExplorerItem
              key={file.remotePath || idx}
              file={file}
              index={idx}
              loading={loading}
              editorLoading={editorLoading}
              copiedKey={copiedKey}
              formatBytes={formatBytes}
              formatDate={formatDate}
              onOpenDirectory={onOpenDirectory}
              onCopyUrl={onCopyUrl}
              onOpenFile={onOpenFile}
              onDownload={onDownload}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

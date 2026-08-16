import { Check, Copy, Download, Edit, Eye, File, Folder, Trash2, Upload } from 'lucide-react';

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
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition group">
              <td className="p-3">
                <div
                  className={`flex items-center ${file.isDirectory ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  onClick={() => {
                    if (file.isDirectory) onOpenDirectory(file);
                  }}
                >
                  {file.isDirectory ? (
                    <Folder size={18} className="text-blue-500 mr-2 shrink-0" fill="currentColor" opacity="0.2" />
                  ) : (
                    <File size={18} className="text-gray-400 mr-2 flex-shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
              </td>
              <td className="p-3 text-sm text-gray-500 whitespace-nowrap">
                {file.isDirectory ? '-' : formatBytes(file.size)}
              </td>
              <td className="p-3 text-sm text-gray-500 whitespace-nowrap">
                {formatDate(file.lastModified)}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onCopyUrl(file.remotePath, `item-${idx}`);
                    }}
                    disabled={loading}
                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="접속 URL 복사"
                  >
                    {copiedKey === `item-${idx}` ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                  {!file.isDirectory && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenFile(file);
                      }}
                      disabled={loading || editorLoading}
                      className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50"
                      title="열기"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  {!file.isDirectory && (
                    <button
                      onClick={() => onDownload(file.name)}
                      disabled={loading}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="다운로드"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => onRename(file.name)}
                    disabled={loading}
                    className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                    title="이름 변경"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(file.name)}
                    disabled={loading}
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

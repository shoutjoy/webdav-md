import { Check, Copy, Download, Edit, Eye, File, Folder, Trash2 } from 'lucide-react';

export default function FileExplorerItem({
  file,
  index,
  loading,
  editorLoading,
  copiedKey,
  formatBytes,
  formatDate,
  onOpenDirectory,
  onCopyUrl,
  onOpenFile,
  onDownload,
  onRename,
  onDelete,
}) {
  return (
    <tr className="group border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/80">
      <td className="p-3">
        <div
          className={`flex items-center ${file.isDirectory ? 'cursor-pointer hover:text-amber-600' : 'cursor-pointer hover:text-blue-600'}`}
          onClick={() => {
            if (file.isDirectory) onOpenDirectory(file);
          }}
        >
          {file.isDirectory ? (
            <Folder size={18} className="text-blue-500 mr-2 shrink-0" fill="currentColor" opacity="0.2" />
          ) : (
            <File size={18} className="mr-2 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          )}
          {
            file.isDirectory ? (
              <span className="truncate">{file.name}</span>
            ) : (
              <span className="truncate " 
              
                title="File 코드에디터로 열기"
                onClick={(event)=>{
                  event.stopPropagation();
                  onOpenFile(file);
                }}
              >{file.name}</span>
            )
          }
        </div>
      </td>
      <td className="p-3 text-sm text-slate-500 whitespace-nowrap dark:text-slate-400">
        {file.isDirectory ? '-' : formatBytes(file.size)}
      </td>
      <td className="p-3 text-sm text-slate-500 whitespace-nowrap dark:text-slate-400">
        {formatDate(file.lastModified)}
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCopyUrl(file.remotePath, `item-${index}`);
            }}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="접속 URL 복사"
          >
            {copiedKey === `item-${index}` ? (
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
            onClick={(event) => {
              event.stopPropagation();
              onDelete(file);
            }}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
            title="삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

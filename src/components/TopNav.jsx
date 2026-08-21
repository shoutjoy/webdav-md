import { AlertCircle, ArrowLeft, Check, Copy, FilePlus, LogOut, RefreshCw, Upload } from 'lucide-react';

export default function TopNav({
  currentPath,
  publicUrl,
  loading,
  error,
  copiedKey,
  fileInputRef,
  onGoBack,
  onUpload,
  onNewFile,
  onRefresh,
  onCopyFolderUrl,
  onDisconnect,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 p-4 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center flex-1 w-full">
          <button
            onClick={onGoBack}
            disabled={currentPath === '/' || loading}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 mr-2"
            title="상위 폴더로"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="font-mono text-sm bg-gray-100 px-3 py-1.5 rounded-md text-gray-700 truncate flex-1">
            {currentPath}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input type="file" ref={fileInputRef} onChange={onUpload} className="hidden" multiple />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Upload size={16} className="mr-1.5" /> 업로드
          </button>
          <button
            onClick={onNewFile}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
            title="새 파일 만들기"
          >
            <FilePlus size={18} />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onDisconnect}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md ml-2"
            title="연결 종료"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 px-4 py-2 bg-gray-50 flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">접속 URL</span>
        <div className="font-mono text-sm text-gray-700 truncate flex-1 min-w-0">{publicUrl}</div>
        <button
          onClick={onCopyFolderUrl}
          disabled={loading}
          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md shrink-0 disabled:opacity-50 transition"
          title="접속 URL 복사"
        >
          {copiedKey === 'folder' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm border-b border-red-100 flex items-center">
          <AlertCircle size={16} className="mr-2" /> {error}
        </div>
      )}
    </div>
  );
}

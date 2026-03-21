import React, { useState, useRef } from 'react';
import { createClient } from 'webdav';
import { 
  Folder, File, Download, Trash2, Edit, Upload, 
  LogOut, RefreshCw, ArrowLeft, AlertCircle 
} from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isConnected, setIsConnected] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const clientRef = useRef(null);

  const joinRemotePath = (dirPath, name) =>
    dirPath === '/' ? `/${name}` : `${dirPath.replace(/\/$/, '')}/${name}`;

  /** 401이면 연결 정보(url·계정)는 유지한 채 로그인 화면으로 복귀 */
  const returnToLoginIfUnauthorized = (err) => {
    if (err?.status !== 401) return false;
    clientRef.current = null;
    setIsConnected(false);
    setFiles([]);
    setCurrentPath('/');
    setError('인증이 필요합니다(401). 비밀번호를 확인한 뒤 다시 접속해 주세요.');
    return true;
  };

  // 연결 및 루트 디렉토리 읽기
  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const baseUrl = url.trim().replace(/\/$/, '');
      clientRef.current = createClient(baseUrl, { username, password });
      const listed = await loadDirectory('/');
      if (listed) {
        setIsConnected(true);
      } else {
        clientRef.current = null;
      }
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        clientRef.current = null;
        setError(`연결 실패: ${err.message}. CORS 설정이나 인증 정보를 확인하세요.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 특정 디렉토리 읽기
  const loadDirectory = async (path) => {
    const client = clientRef.current;
    if (!client) {
      setError('클라이언트가 초기화되지 않았습니다.');
      return false;
    }

    setLoading(true);
    setError('');
    try {
      const items = await client.getDirectoryContents(path);
      const newFiles = items
        .map((item) => ({
          name: item.basename,
          isDirectory: item.type === 'directory',
          size: item.size ?? 0,
          lastModified: item.lastmod ? new Date(item.lastmod) : null,
        }))
        .sort((a, b) => {
          if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
          return a.isDirectory ? -1 : 1;
        });
      setFiles(newFiles);
      setCurrentPath(path);
      return true;
    } catch (err) {
      if (returnToLoginIfUnauthorized(err)) return false;
      setError(`목록 불러오기 실패: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 파일 다운로드
  const handleDownload = async (fileName) => {
    const client = clientRef.current;
    if (!client) return;

    try {
      setLoading(true);
      const filePath = joinRemotePath(currentPath, fileName);
      const data = await client.getFileContents(filePath);
      const blob = new Blob([data], { type: 'application/octet-stream' });
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`다운로드 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일 업로드
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      const filePath = joinRemotePath(currentPath, file.name);
      const body = await file.arrayBuffer();
      await client.putFileContents(filePath, body, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`업로드 실패: ${err.message} (서버의 CORS 설정에서 PUT 허용 여부를 확인하세요)`);
      }
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 파일 삭제
  const handleDelete = async (fileName) => {
    if (!window.confirm(`'${fileName}'을(를) 정말 삭제하시겠습니까?`)) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      await client.deleteFile(joinRemotePath(currentPath, fileName));
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`삭제 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 파일 이름 변경
  const handleRename = async (oldName) => {
    const newName = window.prompt('새 이름을 입력하세요:', oldName);
    if (!newName || newName === oldName) return;

    const client = clientRef.current;
    if (!client) return;

    setLoading(true);
    setError('');
    try {
      const oldPath = joinRemotePath(currentPath, oldName);
      const newPath = joinRemotePath(currentPath, newName);
      await client.moveFile(oldPath, newPath);
      await loadDirectory(currentPath);
    } catch (err) {
      if (!returnToLoginIfUnauthorized(err)) {
        setError(`이름 변경 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 상위 폴더로 이동
  const goUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    loadDirectory(newPath);
  };

  // 파일 크기 포맷터
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 날짜 포맷터
  const formatDate = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  // 로그인 화면 렌더링
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
          <div className="flex items-center justify-center mb-6 text-blue-600">
            <Folder size={40} className="mr-2" />
            <h1 className="text-2xl font-bold">WebDAV 접속</h1>
          </div>
          
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">서버 URL</label>
              <input 
                type="url" required
                placeholder="https://example.com/webdav"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={url} onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
              <input 
                type="text" required
                placeholder="Username"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={username} onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input 
                type="password" required
                placeholder="Password"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-start">
                <AlertCircle size={16} className="mr-1.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <button 
              type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '연결 중...' : '접속하기'}
            </button>
          </form>
          
          <p className="text-xs text-gray-500 mt-4 text-center">
            * 브라우저에서 접근하려면 서버에 CORS 설정이 필요합니다.
          </p>
        </div>
      </div>
    );
  }

  // 메인 파일 매니저 렌더링
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* 헤더 / 툴바 */}
        <div className="border-b border-gray-200 p-4 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center flex-1 w-full">
            <button 
              onClick={goUp} disabled={currentPath === '/' || loading}
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
            <input 
              type="file" ref={fileInputRef} onChange={handleUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} disabled={loading}
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Upload size={16} className="mr-1.5" /> 업로드
            </button>
            <button 
              onClick={() => loadDirectory(currentPath)} disabled={loading}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={() => {
                clientRef.current = null;
                setIsConnected(false);
              }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md ml-2"
              title="연결 종료"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm border-b border-red-100 flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        {/* 파일 목록 */}
        <div className="overflow-x-auto">
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
                        if (file.isDirectory) {
                          const nextPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
                          loadDirectory(nextPath);
                        }
                      }}
                    >
                      {file.isDirectory ? 
                        <Folder size={18} className="text-blue-500 mr-2 shrink-0" fill="currentColor" opacity="0.2" /> : 
                        <File size={18} className="text-gray-400 mr-2 flex-shrink-0" />
                      }
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
                      {!file.isDirectory && (
                        <button 
                          onClick={() => handleDownload(file.name)} disabled={loading}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="다운로드"
                        >
                          <Download size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleRename(file.name)} disabled={loading}
                        className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded" title="이름 변경"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(file.name)} disabled={loading}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded" title="삭제"
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
      </div>
    </div>
  );
}
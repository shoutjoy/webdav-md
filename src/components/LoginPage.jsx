import { useState } from 'react';
import { AlertCircle, Folder, Moon, Sun } from 'lucide-react';

const LOGIN_THEME_KEY = 'webdav-login-theme';

export default function LoginPage({
  url,
  username,
  password,
  saveLoginInfo,
  loading,
  error,
  onUrlChange,
  onUsernameChange,
  onPasswordChange,
  onSaveLoginInfoChange,
  onSubmit,
}) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(LOGIN_THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem(LOGIN_THEME_KEY, nextTheme);
    } catch {
      // Keep the toggle usable when browser storage is unavailable.
    }
  };

  return (
    <div className="login-screen flex items-center justify-center p-4" data-theme={theme}>
      <div className="login-card rounded-xl w-full max-w-md p-6">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            className="login-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            <span>{theme === 'dark' ? '라이트' : '다크'}</span>
          </button>
        </div>
        <div className="flex items-center justify-center mb-6 text-blue-600">
          <Folder size={40} className="mr-2" />
          <h1 className="text-2xl font-bold">WebDAV 접속</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">서버 URL</label>
            <input
              type="url"
              required
              placeholder="https://example.com/webdav"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
            <input
              type="text"
              required
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              required
              placeholder="Password"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-slate-200 py-1 transition-all">
            <input
              type="checkbox"
              checked={saveLoginInfo}
              onChange={(event) => onSaveLoginInfoChange(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>로그인 정보 저장</span>
          </label>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-start">
              <AlertCircle size={16} className="mr-1.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '연결 중...' : '접속하기'}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          * 로컬 실행 시 CORS와 NAS 인증서 문제를 앱의 보안 프록시가 처리합니다.
        </p>
      </div>
    </div>
  );
}

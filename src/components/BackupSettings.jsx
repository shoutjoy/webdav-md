import { useEffect, useState } from 'react';
import { ArchiveRestore, Clock3, History, LoaderCircle, Play, Save } from 'lucide-react';

const API_PATH = '/api/webdav-backups';

export default function BackupSettings({ credentials }) {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('02:00');
  const [busy, setBusy] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('shoutjoy1@gmail.com');
  const [emailServiceConfigured, setEmailServiceConfigured] = useState(false);
  const [retentionCount, setRetentionCount] = useState(30);

  const load = async () => {
    try {
      const response = await fetch(`${API_PATH}/config`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEnabled(result.enabled);
      setTime(result.time || '02:00');
      setRunning(result.running);
      setNotificationEmail(result.notificationEmail || 'shoutjoy1@gmail.com');
      setEmailServiceConfigured(result.emailServiceConfigured);
      setRetentionCount(result.retentionCount || 30);
    } catch (error) {
      setMessage(error.message || '백업 설정을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${API_PATH}/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, time, retentionCount, notificationEmail, webdavUrl: credentials.url, username: credentials.username, password: credentials.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage('백업 설정을 저장했습니다.');
    } catch (error) {
      setMessage(error.message || '백업 설정을 저장하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const runNow = async () => {
    setBusy(true);
    setRunning(true);
    setMessage('전체 WebDAV를 ZIP으로 백업하는 중입니다…');
    try {
      const response = await fetch(`${API_PATH}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webdavUrl: credentials.url, username: credentials.username, password: credentials.password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(`${result.fileCount}개 파일 백업을 완료했습니다.`);
    } catch (error) {
      setMessage(error.message || '백업에 실패했습니다.');
    } finally { setBusy(false); setRunning(false); }
  };

  const openHistory = () => window.open(new URL('backup-history.html', document.baseURI).href, 'webdav-backup-history', 'width=920,height=720,resizable=yes,scrollbars=yes');

  return <section className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700" aria-label="자동 백업 설정">
    <div className="flex items-center gap-2"><ArchiveRestore size={17} className="text-indigo-500"/><span className="text-sm font-medium">전체 자동 백업</span></div>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">매일 지정한 시간에 WebDAV 전체를 ZIP 파일로 안전하게 보관합니다.</p>
    <label className="mt-3 flex items-center justify-between gap-3 text-sm">
      <span>매일 자동 백업</span>
      <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={busy} className="h-4 w-4 accent-indigo-600"/>
    </label>
    <label className="mt-3 flex items-center gap-3 text-sm">
      <span className="shrink-0">자동 백업 보관 개수</span>
      <input type="number" min="1" max="9999" step="1" value={retentionCount} onChange={event => setRetentionCount(Math.max(1, Number(event.target.value) || 1))} disabled={busy} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600"/>
      <span className="text-xs text-slate-500">개</span>
    </label>
    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">한도를 넘으면 새 자동 백업을 저장한 후 가장 오래된 자동 백업부터 삭제합니다. 수동 백업은 유지됩니다.</p>
    <label className="mt-3 block text-sm">
      <span className="block">완료 알림 이메일</span>
      <input type="email" value={notificationEmail} onChange={event => setNotificationEmail(event.target.value)} disabled={busy} className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600"/>
    </label>
    {!emailServiceConfigured && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-300">메일 서버 설정이 필요합니다: RESEND_API_KEY, WEBDAV_BACKUP_FROM_EMAIL</p>}
    <label className="mt-3 flex items-center gap-3 text-sm">
      <Clock3 size={16} className="text-slate-400"/><span className="shrink-0">백업 시간</span>
      <input type="time" value={time} onChange={event => setTime(event.target.value)} disabled={busy} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600"/>
    </label>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <button type="button" onClick={save} disabled={busy} className="flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={14}/>저장</button>
      <button type="button" onClick={runNow} disabled={busy || running} className="flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800">{running ? <LoaderCircle size={14} className="animate-spin"/> : <Play size={14}/>}지금 백업</button>
      <button type="button" onClick={openHistory} className="flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"><History size={14}/>백업 이력</button>
    </div>
    {message && <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-300" role="status">{message}</p>}
  </section>;
}

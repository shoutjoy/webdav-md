import { useEffect, useState } from 'react';

export default function SystemUsage() {
  const [usage, setUsage] = useState({});
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (cleaning || !message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [cleaning, message]);
  async function cleanMemory() {
    if (cleaning) return;
    setCleaning(true);
    setMessage('RAM 정리 중…');
    try {
      const response = await fetch('/api/system-memory-cleanup', { method: 'POST', headers: { 'X-Memory-Cleanup': '1' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Windows 로컬 서버에서 사용할 수 있습니다.');
      setUsage(current => ({ ...current, ram: data.ram }));
      setMessage(`${data.processed}개 프로세스 정리 · 가용 RAM ${data.releasedMB} MB 증가 (사용에 따라 다시 늘어날 수 있음)`);
    } catch (error) { setMessage(error.message || 'RAM 정리에 실패했습니다.'); }
    finally { setCleaning(false); }
  }
  useEffect(() => {
    let stopped = false;
    let timer;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/system-usage', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        if (!stopped) setUsage(data);
      } catch { if (!stopped) setUsage({}); }
      if (!stopped) timer = setTimeout(refresh, 3000);
    }
    refresh();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, []);
  return <span className="system-usage" aria-label="시스템 사용률" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {['cpu', 'ram', 'npu', 'gpu'].map(key => {
      const value = usage[key];
      const available = typeof value === 'number' && Number.isFinite(value);
      return <span key={key} title={available ? `${key.toUpperCase()} 시스템 사용률 (로컬 서버)` : `${key.toUpperCase()} 측정 불가 · 로컬 서버 또는 장치 성능 카운터 필요`}>
        {key.toUpperCase()} <b>{available ? `${Math.round(Math.max(0, Math.min(100, value)))}%` : '—'}</b>
      </span>;
    })}
    <button type="button" className="system-memory-cleanup" onClick={cleanMemory} disabled={cleaning} title="현재 Windows 세션의 프로세스 작업 메모리 회수 · 프로그램과 문서는 유지되며 사용 시 메모리가 다시 늘어날 수 있습니다.">{cleaning ? '정리 중…' : 'RAM 정리'}</button>
    {message && <span className="system-memory-result" role="status">{message}</span>}
  </span>;
}

import { useEffect, useState } from 'react';

export default function SystemUsage() {
  const [usage, setUsage] = useState({});
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
  </span>;
}

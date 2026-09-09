import { useEffect, useRef, useState } from 'react';
import { MAX_RECENT_WORK_ITEMS, readRecentWorkVisibleCount, RECENT_WORK_VISIBLE_COUNT_KEY } from '../recentWork.js';

const MIN_VISIBLE_COUNT = 1;

export default function RecentWorkDialog({ items, busy, error, onOpen, onClose }) {
  const ref = useRef(null);
  const [visibleCount, setVisibleCount] = useState(() => readRecentWorkVisibleCount(localStorage));
  const changeVisibleCount = (amount) => {
    setVisibleCount(current => {
      const next = Math.min(MAX_RECENT_WORK_ITEMS, Math.max(MIN_VISIBLE_COUNT, current + amount));
      localStorage.setItem(RECENT_WORK_VISIBLE_COUNT_KEY, String(next));
      return next;
    });
  };
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return <dialog ref={ref} className="recent-work-dialog" aria-labelledby="recent-work-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="recent-work-title">최근 작업을 여시겠습니까?</h2>
    <p>이 브라우저에서 최근 작업한 파일을 최근 순으로 표시합니다. 선택하면 서버에 저장된 파일을 엽니다.</p>
    {error && <p role="alert">{error}</p>}
    <div className="recent-work-list">
      {items.slice(0, visibleCount).map(item => <button key={item.remotePath} disabled={busy} onClick={() => onOpen(item)}>
        <strong>{item.name}</strong>
        <span>{item.remotePath}</span>
        <small>{new Date(item.updatedAt).toLocaleString('ko-KR')}</small>
      </button>)}
      {!items.length && <p>아직 기록된 작업이 없습니다.</p>}
    </div>
    <div className="recent-work-footer">
      <div className="recent-work-count" aria-label="최근 작업 표시 개수">
        <span>표시 개수</span>
        <button type="button" disabled={busy || visibleCount <= MIN_VISIBLE_COUNT} onClick={() => changeVisibleCount(-1)} aria-label="표시 개수 줄이기">−</button>
        <output aria-live="polite">{visibleCount}개</output>
        <button type="button" disabled={busy || visibleCount >= MAX_RECENT_WORK_ITEMS} onClick={() => changeVisibleCount(1)} aria-label="표시 개수 늘리기">+</button>
      </div>
      <button className="recent-work-dismiss" disabled={busy} onClick={onClose}>{busy ? '파일을 여는 중…' : '나중에'}</button>
    </div>
  </dialog>;
}

import { useEffect, useRef } from 'react';

export default function RecentWorkDialog({ items, busy, error, onOpen, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="recent-work-dialog" aria-labelledby="recent-work-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="recent-work-title">최근 작업을 여시겠습니까?</h2>
    <p>이 브라우저에서 최근 작업한 파일 최대 5개입니다. 선택하면 서버에 저장된 파일을 엽니다.</p>
    {error && <p role="alert">{error}</p>}
    <div className="recent-work-list">
      {items.map(item => <button key={item.remotePath} disabled={busy} onClick={() => onOpen(item)}>
        <strong>{item.name}</strong>
        <span>{item.remotePath}</span>
        <small>{new Date(item.updatedAt).toLocaleString('ko-KR')}</small>
      </button>)}
      {!items.length && <p>아직 기록된 작업이 없습니다.</p>}
    </div>
    <button className="recent-work-dismiss" disabled={busy} onClick={onClose}>{busy ? '파일을 여는 중…' : '나중에'}</button>
  </dialog>;
}

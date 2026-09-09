import { useEffect, useMemo, useState } from 'react';
import MarkdownIt from 'markdown-it';
import { FileText, LockKeyhole } from 'lucide-react';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

export default function ShareViewer({ shareId }) {
  const [password, setPassword] = useState('');
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async (candidate = '') => {
    setLoading(true); setError('');
    try {
      const headers = candidate ? { 'X-Share-Password': candidate } : {};
      const metaResponse = await fetch(`/api/webdav-shares/${encodeURIComponent(shareId)}`, { headers });
      const meta = await metaResponse.json();
      if (!metaResponse.ok) { setNeedsPassword(metaResponse.status === 401); throw new Error(meta.error); }
      const contentResponse = await fetch(`/api/webdav-shares/${encodeURIComponent(shareId)}/content`, { headers });
      if (!contentResponse.ok) throw new Error((await contentResponse.json()).error);
      setDocument({ ...meta, content: await contentResponse.text() }); setNeedsPassword(false);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [shareId]);
  const rendered = useMemo(() => md.render(document?.content || ''), [document]);
  if (document) return <main className="share-viewer"><header><FileText size={22}/><span>{document.name}</span><small>{document.mode}</small></header><article className="share-markdown" dangerouslySetInnerHTML={{ __html: rendered }}/></main>;
  return <main className="share-gate"><form onSubmit={(e) => { e.preventDefault(); load(password); }}><LockKeyhole size={34}/><h1>공유 문서</h1>{loading ? <p>문서를 확인하는 중입니다…</p> : needsPassword ? <><p>파일 전용 비밀번호를 입력하세요.</p><input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="공유 비밀번호"/><button>문서 열기</button></> : <p className="share-error">{error}</p>}</form></main>;
}

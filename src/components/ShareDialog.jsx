import { useEffect, useState } from 'react';
import { Copy, LockKeyhole, Share2, X } from 'lucide-react';

export default function ShareDialog({ file, defaultPassword, busy, onCreate, onClose }) {
  const [mode, setMode] = useState('pwShare');
  const [sharePassword, setSharePassword] = useState(defaultPassword || '');
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setSharePassword(defaultPassword || ''), [defaultPassword, file]);
  if (!file) return null;
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { setResultUrl(await onCreate({ mode, sharePassword })); } catch (err) { setError(err.message); }
  };
  const copy = async () => { await navigator.clipboard.writeText(resultUrl); };
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2"><Share2 className="text-indigo-500" size={20}/><h2 id="share-dialog-title" className="min-w-0 flex-1 truncate font-bold">{file.name} 공유</h2><button type="button" onClick={onClose} aria-label="닫기"><X size={20}/></button></div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {['pwShare', 'openShare'].map((value) => <button key={value} type="button" onClick={() => { setMode(value); setResultUrl(''); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === value ? 'bg-white text-indigo-700 shadow dark:bg-slate-700 dark:text-indigo-200' : 'text-slate-500'}`}>{value}</button>)}
      </div>
      <p className="mt-2 text-xs text-slate-500">{mode === 'pwShare' ? '받는 사람이 이 파일 전용 비밀번호를 입력해야 합니다.' : '링크가 있는 사람은 비밀번호 없이 렌더링된 문서를 볼 수 있습니다.'}</p>
      {mode === 'pwShare' && <label className="mt-4 block text-sm font-medium">파일 공유 비밀번호<input autoFocus type="password" required value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600"/></label>}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      {resultUrl ? <div className="mt-4"><label className="text-xs font-semibold text-emerald-600">공유 링크 생성 완료</label><div className="mt-1 flex gap-2"><input readOnly value={resultUrl} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"/><button type="button" onClick={copy} className="rounded-lg bg-emerald-600 px-3 text-white" title="링크 복사"><Copy size={17}/></button></div></div> : <button disabled={busy || (mode === 'pwShare' && !sharePassword.trim())} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white disabled:opacity-50"><LockKeyhole size={17}/>{busy ? '생성 중…' : `${mode} 링크 만들기`}</button>}
    </form>
  </div>;
}

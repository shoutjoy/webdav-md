import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function RenameModal({ isOpen, currentName, onConfirm, onCancel, loading }) {
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef(null);

  useEffect(() => {
    setNewName(currentName);
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim() && newName !== currentName) {
      onConfirm(newName.trim());
    }
  };

  const handleCancel = () => {
    setNewName(currentName);
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] dark:bg-black/70">
      <div className="w-full max-w-sm rounded-xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-18px_rgba(15,23,42,0.55),0_8px_24px_-12px_rgba(15,23,42,0.28)] dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-[0_28px_80px_-18px_rgba(0,0,0,0.9),0_0_0_1px_rgba(148,163,184,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">파일명 변경</h2>
          <button
            onClick={handleCancel}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="파일명 변경 창 닫기"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
              현재 이름: <span className="text-gray-600 dark:text-slate-200">{currentName}</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 파일명을 입력하세요"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 caret-blue-600 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:caret-blue-400 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              disabled={loading || !newName.trim() || newName === currentName}
            >
              {loading ? '변경 중...' : '변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

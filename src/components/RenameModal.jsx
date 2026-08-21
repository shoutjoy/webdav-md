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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">파일명 변경</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 이름: <span className="text-gray-600">{currentName}</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 파일명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
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

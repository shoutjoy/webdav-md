import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECENT_WORK_AUTO_OPEN_KEY,
  setRecentWorkAutoOpen,
  shouldAutoOpenRecentWork,
} from '../src/recentWork.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
};

test('recent work opens automatically by default', () => {
  assert.equal(shouldAutoOpenRecentWork(createStorage()), true);
});

test('recent work auto-open preference persists in storage', () => {
  const storage = createStorage();

  setRecentWorkAutoOpen(storage, false);
  assert.equal(storage.getItem(RECENT_WORK_AUTO_OPEN_KEY), 'false');
  assert.equal(shouldAutoOpenRecentWork(storage), false);

  setRecentWorkAutoOpen(storage, true);
  assert.equal(shouldAutoOpenRecentWork(storage), true);
});

test('recent work dialog exposes the skip checkbox and connection honors the preference', () => {
  const dialogSource = readFileSync(new URL('../src/components/RecentWorkDialog.jsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(dialogSource, /type="checkbox"[^>]+checked=\{skipNextTime\}/);
  assert.match(dialogSource, /다음부터 자동으로 열지 않기/);
  assert.match(appSource, /setRecentOpen\(recent\.length > 0 && shouldAutoOpenRecentWork\(localStorage\)\)/);
});

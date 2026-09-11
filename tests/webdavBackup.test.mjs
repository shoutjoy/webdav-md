import test from 'node:test';
import assert from 'node:assert/strict';
import { __backupTest } from '../src/backupServer.js';

test('backup ZIP paths preserve hierarchy and replace Windows-invalid characters', () => {
  assert.equal(__backupTest.safeZipPath('/docs/보고서.md'), 'docs/보고서.md');
  assert.equal(__backupTest.safeZipPath('/folder/a:b?.txt'), 'folder/a_b_.txt');
});

test('backup worker limits concurrency and visits every item', async () => {
  let active = 0;
  let peak = 0;
  const visited = [];
  await __backupTest.mapLimit([1, 2, 3, 4, 5, 6], 2, async value => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    visited.push(value);
    active -= 1;
  });
  assert.ok(peak <= 2);
  assert.deepEqual(visited.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
});

test('automatic rotation removes only the oldest successful automatic backups', () => {
  const items = [
    { id: 'manual-old', trigger: 'manual', status: 'success', completedAt: '2026-01-01T00:00:00Z' },
    { id: 'auto-1', trigger: 'schedule', status: 'success', completedAt: '2026-01-01T00:00:00Z' },
    { id: 'auto-failed', trigger: 'schedule', status: 'failed', completedAt: '2026-01-04T00:00:00Z' },
    { id: 'auto-2', trigger: 'schedule', status: 'success', completedAt: '2026-01-02T00:00:00Z' },
    { id: 'auto-3', trigger: 'schedule', status: 'success', completedAt: '2026-01-03T00:00:00Z' },
  ];
  assert.deepEqual(__backupTest.expiredAutomaticBackups(items, 2).map(item => item.id), ['auto-1']);
});

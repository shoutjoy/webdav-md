import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebdavAutosave, normalizeAutosaveMinutes } from '../src/webdavAutosave.js';

function setup(save = async () => true) {
  const timers = new Map();
  const writes = [];
  const acknowledgments = [];
  let id = 0;
  const autosave = createWebdavAutosave({
    save: async (...args) => { writes.push(args); return save(...args); },
    onSaved: value => acknowledgments.push(value),
    setTimer: (run, delay) => { timers.set(++id, { run, delay }); return id; },
    clearTimer: key => timers.delete(key),
  });
  const fire = () => {
    const [key, timer] = timers.entries().next().value;
    timers.delete(key);
    return timer.run();
  };
  return { autosave, timers, writes, acknowledgments, fire };
}

test('defaults to enabled and ten minutes; continuous typing saves the latest text on time', async () => {
  const state = setup();
  state.autosave.update('first', '/a.md', true);
  const timerId = [...state.timers.keys()][0];
  state.autosave.update('latest', '/a.md', true);
  state.autosave.configure(true, 10);
  assert.equal([...state.timers.keys()][0], timerId);
  assert.equal([...state.timers.values()][0].delay, 600000);
  await state.fire();
  assert.deepEqual(state.writes, [['latest', '/a.md']]);
  assert.equal(state.timers.size, 0);
});

test('toggle and interval changes reschedule pending edits; clean documents do not save', async () => {
  const state = setup();
  state.autosave.update('edit', '/a.md', true);
  state.autosave.configure(false, 2);
  assert.equal(state.timers.size, 0);
  state.autosave.configure(true, 2);
  assert.equal([...state.timers.values()][0].delay, 120000);
  state.autosave.update('saved manually', '/a.md', false);
  assert.equal(state.timers.size, 0);
  assert.equal(state.writes.length, 0);
});

test('keeps edits made during a save and acknowledges only the saved snapshot', async () => {
  let finish;
  const state = setup(() => new Promise(resolve => { finish = resolve; }));
  state.autosave.update('snapshot', '/a.md', true);
  const running = state.fire();
  state.autosave.update('new edits', '/a.md', true);
  finish(true);
  await running;
  assert.deepEqual(state.acknowledgments, [{ content: 'snapshot', path: '/a.md' }]);
  assert.equal(state.timers.size, 1);
});

test('retries failures; cancel on document switch prevents stale acknowledgments and queued writes', async () => {
  const failed = setup(async () => false);
  failed.autosave.update('text', '/a.md', true);
  await failed.fire();
  assert.equal(failed.acknowledgments.length, 0);
  assert.equal(failed.timers.size, 1);
  failed.autosave.cancel();
  assert.equal(failed.timers.size, 0);

  let finish;
  const state = setup(() => new Promise(resolve => { finish = resolve; }));
  state.autosave.update('old', '/a.md', true);
  const running = state.fire();
  state.autosave.cancel();
  finish(true);
  await running;
  assert.equal(state.acknowledgments.length, 0);
  assert.equal(state.timers.size, 0);
});

test('normalizes missing or invalid intervals and bounds minute input', () => {
  for (const input of [null, '', 0, -1, 'bad']) assert.equal(normalizeAutosaveMinutes(input), 10);
  assert.equal(normalizeAutosaveMinutes(2.8), 2);
  assert.equal(normalizeAutosaveMinutes(9999), 1440);
});

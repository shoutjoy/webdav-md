import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function compatibleResidencyKey('), source.indexOf('async function fetchOpenAICompatibleModels('));
const connection = { baseUrl: 'http://localhost:13305/api/v1', apiKey: 'local' };

function harness(initial) {
  let rows = initial;
  const calls = [];
  const context = vm.createContext({ URL, readOpenAICompatibleError: async () => 'unsupported', fetch: async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, body });
    if (url.endsWith('/load')) rows = [{ model_name: body.model_name, pinned: body.pinned }];
    if (url.endsWith('/internal/pin')) rows = rows.map(row => row.model_name === body.model_name ? { ...row, pinned: body.pinned } : row);
    return { ok: true, json: async () => url.endsWith('/health') ? { all_models_loaded: rows } : { status: 'success' } };
  } });
  vm.runInContext(helpers, context);
  return { context, calls };
}

test('an already pinned model is reused without loading or pinning again', async () => {
  const { context, calls } = harness([{ model_name: 'gemma', pinned: true }]);
  await context.manageOpenAICompatibleResidency(connection, 'gemma', true);
  assert.ok(calls.every(call => call.url.endsWith('/health')));
});

test('a loaded model is pinned in place and release never unloads it', async () => {
  const { context, calls } = harness([{ model_name: 'gemma', pinned: false }]);
  await context.manageOpenAICompatibleResidency(connection, 'gemma', true);
  await context.manageOpenAICompatibleResidency(connection, 'gemma', false);
  assert.equal(calls.filter(call => call.url.endsWith('/internal/pin')).length, 2);
  assert.ok(calls.every(call => !/\/(load|unload)$/.test(call.url)));
});

test('an unloaded model loads once and later requests reuse it', async () => {
  const { context, calls } = harness([]);
  await context.manageOpenAICompatibleResidency(connection, 'gemma', true);
  await context.manageOpenAICompatibleResidency(connection, 'gemma', true);
  assert.equal(calls.filter(call => call.url.endsWith('/load')).length, 1);
});

test('generic compatible servers do not receive lifecycle mutations', async () => {
  const { context, calls } = harness(undefined);
  await assert.rejects(context.manageOpenAICompatibleResidency(connection, 'gemma', true), /지원하지 않습니다/);
  assert.equal(calls.length, 1);
});

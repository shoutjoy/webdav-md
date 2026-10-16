import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('mdpro/sidebarAI/sidebar-ai.js', 'utf8');
const refresh = source.slice(source.indexOf('  async function scholarAIRefreshConnection()'), source.indexOf("  document.addEventListener('change'", source.indexOf('  async function scholarAIRefreshConnection()')));

test('running Ollama with installed models connects and saves the initial selection', async () => {
  let model = '';
  const renders = [];
  const context = vm.createContext({
    scholarAIConnectionEpoch: 0,
    scholarAIGetProvider: () => 'ollama',
    invokeSync: (name, provider) => { assert.equal(provider, 'ollama'); return model; },
    getCallback: () => (value, provider) => { assert.equal(provider, 'ollama'); model = value; },
    scholarAIRenderConnection: (...args) => renders.push(args),
    window: { AIChatBridge: { refreshOllamaModels: async () => ['gemma4:e2b-gpu'] } }
  });
  vm.runInContext(refresh, context);
  await context.scholarAIRefreshConnection();
  assert.equal(model, 'gemma4:e2b-gpu');
  assert.deepEqual(renders.at(-1), ['ollama', model, 'connected']);
});

test('unreachable Ollama still reports a connection error', async () => {
  const renders = [];
  const context = vm.createContext({
    scholarAIConnectionEpoch: 0,
    scholarAIGetProvider: () => 'ollama', invokeSync: () => '',
    scholarAIRenderConnection: (...args) => renders.push(args),
    window: { AIChatBridge: { refreshOllamaModels: async () => { throw new Error('offline'); } } }
  });
  vm.runInContext(refresh, context);
  await context.scholarAIRefreshConnection();
  assert.deepEqual(renders.at(-1), ['ollama', '', 'error', 'offline']);
});

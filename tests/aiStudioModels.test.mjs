import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const chat = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
function section(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}
function runtime(fetch) {
  const context = vm.createContext({ fetch, getProtectedAiCredential: () => 'test-key' });
  vm.runInContext(`const aiChatGeminiModelLimits = Object.create(null);
    const AI_CHAT_GEMINI_DEFAULT_MODELS = ['gemini-2.5-flash'];
    const DEFAULT_GEMINI_MODELS = AI_CHAT_GEMINI_DEFAULT_MODELS;
    ${section(app, 'async function listAIStudioTextModels(', 'function getScholarAIProviderRuntime(')}
    ${section(app, 'function mergeAIChatGeminiModels(', 'function mergeAIChatDeepseekModels(')}
    ${section(chat, 'function mergeGeminiModels(', 'function updateModelModeUI(')}
  `, context);
  return context;
}
const model = (id, methods = ['generateContent']) => ({ name: 'models/' + id, supportedGenerationMethods: methods });

test('pagination preserves image, unfamiliar and non-chat models through both menus', async () => {
  const urls = [];
  const ctx = runtime(async url => {
    urls.push(new URL(url));
    return { ok: true, json: async () => urls.length === 1
      ? { models: [model('gemini-2.5-flash'), model('gemini-3-pro-image-preview')], nextPageToken: 'page+2' }
      : { models: [model('gemini-3-pro-image-preview'), model('gemma-new'), model('veo-new', ['predictLongRunning']), model('embedding-new', ['embedContent'])] } };
  });
  const result = Array.from(await ctx.listAIStudioModels('test-key'));
  assert.equal(urls.length, 2);
  assert.equal(urls[1].searchParams.get('pageToken'), 'page+2');
  assert.equal(result.length, 5);
  for (const id of ['gemini-3-pro-image-preview', 'gemma-new', 'veo-new', 'embedding-new']) assert.ok(result.includes(id));
  assert.deepEqual(Array.from(ctx.mergeGeminiModels(result)), result);
});

test('successful empty or image-only catalog never injects default text models', async () => {
  const ctx = runtime(async () => ({ ok: true, json: async () => ({ models: [model('gemini-2.5-flash-image')] }) }));
  assert.deepEqual(Array.from(await ctx.listAIStudioModels()), ['gemini-2.5-flash-image']);
  assert.deepEqual(Array.from(ctx.mergeGeminiModels([])), []);
  ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
  assert.deepEqual(Array.from(await ctx.listAIStudioModels()), []);
});

test('zero context token limits do not masquerade as account quotas', async () => {
  const ctx = runtime(async () => ({ ok: true, json: async () => ({ models: [{ ...model('imagen-new', ['predict']), inputTokenLimit: 0, outputTokenLimit: 0 }] }) }));
  assert.deepEqual(Array.from(await ctx.listAIStudioModels()), ['imagen-new']);
});

test('text-only consumers retain their own capability filter', async () => {
  const ctx = runtime(async () => ({ ok: true, json: async () => ({ models: [model('gemma-new'), model('gemini-2.5-flash-image'), model('embedding-new', ['embedContent'])] }) }));
  assert.deepEqual(Array.from(await ctx.listAIStudioTextModels()), ['gemma-new']);
});

test('failed later pages and repeated tokens fail instead of reporting incomplete success', async () => {
  let count = 0;
  const ctx = runtime(async () => ++count === 1
    ? { ok: true, json: async () => ({ models: [model('gemini-2.5-flash')], nextPageToken: 'next' }) }
    : { ok: false, status: 403, json: async () => ({ error: { message: 'denied' } }) });
  await assert.rejects(() => ctx.listAIStudioModels(), /denied/);
  ctx.fetch = async () => ({ ok: true, json: async () => ({ nextPageToken: 'repeated' }) });
  await assert.rejects(() => ctx.listAIStudioModels(), /토큰이 반복/);
});

test('settings renderer uses options, preserves selection and disables failed/empty catalogs', () => {
  const select = { value: 'gemini-2.5-flash-image', children: [],
    replaceChildren() { this.children = []; }, appendChild(option) { this.children.push(option); } };
  const badge = {};
  const ctx = vm.createContext({ document: {
    getElementById: id => id === 'settings-gemini-models-list' ? select : badge,
    createElement: tag => { assert.equal(tag, 'option'); return {}; }
  } });
  vm.runInContext(section(app, 'function renderSettingsGeminiModels(', 'function notifyAiToolSettingsChanged('), ctx);
  ctx.renderSettingsGeminiModels(['gemini-2.5-flash', 'gemini-2.5-flash-image']);
  assert.equal(select.children.length, 2);
  assert.equal(select.value, 'gemini-2.5-flash-image');
  assert.equal(select.disabled, false);
  assert.equal(badge.textContent, '2개');
  ctx.renderSettingsGeminiModels([], 'denied');
  assert.equal(select.disabled, true);
  assert.equal(select.children.length, 1);
  assert.equal(select.title, 'denied');
  ctx.renderSettingsGeminiModels([]);
  assert.equal(select.disabled, true);
  const html = fs.readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
  assert.match(html, /<select id="settings-gemini-models-list"/);
  assert.doesNotMatch(html, /<div id="settings-gemini-models-list"/);
});

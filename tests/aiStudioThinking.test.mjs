import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function callAIStudioChat(');
const fn = source.slice(start, source.indexOf('\nfunction insertAIChatTextIntoDocument(', start));

for (const [model, mode, expected] of [
  ['gemini-3.1-flash-lite', 'instant', 'minimal'],
  ['gemini-3.1-flash-lite-preview', 'instant', 'minimal'],
  ['gemini-3-flash-preview', 'instant', 'minimal'],
  ['gemini-3.1-pro-preview', 'instant', 'low'],
  ['gemini-3.1-flash-lite', 'reasoning', 'high'],
  ['gemini-2.5-flash', 'instant', 0],
  ['gemini-2.5-flash', 'reasoning', 4096]
]) {
  test(`${model} ${mode} sends compatible thinking policy and preserves output`, async () => {
    let payload;
    const context = vm.createContext({
      getAIStudioKeyForChat: async () => 'test-key',
      aiChatGeminiModelLimits: {},
      normalizeAIChatMessages: messages => messages.map(m => ({ ...m, attachments: [] })),
      isAIChatGeminiTtsModel: () => false,
      isAIChatGeminiImageModel: () => false,
      getAIChatGeminiModelLimits: async () => ({ inputTokenLimit: 1048576, outputTokenLimit: 65536 }),
      estimateAIChatTokens: () => 1,
      fetch: async (url, options) => {
        payload = JSON.parse(options.body);
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'answer' }] } }] }) };
      }
    });
    vm.runInContext(fn, context);
    const result = await context.callAIStudioChat([{ role: 'user', content: 'hello' }], 'system', model, undefined, mode);
    const config = payload.generationConfig;
    assert.equal(config.thinkingConfig.thinkingLevel ?? config.thinkingConfig.thinkingBudget, expected);
    assert.equal(config.maxOutputTokens, 65536);
    assert.equal(payload.contents[0].parts[0].text, 'hello');
    assert.equal(result.text, 'answer');
  });
}

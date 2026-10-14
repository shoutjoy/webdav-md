import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function fitOpenAICompatibleContext('), source.indexOf('async function fetchOpenAICompatibleModels('));
const budgetDependencies = {
    getOllamaSettings: () => ({}),
    normalizeOllamaGenerationSettings: () => ({ contextLength: 12800, temperature: 0.4 }),
    readOpenAICompatibleModelsCache: () => [{ id: 'gemma', context_length: 8192 }],
    getScholarAIProviderRuntime: () => ({ getLMStudioConfig: () => ({ quickMaxTokens: 1024 }) }),
    estimateAIChatTokens: content => String(content || '').length,
    retainAIChatHistory: (rows, budget) => budget > rows.reduce((sum, row) => sum + row.content.length * 1.5 + 16, 0) ? rows : []
};

test('context budget removes old turns without modifying history, system or newest question', () => {
    const context = vm.createContext({});
    vm.runInContext(helpers, context);
    const messages = [
        { role: 'system', content: 'instructions' },
        { role: 'user', content: 'old question' },
        { role: 'assistant', content: '한'.repeat(5000) },
        { role: 'user', content: 'latest question' }
    ];
    const fitted = context.fitOpenAICompatibleContext(messages, 1000);
    assert.deepEqual(Array.from(fitted), [messages[0], messages[3]]);
    assert.equal(messages.length, 4);
    assert.equal(context.fitOpenAICompatibleContext([messages[3]], 1)[0], messages[3]);
});

test('length errors retry with smaller context and output using the same connection', async () => {
    const requests = [];
    const context = vm.createContext({
        ...budgetDependencies,
        fetch: async (url, options) => {
            requests.push({ url, ...options, body: JSON.parse(options.body) });
            return { ok: true, json: async () => requests.length === 1
                ? { error: { message: 'Max length reached!' } }
                : { choices: [{ message: { content: 'OK' } }] } };
        }
    });
    vm.runInContext(helpers, context);
    const signal = {};
    await context.requestOpenAICompatibleChat({ baseUrl: 'http://localhost/v1', apiKey: 'local' }, 'gemma', [
        { role: 'user', content: 'old' }, { role: 'assistant', content: '한'.repeat(2500) },
        { role: 'user', content: 'latest' }
    ], signal);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.messages.length, 3);
    assert.equal(requests[1].body.messages.length, 1);
    assert.equal(requests[1].body.max_tokens, 512);
    assert.equal(requests[1].signal, signal);
    assert.equal(requests[0].url, requests[1].url);
    assert.equal(requests[0].body.temperature, 0.4);
    assert.equal(requests[1].body.temperature, 0.4);
});

test('authentication failures are not retried', async () => {
    let calls = 0;
    const context = vm.createContext({
        ...budgetDependencies,
        fetch: async () => { calls++; return { ok: false }; },
        readOpenAICompatibleError: async () => 'Unauthorized'
    });
    vm.runInContext(helpers, context);
    await assert.rejects(context.requestOpenAICompatibleChat({ baseUrl: 'local', apiKey: 'bad' }, 'model', [], undefined), /Unauthorized/);
    assert.equal(calls, 1);
});

test('retries reduce output and compact app instructions while preserving the current question', async () => {
    const requests = [];
    const system = 's'.repeat(650);
    const context = vm.createContext({
        ...budgetDependencies,
        readOpenAICompatibleModelsCache: () => [{ id: 'gemma', context_length: 2048 }],
        fetch: async (_url, options) => {
            const body = JSON.parse(options.body);
            requests.push(body);
            return { ok: true, json: async () => body.max_tokens > 100
                ? { error: { message: 'Max length reached!' } }
                : { choices: [{ message: { content: 'OK' } }] } };
        }
    });
    vm.runInContext(helpers, context);
    const messages = [{ role: 'user', content: 'short question' }];
    const result = await context.requestOpenAICompatibleChat({ baseUrl: 'local', apiKey: 'local' }, 'gemma', messages, system, {}, undefined);
    assert.equal(result.choices[0].message.content, 'OK');
    assert.ok(requests.length > 1);
    for (const body of requests) {
        const instructions = body.messages.find(message => message.role === 'system');
        if (instructions) assert.ok(instructions.content.length <= system.length);
        assert.equal(body.messages.at(-1).content, 'short question');
    }
    assert.ok(requests.at(-1).max_tokens <= 100);
});

test('flash models without context metadata use the configured 12800 budget', () => {
    const context = vm.createContext({ ...budgetDependencies, readOpenAICompatibleModelsCache: () => [] });
    vm.runInContext(helpers, context);
    for (const model of ['gemma4e-flash-e2b-FLM', 'gemma4e-flash-e4b-FLM']) {
        const budget = context.budgetOpenAICompatibleChat(model, [{ role: 'user', content: 'question' }], '', {});
        assert.equal(budget.contextLength, 12800);
        assert.ok(budget.inputTokens + budget.maxTokens < 12800);
    }
});

test('a smaller server context limit takes precedence over the configured default', () => {
    const context = vm.createContext({ ...budgetDependencies, readOpenAICompatibleModelsCache: () => [{ id: 'flash', context_length: 2048 }] });
    vm.runInContext(helpers, context);
    assert.equal(context.budgetOpenAICompatibleChat('flash', [{ role: 'user', content: 'question' }], '', {}).contextLength, 2048);
});

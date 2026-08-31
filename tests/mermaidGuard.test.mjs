import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-jena-mermaid-guard.js', import.meta.url), 'utf8'), context);
const guard = context.AIJenaMermaidGuard;
const fenced = code => '```mermaid\n' + code + '\n```\n';
const good = 'flowchart TD\nN1["입력"] --> N2["처리"]';
function harness(repair) {
  const calls = { parse: 0, load: 0, repair: 0 };
  const engine = { async parse(code) { calls.parse++; if (code.includes('BROKEN')) throw new Error('Parse error'); return {}; } };
  return { calls, options: { checkActive() {}, async loadEngine() { calls.load++; return engine; }, async repair(blocks) { calls.repair++; return repair(blocks); } } };
}
test('ordinary text incurs no engine load or AI call', async () => {
  const h = harness(() => { throw new Error('unexpected'); });
  assert.equal((await guard.guard('안녕하세요', h.options)).ok, true);
  assert.deepEqual(h.calls, { parse: 0, load: 0, repair: 0 });
});
test('valid Mermaid is unchanged and repeated validation uses bounded engine cache', async () => {
  const h = harness(() => { throw new Error('unexpected'); });
  assert.equal((await guard.guard(fenced(good), h.options)).text, fenced(good));
  await guard.guard(fenced(good), h.options);
  assert.equal(h.calls.parse, 1);
  assert.equal(h.calls.repair, 0);
});
test('all failed blocks repaired in one request, valid code and prose preserved', async () => {
  const h = harness(blocks => { assert.equal(blocks.length, 2); return fenced(good) + fenced(good); });
  const input = '앞\n' + fenced('BROKEN1') + '중간\n' + fenced(good) + fenced('BROKEN2') + '뒤';
  const result = await guard.guard(input, h.options);
  assert.equal(result.text, '앞\n' + fenced(good) + '중간\n' + fenced(good) + fenced(good) + '뒤');
  assert.equal(result.repaired, true);
  assert.equal(h.calls.repair, 1);
});
test('invalid repair preserves original without retry loops', async () => {
  const h = harness(() => fenced('BROKEN AGAIN'));
  const input = fenced('BROKEN');
  const result = await guard.guard(input, h.options);
  assert.equal(result.ok, false);
  assert.equal(result.text, input);
  assert.equal(h.calls.repair, 1);
});
test('missing repair blocks are rejected', async () => {
  const h = harness(() => '수정 완료');
  assert.equal((await guard.guard(fenced('BROKEN'), h.options)).ok, false);
});
test('unclosed fence is not accepted even if parser accepts its content', async () => {
  const h = harness(() => '');
  h.options.repair = null;
  assert.equal((await guard.guard('```mermaid\n' + good, h.options)).ok, false);
});
test('tilde CRLF fences and bare diagram are detected; nested example is ignored', () => {
  assert.equal(guard.blocks('~~~mermaid\r\n' + good + '\r\n~~~').length, 1);
  assert.equal(guard.blocks(good).length, 1);
  assert.equal(guard.blocks('````markdown\n' + fenced(good) + '````').length, 0);
});
test('insertion validation never calls AI and rejects invalid content', async () => {
  const h = harness(() => { throw new Error('unexpected'); });
  h.options.repair = null;
  assert.equal((await guard.guard(fenced('BROKEN'), h.options)).ok, false);
  assert.equal(h.calls.repair, 0);
});
test('cancellation during engine loading prevents repair', async () => {
  const h = harness(() => fenced(good));
  h.options.checkActive = () => { if (h.calls.load) throw new Error('AbortError'); };
  await assert.rejects(guard.guard(fenced('BROKEN'), h.options), /AbortError/);
  assert.equal(h.calls.repair, 0);
});
test('missing engine is an explicit failure', async () => {
  const h = harness(() => '');
  h.options.loadEngine = async () => undefined;
  await assert.rejects(guard.guard(fenced(good), h.options), /검증 엔진/);
});

const chatSource = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const insertionSource = chatSource.slice(chatSource.indexOf('  async function insertIntoCurrentDocument('), chatSource.indexOf('  function openAnswerPreviewWindow('));
test('chat integration refuses document mutation after failed validation', async () => {
  let writes = 0;
  const runtime = vm.createContext({
    snapshotEditorSelectionForInsert() {},
    getBridge: () => ({ insertIntoDocument() { writes++; } }),
    checkMermaidAnswer: async () => ({ ok: false, notice: '문법 오류' })
  });
  vm.runInContext(insertionSource, runtime);
  await assert.rejects(runtime.insertIntoCurrentDocument(fenced('BROKEN'), 'replace'), /문법 오류/);
  assert.equal(writes, 0);
});
test('chat integration rechecks target after async validation before editing', async () => {
  let writes = 0;
  const runtime = vm.createContext({
    snapshotEditorSelectionForInsert() {},
    getBridge: () => ({ captureInsertTarget: () => () => { throw new Error('대상 변경'); }, insertIntoDocument() { writes++; } }),
    checkMermaidAnswer: async () => ({ ok: true })
  });
  vm.runInContext(insertionSource, runtime);
  await assert.rejects(runtime.insertIntoCurrentDocument(fenced(good), 'cursor'), /대상 변경/);
  assert.equal(writes, 0);
});

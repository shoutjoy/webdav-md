import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const script = readFileSync('mdpro/sidebarAI/scholar-ai-upgrades.js', 'utf8');
function harness(source = '', call) {
  const elements = { 'scholar-ai-selected': { value: source } };
  const results = [];
  const context = { Set, JSON, specialRunning: false, specialRunEpoch: 0,
    el: id => elements[id], estimateTokens: text => Math.ceil(text.length / 3.2),
    alert: assert.fail, window: {},
    setRunning(running) { context.specialRunning = running; },
    applyResult(raw) { results.push(raw); },
    getCallback: name => name === 'callScholarAI' ? call : null };
  vm.createContext(context);
  vm.runInContext(script.slice(script.indexOf('  function protectedRanges('), script.indexOf('  function translationDirection()')), context);
  return { context, results };
}
function candidates(prompt) { return JSON.parse(prompt.split('후보 목록:\n')[1]); }
test('fast pass converts screenshot examples while preserving protected text', () => {
  const h = harness();
  const result = h.context.transformAcademicIda('중요합니다. 설명하겠습니다. `중요합니다.` $설명합니다$\n**필요합니다**. (있습니다)');
  assert.equal(result.text, '중요하다. 설명하겠다. `중요합니다.` $설명합니다$\n**필요하다**. (있다)');
  assert.equal(result.ambiguous.length, 0);
});
test('AI reviews local results and retries omitted or unchanged polite predicates', async () => {
  let calls = 0;
  const h = harness('중요합니다. 설명하겠습니다. 읽습니다.', async prompt => {
    calls++;
    const items = candidates(prompt).map(item => ({ ...item, to: item.from === '설명하겠습니다' ? '설명하겠다' : item.from === '읽습니다' && calls === 2 ? '읽는다' : item.from }));
    return { text: JSON.stringify({ items }) };
  });
  assert.equal(await h.context.rewriteAcademicIda(), '중요하다. 설명하겠다. 읽는다.');
  assert.equal(calls, 2);
  assert.match(h.results[0], /빠른 치환 완료/);
  assert.match(h.results.at(-1), /미변경 후보: 0개/);
});
test('invalid, duplicate and unchanged polite AI patches cannot corrupt offsets', () => {
  const h = harness();
  const items = h.context.collectAmbiguous('읽습니다.');
  const patches = h.context.parseTonePatches(JSON.stringify({items:[{id:0,from:'읽습니다',to:'읽습니다'},{id:0,from:'읽습니다',to:'읽는다'},{id:0,from:'읽습니다',to:'읽었다'},{id:0.5,from:'읽습니다',to:'읽는다'}]}), items);
  assert.equal(patches.length, 1);
  assert.equal(h.context.applyPatches('읽습니다.', patches), '읽는다.');
  assert.equal(h.context.parseTonePatches('{"items":{}}', items).length, 0);
});
test('large selections are batched and retain every sentence', async () => {
  let calls = 0;
  const h = harness(Array(70).fill('읽습니다.').join('\n'), async prompt => {
    calls++;
    const items = candidates(prompt);
    assert.ok(items.length <= 32);
    return JSON.stringify({items:items.map(item => ({...item,to:'읽는다'}))});
  });
  assert.equal(await h.context.rewriteAcademicIda(), Array(70).fill('읽는다.').join('\n'));
  assert.equal(calls, 3);
});
test('stop prevents late AI results and history writes', async () => {
  let resolve;
  const h = harness('읽습니다.', () => new Promise(r => { resolve = r; }));
  h.context.window.scholarAIHistoryAdd = assert.fail;
  const task = h.context.rewriteAcademicIda();
  h.context.specialRunEpoch++;
  resolve('{"items":[{"id":0,"from":"읽습니다","to":"읽는다"}]}');
  await task;
  assert.equal(h.results.length, 1);
});
test('AI failures expose remaining endings and keep fast results', async () => {
  const h = harness('중요합니다. 읽습니다.', async () => { throw new Error('offline'); });
  assert.equal(await h.context.rewriteAcademicIda(), '중요하다. 읽습니다.');
  assert.match(h.results.at(-1), /부분 완료/);
  assert.match(h.results.at(-1), /읽습니다 · 1행/);
  assert.equal(h.context.specialRunning, false);
});

test('screenshot future endings convert even when AI is unavailable', async () => {
  const source = '본 요청은 학생 유형 분석 및 과제 점검을 목적으로 하는 AI 시스템의 설계 구조에 대한 심층적인 설명이므로, 단순한 기능 나열을 넘어 학술적이고 객관적인 관점에서 구성요소와 작동 원리를 상세히 전개하는 것이 중요합니다.\n\n아래에서는 해당 목적을 달성하기 위한 인공지능 기반 플랫폼을 **진단-분석-피드백 시스템(Diagnostic-Analysis-Feedback System)**으로 정의하고, 이 시스템의 세부 아키텍처와 각 모듈의 역할을 체계적으로 설명하겠습니다.';
  const h = harness(source);
  assert.equal(await h.context.rewriteAcademicIda(), source.replace('중요합니다', '중요하다').replace('설명하겠습니다', '설명하겠다'));
});
test('future and past endings preserve tense and protected areas without AI', () => {
  const h = harness();
  assert.equal(h.context.transformAcademicIda('검토하겠습니다. 읽었습니다. 찾았습니다. 학생이었습니다. 발표했습니다. **진행하겠습니다**. `하겠습니다`').text,
    '검토하겠다. 읽었다. 찾았다. 학생이었다. 발표하였다. **진행하겠다**. `하겠습니다`');
});
test('reasoning with braces does not hide valid JSON patches', () => {
  const h = harness();
  const patches = h.context.parseTonePatches('<think>{internal}</think>```json\n{"items":[{"id":0,"from":"읽습니다","to":"읽는다"}]}\n```', h.context.collectAmbiguous('읽습니다.'));
  assert.equal(patches.length, 1);
});
test('both sidebar loading paths use the updated tone cache version', () => {
  for (const file of ['mdpro/index.html', 'mdpro/js/app.js']) {
    assert.match(readFileSync(file, 'utf8'), /20261014-scholar-tone-4/);
    assert.doesNotMatch(readFileSync(file, 'utf8'), /20261014-scholar-quick-3/);
  }
});

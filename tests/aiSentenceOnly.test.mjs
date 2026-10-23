import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');

test('sentence-only checkbox is wired and persisted', () => {
  assert.match(source, /id="ai-chat-sentence-only"/);
  assert.match(source, /setSentenceOnly\(event\.target\.checked\)/);
  assert.match(source, /SENTENCE_ONLY_KEY = 'ss_ai_chat_sentence_only'/);
  assert.match(source, /storageGet\(SENTENCE_ONLY_KEY/);
});

test('sentence-only instruction prohibits structured Markdown unless explicitly requested', () => {
  const runtime = vm.createContext({ state: { sentenceOnly: true } });
  const start = source.indexOf('  function sentenceOnlyInstruction(');
  const end = source.indexOf('\n  function ', start + 10);
  vm.runInContext(source.slice(start, end), runtime);
  const instruction = runtime.sentenceOnlyInstruction();
  assert.match(instruction, /문장과 문단으로만/);
  assert.match(instruction, /Markdown 제목/);
  assert.match(instruction, /코드나 Mermaid/);
  runtime.state.sentenceOnly = false;
  assert.equal(runtime.sentenceOnlyInstruction(), '');
});

test('sentence-only instruction is applied to normal, FAST, search, and continuation prompts', () => {
  assert.ok((source.match(/sentenceOnlyInstruction\(\)/g) || []).length >= 8);
  assert.match(source, /state\.sentenceOnly\s*\? '출력은 검색 범위, 핵심 결과/);
});

function runtimeForSentenceMode(enabled = true) {
  const runtime = vm.createContext({ state: { sentenceOnly: enabled }, writingStyleInstruction: () => '선택한 문체' });
  for (const name of ['sentenceOnlyInstruction', 'originalAnswerInstruction', 'normalizeSentenceOnlyOutput', 'applySentenceOnlyRequest']) {
    const start = source.indexOf('  function ' + name + '(');
    const end = source.indexOf('\n  function ', start + 10);
    vm.runInContext(source.slice(start, end), runtime);
  }
  return runtime;
}

test('selected-document Markdown cannot bypass the sentence choice in normal or continuation requests', () => {
  const runtime = runtimeForSentenceMode();
  const messages = [{ role: 'user', content: '#### 1. 최적 프로파일 수 결정\n결과를 작성해줘' }];
  const request = runtime.applySentenceOnlyRequest({ messages, systemInstruction: '기존 형식을 유지한다.' });
  assert.match(request.systemInstruction, /필수 문장 전용 출력 규칙/);
  assert.match(request.messages[0].content, /그 형식을 따라 하지 않는다/);
  assert.equal(messages[0].content, '#### 1. 최적 프로파일 수 결정\n결과를 작성해줘');
  assert.equal(runtime.originalAnswerInstruction(), '');
  assert.match(source, /complete\(applySentenceOnlyRequest\(\{/);
  runtime.state.sentenceOnly = false;
  assert.equal(runtime.originalAnswerInstruction(), '');
  assert.equal(runtime.applySentenceOnlyRequest({ messages }).messages, messages);
});

test('screenshot regression: final prose removes numbered headings and emphasis without losing results', () => {
  const runtime = runtimeForSentenceMode();
  const answer = '#### 1. 최적 프로파일 수 결정\n\n프로파일 수를 비교하였다.\n\n#### 2. 분산-공분산 구조의 설정\n첫째, **국소적 독립성(Local Independence)**을 설정하였다.\n\n1. 로그 우도는 -1858.048에서 -1646.012로 상승하였다.';
  const result = runtime.normalizeSentenceOnlyOutput(answer);
  assert.doesNotMatch(result, /####|\*\*|^\d+\./m);
  assert.match(result, /최적 프로파일 수 결정: 프로파일 수를 비교하였다/);
  assert.match(result, /국소적 독립성\(Local Independence\)/);
  assert.match(result, /-1858\.048에서 -1646\.012/);
  runtime.state.sentenceOnly = false;
  assert.equal(runtime.normalizeSentenceOnlyOutput(answer), answer);
});

test('prose cleanup preserves explicit math, code, citations, and subscripts exactly', () => {
  const runtime = runtimeForSentenceMode();
  const literals = [String.raw`$n_profiles$`, String.raw`\(*p<.05, **p<.01, ***p<.001\)`, String.raw`\\[a_b ** c\\]`, '$$a_b ** c$$', '`some_code ** value`', '```mermaid\ngraph TD\nA-->B\n```', '~~~js\nconst x = "**bold**";\n~~~'];
  for (const literal of literals) {
    const output = runtime.normalizeSentenceOnlyOutput('**결과**\n\n' + literal + '\n\n(Kim, 2025)');
    assert.ok(output.includes(literal), literal);
    assert.ok(output.includes('(Kim, 2025)'));
  }
});

test('both document completion and stored chat use sentence cleanup outside original mode', () => {
  assert.match(source, /cleanFinal = normalizeSentenceOnlyOutput\(state.generalAnswer \? liveStream.answer : parseAssistantSections\(liveStream.answer\).answer\)/);
  assert.match(source, /sections.answer = normalizeSentenceOnlyOutput\(sections.answer\);[\s\S]*finishRealtimeDocStream\(sections.answer\)/);
  assert.match(source, /continued = normalizeSentenceOnlyOutput\(continued\)/);
});

test('stream completion replaces raw Markdown in the document with the same final prose', () => {
  const runtime = runtimeForSentenceMode();
  const raw = '#### 1. 최적 프로파일 수 결정\n\n**5개** 프로파일로 결정하였다.';
  let written = '';
  Object.assign(runtime, {
    liveStream: { answer: '', reasoning: '', progress: 0 },
    realtimeDocActive: true,
    realtimeDocWritten: '',
    providerDisplayName: () => 'Ollama',
    streamDeltaToRealtimeDoc: chunk => { written += chunk; },
    scheduleLiveStreamRender: () => {},
    parseAssistantSections: text => ({ answer: text }),
    getBridge: () => ({ finishRealtimeDocStream: text => { written = text; } })
  });
  const start = source.indexOf('  function handleStreamEvent(');
  const end = source.indexOf('\n  function ', start + 10);
  vm.runInContext(source.slice(start, end), runtime);
  for (const chunk of [raw.slice(0, 8), raw.slice(8, 25), raw.slice(25)]) {
    runtime.handleStreamEvent({ type: 'message.delta', content: chunk });
  }
  assert.equal(written, raw);
  runtime.handleStreamEvent({ type: 'chat.end', result: { stats: {} } });
  assert.equal(written, runtime.normalizeSentenceOnlyOutput(raw));
  assert.equal(written, '최적 프로파일 수 결정: 5개 프로파일로 결정하였다.');
  assert.equal(runtime.realtimeDocActive, false);
});

test('original bypasses sentence prompts and cleanup with sentence mode saved as enabled', () => {
  const runtime = runtimeForSentenceMode();
  runtime.state.generalAnswer = true;
  const raw = '[ANSWER]\n## 결과\n\n1. **MR1** 요인이다.\n\n|요인|적재량|\n|---|---|\n|MR1|.861|';
  const request = { messages: [{ role: 'user', content: '결과를 해석해줘' }], systemInstruction: '' };
  assert.equal(runtime.sentenceOnlyInstruction(), '');
  assert.equal(runtime.applySentenceOnlyRequest(request), request);
  assert.equal(runtime.normalizeSentenceOnlyOutput(raw), raw);
  let written;
  Object.assign(runtime, {
    liveStream: { answer: raw, maxOutputTokens: 0 }, realtimeDocActive: true,
    providerDisplayName: () => 'Lemonade', scheduleLiveStreamRender: () => {},
    parseAssistantSections: () => { throw new Error('original must preserve model sections'); },
    getBridge: () => ({ finishRealtimeDocStream: text => { written = text; } })
  });
  const start = source.indexOf('  function handleStreamEvent(');
  const end = source.indexOf('\n  function ', start + 10);
  vm.runInContext(source.slice(start, end), runtime);
  runtime.handleStreamEvent({ type: 'chat.end', result: { stats: {} } });
  assert.equal(written, raw);
  assert.equal(runtime.realtimeDocActive, false);
  runtime.state.generalAnswer = false;
  assert.match(runtime.sentenceOnlyInstruction(), /필수 문장 전용/);
  assert.notEqual(runtime.normalizeSentenceOnlyOutput(raw), raw);
});

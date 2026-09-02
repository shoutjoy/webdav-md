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

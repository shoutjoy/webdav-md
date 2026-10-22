import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const start = source.indexOf('  function writingStyleInstruction(');
const end = source.indexOf('\n  function sentenceOnlyInstruction(', start);

function writingInstruction(state) {
  const runtime = vm.createContext({ state, root: {} });
  vm.runInContext(source.slice(start, end), runtime);
  return runtime.writingStyleInstruction({ academic: false });
}

test('original mode applies the selected academic or polite tone', () => {
  assert.match(writingInstruction({ generalAnswer: true, writingStyle: 'academic' }), /-이다, -한다, -였다/);
  assert.match(writingInstruction({ generalAnswer: true, writingStyle: 'polite' }), /정중한 한국어 존댓말/);
  assert.doesNotMatch(source, /(?:select|writingStyle)\.disabled = state\.running \|\| state\.generalAnswer/);
});

test('original mode bypasses presets but respects the explicit sentence-only choice', () => {
  assert.match(source, /function originalAnswerInstruction\(\)/);
  assert.match(source, /original means model-native structure/);
  assert.match(source, /return \[writingStyleInstruction\(\{ academic: false \}\), sentenceOnlyInstruction\(\)\]/);
  assert.match(source, /:\s*state\.generalAnswer\s*\?\s*originalAnswerInstruction\(\)/s);
  assert.match(source, /:\s*\[\s*'You are a capable conversational assistant\./s);
});

test('original mode preserves model-authored sections and bypasses bridge mode instructions', () => {
  assert.match(source, /preserveModelStyle:\s*\(state\.generalAnswer \|\| localNativeQuality\)/);
  assert.match(source, /preserveModelAnswer\s*\?\s*\{ answer: responseStatus\.answer/);
  const appSource = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /const modeInstruction = request\.preserveModelStyle === true\s*\? ''/);
});

test('existing academic and polite modes retain their required style prompts', () => {
  assert.match(writingInstruction({ generalAnswer: false, writingStyle: 'academic' }), /전문적인 한국어 학술 문체/);
  assert.match(writingInstruction({ generalAnswer: false, writingStyle: 'polite' }), /자연스럽고 정중한 한국어 존댓말/);
});

test('general answer checkbox is persisted and synchronized with the UI', () => {
  assert.match(source, /id="ai-chat-general-answer"/);
  assert.match(source, /<span>original<\/span>/);
  assert.match(source, /<span>삽입방식<\/span>/);
  assert.match(source, /<option value="academic">학술체<\/option><option value="polite">존댓말<\/option>/);
  assert.match(source, /<option value="current">다크<\/option><option value="plain-light">라이트<\/option>/);
  assert.match(source, /var GENERAL_ANSWER_KEY = 'ss_ai_chat_general_answer'/);
  assert.match(source, /setGeneralAnswer\(event\.target\.checked, true\)/);
  assert.match(source, /state\.generalAnswer = storageGet\(GENERAL_ANSWER_KEY/);
});

test('AI Jena migrates the default opening layout to Alt+2 Dock once', () => {
  assert.match(source, /START_LAYOUT_DEFAULT_REVISION_KEY = 'ss_ai_chat_start_layout_default_revision'/);
  assert.match(source, /startLayoutDefaultRevision !== 'dock-alt2-v1'/);
  assert.match(source, /state\.startLayout = 'dock'/);
  assert.match(source, /storageSet\(START_LAYOUT_DEFAULT_REVISION_KEY, 'dock-alt2-v1'\)/);
});

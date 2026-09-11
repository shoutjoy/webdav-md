import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatSource = readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');

test('reasoning mode asks for an expert, nuanced, long-form answer', () => {
  assert.match(chatSource, /function reasoningAnswerInstruction\(\)/);
  assert.match(chatSource, /전문가급 심층 답변/);
  assert.match(chatSource, /대안과 반론/);
  assert.match(chatSource, /실무적 시사점과 다음 행동/);
  assert.match(chatSource, /중요한 질문이나 확인할 사항/);
  assert.match(chatSource, /내부 chain-of-thought/);
  assert.match(chatSource, /function internetSystemInstruction\(evidence\)[\s\S]*?reasoningAnswerInstruction\(\)/);
  assert.match(chatSource, /function nativeInternetSystemInstruction\(\)[\s\S]*?reasoningAnswerInstruction\(\)/);
});

test('reasoning mode sends the full available conversation for budget-aware retention', () => {
  assert.match(chatSource, /includeFullConversation\s*\?\s*MAX_CONTEXT_MESSAGES/);
  assert.match(chatSource, /contextMessages\(\{ reasoningMode: state\.responseMode === 'reasoning' \}\)/);
  assert.match(chatSource, /\[이전 답변의 공개 설명\]/);
  assert.match(bridgeSource, /이전 대화의 전제·수정·미해결 쟁점/);
});

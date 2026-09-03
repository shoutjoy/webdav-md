import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const aiChatSource = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.css', import.meta.url), 'utf8');

test('realtime doc write controls are rendered in composer actions', () => {
  assert.match(aiChatSource, /id="ai-chat-realtime-doc-toggle"/);
  assert.match(aiChatSource, /id="ai-chat-realtime-target-toggle"/);
  assert.match(aiChatSource, /id="ai-chat-realtime-sentence-toggle"/);
  assert.match(aiChatSource, /ai-chat-realtime-toolbar/);
  assert.match(aiChatSource, /ai-chat-rt-check-box/);
  assert.match(aiChatSource, /ai-chat-rt-doc-icon/);
  assert.match(aiChatSource, /ai-chat-rt-arrow-icon/);
});

test('realtime doc write state and storage keys are configured and synchronized', () => {
  assert.match(aiChatSource, /REALTIME_DOC_WRITE_KEY = 'ss_ai_chat_realtime_doc_write'/);
  assert.match(aiChatSource, /REALTIME_DOC_TARGET_KEY = 'ss_ai_chat_realtime_doc_target'/);
  assert.match(aiChatSource, /REALTIME_DOC_WRITE_KEY,\s*REALTIME_DOC_TARGET_KEY/);
  assert.match(aiChatSource, /storageGet\(REALTIME_DOC_WRITE_KEY/);
  assert.match(aiChatSource, /storageGet\(REALTIME_DOC_TARGET_KEY/);
});

test('realtime doc write control methods exist in ai-chat.js', () => {
  assert.match(aiChatSource, /function setRealtimeDocWrite\(/);
  assert.match(aiChatSource, /function setRealtimeDocTarget\(/);
  assert.match(aiChatSource, /function streamDeltaToRealtimeDoc\(/);
  assert.match(aiChatSource, /setRealtimeDocWrite\(state\.realtimeDocWrite/);
  assert.match(aiChatSource, /setRealtimeDocTarget\(state\.realtimeDocTarget/);
});

test('AIChatBridge in app.js implements realtime doc streaming API', () => {
  assert.match(appSource, /startRealtimeDocStream:\s*function/);
  assert.match(appSource, /writeRealtimeDocStreamChunk:\s*function/);
  assert.match(appSource, /finishRealtimeDocStream:\s*function/);
  assert.match(appSource, /cancelRealtimeDocStream:\s*function/);
  assert.match(appSource, /hasActiveDocEditor:\s*function/);
  assert.match(appSource, /function startRealtimeDocStream\(/);
  assert.match(appSource, /function writeRealtimeDocStreamChunk\(/);
  assert.match(appSource, /function finishRealtimeDocStream\(/);
  assert.match(appSource, /function cancelRealtimeDocStream\(/);
});

test('streamDeltaToRealtimeDoc filters out explanation/answer tags during streaming', () => {
  assert.match(aiChatSource, /streamDeltaToRealtimeDoc\(event\.content\)/);
  assert.match(aiChatSource, /cleanText\.indexOf\('\[EXPLANATION\]'\)/);
  assert.match(aiChatSource, /replace\(\/\\\[\\\/\?\(\?:EXPLANATION\|ANSWER\)\\\]\/gi/);
});

test('realtime doc CSS styles exist for toolbar, buttons, and light theme', () => {
  assert.match(cssSource, /\.ai-chat-realtime-toolbar/);
  assert.match(cssSource, /\.ai-chat-realtime-doc-toggle/);
  assert.match(cssSource, /\.ai-chat-realtime-target-toggle/);
  assert.match(cssSource, /\.ai-chat-realtime-sentence-toggle/);
  assert.match(cssSource, /\.ai-chat-rt-sentence-text/);
  assert.match(cssSource, /body\.theme-light \.ai-chat-compose-actions \.ai-chat-realtime-doc-toggle/);
});

test('sentence button has been moved to compose toolbar and top toggle is hidden', () => {
  assert.match(cssSource, /\.ai-chat-sentence-toggle\s*\{\s*display:\s*none\s*!important;/);
  assert.match(aiChatSource, /id="ai-chat-realtime-sentence-toggle"[^>]*class="ai-chat-realtime-sentence-toggle"/);
  assert.match(aiChatSource, /class="ai-chat-rt-sentence-text">문장<\/span>/);
});

test('selection replacement in document stream is implemented', () => {
  assert.match(appSource, /rememberEditorSelection/);
  assert.match(appSource, /lastCapturedEditorSelection/);
  assert.match(appSource, /isReplacing\s*=\s*true/);
  assert.match(aiChatSource, /selectedDocText/);
  assert.match(aiChatSource, /선택한 텍스트를 대체하여/);
});


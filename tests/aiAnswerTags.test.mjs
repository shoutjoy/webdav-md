import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');
const runtime = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('  function stripAnswerProtocolTags('), source.indexOf('  var ACADEMIC_CHECKLIST')), runtime);

test('Gemini orphan closing ANSWER tag is removed, including after Mermaid', () => {
  const diagram = '```mermaid\nflowchart TD\nA --> B\n```';
  assert.equal(runtime.parseAssistantSections(diagram + '\n\n[/ANSWER]').answer, diagram);
  assert.equal(runtime.parseAssistantSections('답변입니다.[/answer]').answer, '답변입니다.');
});
test('orphan response protocol tags never appear in the visible answer', () => {
  const raw = 'AI JENA에서 추론 등에 나타나는 것\n\n핵심적인 차이점이다.[/EXPLANATION]\n\n답변에서 나타나는 것\n\n평가할 수 있다.[/ANSWER]';
  assert.equal(
    runtime.parseAssistantSections(raw).answer,
    'AI JENA에서 추론 등에 나타나는 것\n\n핵심적인 차이점이다.\n\n답변에서 나타나는 것\n\n평가할 수 있다.'
  );
  assert.equal(runtime.parseAssistantSections('본문[/CHECKLIST]').answer, '본문');
});
test('paired sections and truncated opening tags keep the answer', () => {
  const sections = runtime.parseAssistantSections('[EXPLANATION]설명[/EXPLANATION][ANSWER]본문[/ANSWER]');
  assert.equal(sections.answer, '본문');
  assert.equal(sections.explanation, '설명');
  assert.equal(runtime.parseAssistantSections('[ANSWER]미완료 본문').answer, '미완료 본문');
});
test('tag-only answer does not fall back to leaking the raw marker', () => {
  assert.equal(runtime.parseAssistantSections('[/ANSWER]').answer, '');
  assert.equal(runtime.parseAssistantSections('[ANSWER][/ANSWER]').answer, '');
});
test('saved answer cleanup preserves literal fenced and inline code', () => {
  const code = '```text\n[/ANSWER]\n[/EXPLANATION]\n```\n`[/ANSWER]` `[/EXPLANATION]`';
  assert.equal(runtime.stripAnswerProtocolTags(code + '\n[/ANSWER]\n[/EXPLANATION]'), code);
  assert.equal(runtime.stripAnswerProtocolTags('~~~text\n[/ANSWER]\n~~~\n[/ANSWER]'), '~~~text\n[/ANSWER]\n~~~');
});
test('saved assistant messages use the same cleanup without changing user messages', () => {
  const start = source.indexOf('  function sanitizeAssistantMessage(');
  const end = source.indexOf('\n  function ', start + 10);
  runtime.extractModelStatus = answer => ({ answer });
  runtime.separateEmbeddedReasoning = (answer, reasoning) => ({ answer, reasoning });
  vm.runInContext(source.slice(start, end), runtime);
  const assistant = { role: 'assistant', content: '기존 답변\n[/ANSWER]' };
  runtime.sanitizeAssistantMessage(assistant);
  assert.equal(assistant.content, '기존 답변');
  const user = { role: 'user', content: '[/ANSWER]' };
  runtime.sanitizeAssistantMessage(user);
  assert.equal(user.content, '[/ANSWER]');
});

test('retired Mermaid notice is removed but other notices survive', () => {
  const message = { role: 'assistant', content: 'flowchart TD\nA --> B', notice: '출력 한도 안내\nMermaid 검증 모듈이 없습니다. 새로고침 후 다시 시도하세요. 문서 삽입은 보류됩니다.' };
  runtime.sanitizeAssistantMessage(message);
  assert.equal(message.notice, '출력 한도 안내');
});

test('Mermaid insertion works without a validator and preserves content and mode', async () => {
  let inserted;
  runtime.snapshotEditorSelectionForInsert = () => {};
  runtime.getBridge = () => ({ insertIntoDocument: (text, mode) => { inserted = { text, mode }; return true; } });
  const start = source.indexOf('  async function insertIntoCurrentDocument(');
  vm.runInContext(source.slice(start, source.indexOf('  function openAnswerPreviewWindow(', start)), runtime);
  const text = '```mermaid\nflowchart TD\nA --> B\n```';
  await runtime.insertIntoCurrentDocument(text, 'replace');
  assert.deepEqual(inserted, { text, mode: 'replace' });
  assert.doesNotMatch(source, /checkMermaidAnswer|AIJenaMermaidGuard|loadMermaidForValidation/);
});

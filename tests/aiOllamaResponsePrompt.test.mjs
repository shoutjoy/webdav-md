import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js', import.meta.url), 'utf8');

function loadMermaidPromptHelpers() {
  const start = source.indexOf('  var MERMAID_DARK_MODE_PROMPT_RULE');
  const end = source.indexOf('  var state =', start);
  const runtime = vm.createContext({});
  vm.runInContext(source.slice(start, end), runtime);
  return runtime;
}

test('Mermaid rules are activated only for explicit Mermaid output requests', () => {
  const runtime = loadMermaidPromptHelpers();

  assert.equal(runtime.isMermaidOutputRequest('오늘 할 일을 간단히 정리해 줘'), false);
  assert.equal(runtime.isMermaidOutputRequest('Mermaid가 무엇인지 설명해 줘'), false);
  assert.equal(runtime.isMermaidOutputRequest('Explain Mermaid diagrams and their use cases'), false);
  assert.equal(runtime.mermaidInstructionForRequest('일반적인 설명을 해 줘', false), '');
  assert.equal(runtime.isMermaidOutputRequest('이 흐름을 Mermaid 다이어그램으로 만들어 줘'), true);
  assert.match(runtime.mermaidInstructionForRequest('Mermaid 코드를 생성해 줘', true), /코드 블록 하나만 반환/);
});

test('Ollama normal and FAST prompts preserve model-appropriate response formats', () => {
  assert.match(source, /state\.provider === 'ollama'[\s\S]*Respond naturally in the format best suited to the request/);
  assert.match(source, /FAST mode\.[\s\S]*Include a brief explanation, code, list, or other structure when it is useful/);
  assert.doesNotMatch(source, /FAST mode\. Use only the latest user message and answer directly with no explanation/);
  assert.match(source, /mermaidInstructionForRequest\(text, state\.fastMode\)/);
});

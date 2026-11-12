const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const Module = require('node:module');
const helper = new Module('quality-helper',module); helper._compile(fs.readFileSync('mdpro/js/mermaid/mermaid-editor/ai-quality.js','utf8'),'quality-helper.cjs');
const { normalize, stripFences, systemInstruction, repairSyntax } = helper.exports;

test('remove standalone outer fences while preserving Mermaid labels and whitespace', () => {
  const code = 'graph LR\n    X["부모코칭역량<br>(X)"]\n    X -->|H1| M1';
  for (const fence of ['```', '````', '~~~']) {
    assert.equal(stripFences(fence + 'mermaid\n' + code + '\n' + fence), code);
  }
  assert.equal(stripFences('```mermaid\r\ngraph LR\r\nA --> B\r\n```'), 'graph LR\r\nA --> B');
  assert.equal(stripFences('```mermaid\ngraph LR'), 'graph LR');
  assert.equal(stripFences('graph LR\n```'), 'graph LR');
  assert.equal(stripFences('graph LR\nA["literal ``` text"]'), 'graph LR\nA["literal ``` text"]');
});

test('quote nested parenthetical labels without changing shape or path semantics', () => {
  const source = 'graph LR\nX[부모코칭역량 (X)]\nM1(양육효능감 (M1))\nM2((정서표현 (M2)))\nY([사회정서역량 (Y)])\nX -->|H1| M1\nM1 -.->|H2| M2\nM2 --> Y';
  const result = normalize(source);
  assert.match(result, /X\["부모코칭역량 \(X\)"\]/);
  assert.match(result, /M1\("양육효능감 \(M1\)"\)/);
  assert.match(result, /M2\(\("정서표현 \(M2\)"\)\)/);
  assert.match(result, /Y\(\["사회정서역량 \(Y\)"\]\)/);
  assert.ok(result.endsWith('X -->|H1| M1\nM1 -.->|H2| M2\nM2 --> Y'));
  assert.equal(normalize(result), result);
});

test('preserve quoted labels, styles, directives, other diagram languages and invalid drafts', () => {
  const code = '%% comment\nflowchart LR\nA["already (quoted)"] -->|"H1"| B{"Yes?"}\nclassDef circle fill:#fff,stroke:#000;\nclass A circle;\nlinkStyle 0 stroke:#333;';
  assert.equal(normalize(code), code);
  assert.equal(normalize('sequenceDiagram\nA->>B: label (M1)'), 'sequenceDiagram\nA->>B: label (M1)');
  assert.equal(normalize('graph LR\nA[broken'), 'graph LR\nA[broken');
  assert.match(systemInstruction, /Do not invent subgraphs/);
  assert.match(systemInstruction, /ALL visible labels in double quotes/);
});

test('automatic repair commits only when the original fails and the candidate parses', async () => {
  const source = 'graph LR\nM1(양육효능감 (M1))';
  const fixed = normalize(source);
  assert.deepEqual(await repairSyntax(source, async code => code === fixed), { code: fixed, changed: true });
  assert.deepEqual(await repairSyntax(source, async () => true), { code: source, changed: false });
  assert.deepEqual(await repairSyntax(source, async () => { throw Error('parse'); }), { code: source, changed: false });
});

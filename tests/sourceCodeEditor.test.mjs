import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCodeMirrorMode, isSourceCodeFile } from '../src/codeFileTypes.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const editorSource = readFileSync(new URL('../src/components/CodeEditPage.jsx', import.meta.url), 'utf8');

test('routes CSS and JavaScript files to the source editor while HTML stays in MDPRO', () => {
  assert.equal(isSourceCodeFile('style.css'), true);
  assert.equal(isSourceCodeFile('app.js'), true);
  assert.equal(isSourceCodeFile('waveform-editor.js'), true);
  assert.equal(isSourceCodeFile('index.html'), false);
  assert.equal(isSourceCodeFile('notes.md'), false);
  assert.match(appSource, /isSourceCodeFile\(file\.name\) \? 'code' : 'text'/);
  assert.match(appSource, /selectedFile\?\.viewMode === 'code' \? <React\.Suspense/);
  assert.match(appSource, /React\.lazy\(\(\) => import\('\.\/components\/CodeEditPage\.jsx'\)\)/);
});

test('selects a CodeMirror syntax mode from the file extension', () => {
  assert.equal(getCodeMirrorMode('style.css'), 'css');
  assert.equal(getCodeMirrorMode('app.js'), 'javascript');
  assert.deepEqual(getCodeMirrorMode('types.ts'), { name: 'javascript', typescript: true });
  assert.deepEqual(getCodeMirrorMode('data.json'), { name: 'javascript', json: true });
  assert.match(editorSource, /mode: getCodeMirrorMode\(selectedName\)/);
  assert.match(editorSource, /'Ctrl-S': \(\) => onSaveRef\.current\(\)/);
  assert.match(editorSource, /lineNumbers: true/);
  assert.match(editorSource, /lineWrapping: false/);
});

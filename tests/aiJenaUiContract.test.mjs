import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chatScript = readFileSync(resolve(repositoryRoot, 'mdpro/AI_App/aiChat/ai-chat.js'), 'utf8');
const chatStyles = readFileSync(resolve(repositoryRoot, 'mdpro/AI_App/aiChat/ai-chat.css'), 'utf8');

const requiredHeaderControls = [
  'ai-chat-history-toggle',
  'ai-chat-new',
  'ai-chat-copy-all',
  'ai-chat-save-all',
  'ai-chat-data-center-open',
  'ai-chat-layout-menu-button',
  'ai-chat-close'
];

test('AI Jena keeps every primary header control', () => {
  for (const controlId of requiredHeaderControls) {
    assert.match(chatScript, new RegExp(`id=["']${controlId}["']`), `${controlId} must remain in the UI`);
  }
});

test('AI Jena keeps the Alt+4 movement and compact real-time behavior', () => {
  assert.match(chatScript, /id=["']ai-chat-floating-drag-handle["']/);
  assert.match(chatScript, /state\.layout === 'floating' && !state\.realtimeDocWrite/);
});

test('expanded AI Jena layouts force the header menu to remain visible', () => {
  assert.match(chatStyles, /\.ai-chat-panel:not\(\.floating-compact\) \.ai-chat-header-actions\s*\{[^}]*display:\s*flex\s*!important/s);
  assert.match(chatStyles, /\.ai-chat-header-actions[^}]*visibility:\s*visible\s*!important/s);
});

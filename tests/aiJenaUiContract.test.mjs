import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chatScript = readFileSync(resolve(repositoryRoot, 'mdpro/AI_App/aiChat/ai-chat.js'), 'utf8');
const chatStyles = readFileSync(resolve(repositoryRoot, 'mdpro/AI_App/aiChat/ai-chat.css'), 'utf8');
const appStyles = readFileSync(resolve(repositoryRoot, 'mdpro/css/style.css'), 'utf8');
const markup = readFileSync(resolve(repositoryRoot, 'mdpro/index.html'), 'utf8');

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
  assert.match(chatScript, /floatingCompactReturnPosition = \{ left: compactRect\.left, top: compactRect\.top, bottom: compactRect\.bottom \}/);
  assert.match(chatScript, /panel\.style\.width = '';[\s\S]*panel\.style\.height = '';/);
  assert.match(chatScript, /if \(!isExpanded\) \{[\s\S]*floatingCompactReturnPosition = null;[\s\S]*saveFloatingPosition\(\)/);
  assert.match(chatScript, /function clampFloatingToViewport\(\)[\s\S]*var viewport = getFloatingViewportBounds\(\)/);
  assert.match(chatScript, /function positionFloatingCompactAtBottom\(\)[\s\S]*viewport\.bottom - height - getFloatingBottomMargin\(\)/);
  assert.match(chatScript, /setFloatingExpanded\(false\);[\s\S]*schedule\(positionFloatingCompactAtBottom\)/);
});

test('Alt+4 settings expand upward and provide a floating-only close control', () => {
  assert.match(chatScript, /id=["']ai-chat-floating-close["']/);
  assert.match(chatScript, /floatingBottom = panel\.getBoundingClientRect\(\)\.bottom/);
  assert.match(chatScript, /floatingBottom - height/);
  assert.match(chatStyles, /\.ai-chat-icon-action:not\(#ai-chat-new\):not\(#ai-chat-copy-all\):not\(#ai-chat-save-all\):not\(#ai-chat-floating-close\)/);
  assert.match(chatStyles, /\.ai-chat-panel\.layout-floating:not\(\.floating-compact\) #ai-chat-floating-close\s*\{\s*display:\s*inline-flex\s*!important;/);
  assert.match(chatStyles, /@media \(max-width: 760px\)[\s\S]*floating-settings-open[\s\S]*min-height:\s*72px/);
});

test('Alt+4 settings stay inside the visible browser viewport', () => {
  assert.match(chatScript, /function getFloatingViewportBounds\(\)[\s\S]*root\.visualViewport/);
  assert.match(chatScript, /function setProviderControlsOpen\(open\)[\s\S]*getFloatingViewportBounds\(\)[\s\S]*viewport\.bottom - height - 4/);
  assert.match(chatScript, /visualViewport\.addEventListener\('resize', clampFloatingToViewport\)/);
  assert.match(chatScript, /visualViewport\.addEventListener\('scroll', clampFloatingToViewport\)/);
});

test('AI Jena uses only the main provider settings control', () => {
  assert.match(chatScript, /id=["']ai-chat-provider-toggle["']/);
  assert.doesNotMatch(chatScript, /id=["']ai-chat-floating-settings["']/);
  assert.match(chatStyles, /\.ai-chat-floating-settings\s*\{\s*display:\s*none\s*!important;/);
});

test('expanded AI Jena layouts keep the header actions available', () => {
  assert.match(chatStyles, /\.ai-chat-panel:not\(\.floating-compact\) \.ai-chat-header-actions\s*\{[^}]*display:\s*flex\s*!important/s);
  assert.match(chatStyles, /\.ai-chat-header-actions[^}]*visibility:\s*visible\s*!important/s);
});

test('new, copy, and save header controls are hidden by default and enabled from ENV settings', () => {
  assert.match(markup, /id="ai-chat-header-utilities-enabled"[^>]*onchange="setAiJenaHeaderUtilitiesVisible\(this\.checked\)"/);
  assert.match(chatStyles, /\.ai-chat-panel #ai-chat-new,[\s\S]*#ai-chat-copy-all,[\s\S]*#ai-chat-save-all\s*\{\s*display:\s*none\s*!important;/);
  assert.match(chatStyles, /\.ai-chat-panel\.ai-chat-header-utilities-visible #ai-chat-new,[\s\S]*display:\s*inline-flex\s*!important;/);
  assert.match(chatScript, /setHeaderUtilitiesVisible\(storageGet\(HEADER_UTILITIES_KEY, '0'\) === '1'\)/);
  assert.match(chatScript, /button\.style\.setProperty\('display', 'none', 'important'\)/);
  assert.match(chatScript, /button\.style\.removeProperty\('display'\)/);
});

test('the AI Jena menu button toggles the panel closed in Alt+4 and every other layout', () => {
  assert.match(chatScript, /function openFromMenu\(\)\s*\{[\s\S]*if \(state\.open\) \{[\s\S]*setOpen\(false\);[\s\S]*return false;/);
  assert.match(chatScript, /menuButton\.setAttribute\('aria-pressed', state\.open \? 'true' : 'false'\)/);
  assert.match(markup, /id="btn-ai-jena-menu"[^>]*aria-pressed="false"/);
  assert.match(appStyles, /#btn-ai-jena-menu\.header-quick-tool-active/);
});

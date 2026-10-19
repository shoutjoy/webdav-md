import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../src/components/MdproEditor.jsx', import.meta.url), 'utf8');
const topNav = readFileSync(new URL('../src/components/TopNav.jsx', import.meta.url), 'utf8');

test('MDPRO renders top, bottom, left, and right resize handles in the normal layout', () => {
  assert.match(app, /panelResizeEnabled\s*\n/);
  assert.match(editor, /edges=\{\['top', 'bottom', 'left', 'right', 'bottom-right'\]\}/);
});

test('WD Dock creates a reconnect button beside WebDAV autosave', () => {
  const autosavePosition = topNav.indexOf('WebDAV 자동저장');
  const reconnectPosition = topNav.indexOf('WebDAV와 MDPRO 다시 연결');
  assert.ok(autosavePosition >= 0);
  assert.ok(reconnectPosition > autosavePosition);
  assert.match(topNav, /onClick=\{onReconnectPanels\}/);
});

test('reconnect restores both floating panels to the split layout', () => {
  assert.match(app, /querySelectorAll\('\.webdav-explorer-panel, \.mdpro-stage'\)/);
  assert.match(app, /classList\.remove\('is-floating-panel', 'is-panel-holding', 'is-panel-ready'\)/);
  assert.match(app, /\['left', 'top', 'width', 'height'\]/);
  assert.match(app, /onReconnectPanels=\{reconnectWebdavAndMdpro\}/);
});

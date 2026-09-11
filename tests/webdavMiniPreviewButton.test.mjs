import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topNav = readFileSync(new URL('../src/components/TopNav.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../mdpro/js/webdav-host-bridge.js', import.meta.url), 'utf8');

test('WD Dock exposes an always-visible miniPV toggle beside its menu button', () => {
  assert.match(topNav, /onToggleMiniPreview/);
  assert.match(topNav, /aria-label="miniPV 열기\/닫기"/);
  assert.match(topNav, /<PanelRightOpen size=\{16\}\/>/);
  const miniButton = topNav.indexOf('aria-label="miniPV 열기/닫기"');
  const collapsibleMenu = topNav.indexOf('{open && <div');
  assert.ok(miniButton > 0 && miniButton < collapsibleMenu);
});

test('WebDAV forwards the miniPV toggle to MDPRO', () => {
  assert.match(app, /type: 'webdav-toggle-mini-preview'/);
  assert.match(app, /onToggleMiniPreview=\{toggleMdproMiniPreview\}/);
  assert.match(bridge, /data\?\.type === 'webdav-toggle-mini-preview'/);
  assert.match(bridge, /window\.toggleMiniPreview\(\)/);
});

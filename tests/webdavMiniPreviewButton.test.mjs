import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topNav = readFileSync(new URL('../src/components/TopNav.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../mdpro/js/webdav-host-bridge.js', import.meta.url), 'utf8');
const mdpro = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

test('WD Dock hides its separate miniPV toggle on mobile while the edit menu keeps miniPV', () => {
  assert.match(topNav, /onToggleMiniPreview/);
  assert.match(topNav, /aria-label="miniPV 열기\/닫기"/);
  assert.match(topNav, /<PanelRightOpen size=\{16\}\/>/);
  assert.match(topNav, /className="hidden h-10[^\"]*sm:flex/);
  assert.match(mdpro, /id="btn-mini-pv"[^>]*onclick="toggleMiniPreview\(\)"/s);
});

test('WebDAV forwards the miniPV toggle to MDPRO', () => {
  assert.match(app, /type: 'webdav-toggle-mini-preview'/);
  assert.match(app, /onToggleMiniPreview=\{toggleMdproMiniPreview\}/);
  assert.match(bridge, /data\?\.type === 'webdav-toggle-mini-preview'/);
  assert.match(bridge, /window\.toggleMiniPreview\(\)/);
});

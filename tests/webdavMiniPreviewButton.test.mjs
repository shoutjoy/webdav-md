import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const topNav = readFileSync(new URL('../src/components/TopNav.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../mdpro/js/webdav-host-bridge.js', import.meta.url), 'utf8');
const mdpro = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');

test('WD Dock does not render a separate miniPV toggle while the edit menu keeps miniPV', () => {
  assert.doesNotMatch(topNav, /onToggleMiniPreview/);
  assert.doesNotMatch(topNav, /aria-label="miniPV 열기\/닫기"/);
  assert.doesNotMatch(topNav, /<PanelRightOpen size=\{16\}\/>/);
  assert.match(mdpro, /id="btn-mini-pv"[^>]*onclick="toggleMiniPreview\(\)"/s);
});

test('WD Dock no longer forwards a miniPV toggle while the MDPRO bridge remains compatible', () => {
  assert.doesNotMatch(app, /type: 'webdav-toggle-mini-preview'/);
  assert.doesNotMatch(app, /onToggleMiniPreview=\{toggleMdproMiniPreview\}/);
  assert.match(bridge, /data\?\.type === 'webdav-toggle-mini-preview'/);
  assert.match(bridge, /window\.toggleMiniPreview\(\)/);
});

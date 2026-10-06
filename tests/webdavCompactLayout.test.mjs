import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('compact WebDAV wrapper shrinks with its rail so MDPRO uses the released space', () => {
  assert.match(appSource, /className=\{`webdav-explorer-panel \$\{isExplorerCompact \? 'is-compact' : ''\}`\}/);
  assert.match(appSource, /style=\{isExplorerCompact \? undefined : \{ flexBasis: `\$\{explorerWidth\}%` \}\}/);
  assert.match(styles, /\.webdav-explorer-panel\.is-compact\s*\{[^}]*width:\s*42px;[^}]*min-width:\s*42px;[^}]*flex-basis:\s*42px;/s);
  assert.match(styles, /\.webdav-compact-rail\s*\{[^}]*width:\s*42px;[^}]*min-width:\s*42px;/s);
});

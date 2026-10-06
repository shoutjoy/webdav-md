import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');
const scholar = readFileSync(new URL('../mdpro/js/Scholarref/integration/scholar-search-app.js', import.meta.url), 'utf8');
const shareToolbar = readFileSync(new URL('../mdpro/ShareSites/Share/share-toolbar.html', import.meta.url), 'utf8');
const shareSettings = readFileSync(new URL('../mdpro/ShareSites/Share/share-settings.html', import.meta.url), 'utf8');
const sitesSettings = readFileSync(new URL('../mdpro/ShareSites/sitesshow/sitesshow-settings.html', import.meta.url), 'utf8');

const staticTools = [
  ['recent-work-visible', 'recent-work-name-visible'],
  ['chrome-split-tab-visible', 'chrome-split-tab-name-visible'],
  ['highlight-visible', 'highlight-name-visible'],
  ['macro-visible', 'macro-name-visible'],
  ['template-visible', 'template-name-visible'],
  ['template-new-file-visible', 'template-new-file-name-visible'],
  ['note-cover-insert-visible', 'note-cover-insert-name-visible'],
  ['pdf-merge-visible', 'pdf-merge-name-visible'],
  ['infographic-gemini-visible', 'infographic-gemini-name-visible'],
  ['infographic-auto-visible', 'infographic-auto-name-visible'],
  ['html2ppt-visible', 'html2ppt-name-visible'],
  ['fma-viewer-visible', 'fma-viewer-name-visible'],
  ['image-upload-toolbar-enabled', 'image-upload-toolbar-name-visible']
];

test('feature display settings expose independent button and name controls for every static tool', () => {
  for (const [buttonId, nameId] of staticTools) {
    assert.match(html, new RegExp(`id="${buttonId}"`));
    assert.match(html, new RegExp(`id="${nameId}"`));
  }
});

test('dynamic Scholar, Share, and Sites tools expose button and name controls', () => {
  assert.match(scholar, /id="scholar-search-visible"/);
  assert.match(scholar, /id="scholar-search-name-visible"/);
  assert.match(shareSettings, /id="todocs-visible"/);
  assert.match(shareSettings, /id="todocs-name-visible"/);
  assert.match(sitesSettings, /id="sites-visible"/);
  assert.match(sitesSettings, /id="sites-name-visible"/);
  assert.match(shareToolbar, /id="btn-export-gdocs-name"/);
});

test('tool name preferences persist and override the global header style per tool', () => {
  assert.match(app, /const FEATURE_TOOL_NAME_BINDINGS = Object\.freeze/);
  assert.match(app, /async function toggleFeatureToolNameSetting\(key, checkbox\)/);
  assert.match(app, /await setAiSettings\(patch\)/);
  assert.match(app, /applyFeatureToolNameVisibility\(settings \|\| FIRST_RUN_AI_SETTINGS_DEFAULTS\)/);
  assert.match(css, /\.header-quick-tool\.feature-tool-name-visible/);
  assert.match(css, /\.header-quick-tool\.feature-tool-name-hidden/);
});

test('tools with optional names keep an icon reachable when their name is hidden', () => {
  for (const id of ['btn-chrome-split-tab', 'btn-image-upload-toolbar', 'btn-note-cover-insert', 'btn-macro-run']) {
    const start = html.indexOf(`id="${id}"`);
    assert.notEqual(start, -1);
    assert.match(html.slice(start, start + 650), /data-lucide=/);
  }
});

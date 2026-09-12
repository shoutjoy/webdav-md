import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../mdpro/js/UI_PV/minipv.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../mdpro/js/UI_PV/minipv.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');

test('miniPV is mounted as a fixed document-level panel', () => {
    assert.match(markup, /id="mini-preview-panel" class="[^"]*\bfixed\b/);
    assert.match(script, /document\.body\.appendChild\(miniPreviewPanel\)/);
    assert.match(script, /miniPreviewPanel\.style\.position = 'fixed'/);
});

test('miniPV reacts to AI JENA layout changes and avoids its visible rectangle', () => {
    assert.match(script, /getElementById\('ai-chat-panel'\)/);
    assert.match(script, /function avoidMiniPreviewObstructions/);
    assert.match(script, /addEventListener\('ai-jena-layout-change'/);
});

test('miniPV bottom and side resize handles have a practical hit area', () => {
    assert.match(styles, /\.mini-preview-resize-n, \.mini-preview-resize-s \{[^}]*height:12px/s);
    assert.match(styles, /\.mini-preview-resize-e, \.mini-preview-resize-w \{[^}]*width:12px/s);
});

test('miniPV supports broad vertical movement and resizing', () => {
    assert.match(script, /const minH = 96;/);
    assert.match(script, /const maxH = Math\.max\(minH, Math\.floor\(rect\.height \* 2\)\);/);
    assert.match(script, /const maxTop = Math\.max\(8, Math\.floor\(rect\.height - visibleEdge\)\);/);
    assert.match(styles, /#mini-preview-panel \{ min-width:180px; min-height:96px; \}/);
});

test('miniPV vertical bounds extend through the full MDPRO frame', () => {
    assert.match(script, /const viewportBottom = Math\.max\(rect\.bottom, Number\(window\.innerHeight\) \|\| rect\.bottom\);/);
    assert.match(script, /height: Math\.max\(1, viewportBottom - rect\.top\)/);
});

test('miniPV is fitted fully inside the visible viewport whenever it opens', () => {
    assert.match(script, /function clampMiniPreviewLayoutForOpening\(/);
    assert.match(script, /viewportWidth - rect\.left - margin/);
    assert.match(script, /viewportHeight - rect\.top - margin/);
    assert.match(script, /applyMiniPreviewLayout\(miniPreviewLayoutBeforeFullscreen \|\| getMiniPreviewLayoutFromLocal\(\) \|\| \{\}, true\)/);
});

test('miniPV renders the live editor value while edit mode is active', () => {
    assert.match(script, /function getMiniPreviewSourceMarkdown\(\)/);
    assert.match(script, /isEditMode && editorTextarea && typeof editorTextarea\.value === 'string'/);
    assert.match(script, /const raw = getMiniPreviewSourceMarkdown\(\);/);
    assert.match(script, /renderMiniPreviewToc\(getMiniPreviewSourceMarkdown\(\)\)/);
});

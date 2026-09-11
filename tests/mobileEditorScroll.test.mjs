import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileCss = readFileSync(new URL('../mdpro/MobileUI/mobile-ui.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');

test('mobile continuous editor keeps the textarea as the vertical scroll owner', () => {
    assert.match(mobileCss, /#content-viewport\.long-document-active\s*\{[^}]*overflow-y:\s*hidden\s*!important/s);
    assert.match(mobileCss, /#content-viewport\.long-document-active #editor-doc-wrap\s*\{[^}]*height:\s*100%\s*!important[^}]*overflow:\s*hidden/s);
    assert.match(mobileCss, /#content-viewport\.long-document-active #viewer-edit-ta\s*\{[^}]*height:\s*100%\s*!important[^}]*overflow-y:\s*auto[^}]*touch-action:\s*pan-y/s);
});

test('document jump controls target the mobile textarea', () => {
    assert.match(appJs, /mobileContinuousEditor[\s\S]*body\.classList\.contains\('mobile-ui-active'\)[\s\S]*if \(mobileContinuousEditor && editorTextarea\) return editorTextarea;/);
});

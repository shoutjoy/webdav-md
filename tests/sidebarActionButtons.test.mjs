import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync(new URL('../mdpro/sidebar_left/sidebar-left.js', import.meta.url), 'utf8');
const github = readFileSync(new URL('../mdpro/js/GithubData/github-app.js', import.meta.url), 'utf8');

test('cache and GitHub sync actions render as icon-only buttons', () => {
    assert.match(sidebar, /id="btn-github-sync"[^\n]*h-9 w-9/);
    assert.match(sidebar, /id="btn-clear-unused-cache"[^\n]*h-9 w-9/);
    assert.doesNotMatch(sidebar, /id="github-sync-label"/);
    assert.doesNotMatch(sidebar, /<span class="sidebar-text">MDpro Viewer<\/span>/);
});

test('sync button hover text contains the configured repository address', () => {
    assert.match(github, /const labelTarget = cfg\.repoWithPath \|\| cfg\.repo;/);
    assert.match(github, /'GitHub Pull 동기화: ' \+ labelTarget/);
    assert.match(github, /syncBtn\.title = syncTitle;/);
    assert.match(github, /syncBtn\.setAttribute\('aria-label', syncTitle\);/);
});

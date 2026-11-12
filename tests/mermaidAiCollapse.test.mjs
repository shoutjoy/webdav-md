import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const css = readFileSync('mdpro/js/mermaid/mermaid-editor/style.css','utf8');
const html = readFileSync('mdpro/js/mermaid/mermaid-editor/index.html','utf8');
const app = readFileSync('mdpro/js/mermaid/mermaid-editor/app.js','utf8');
test('collapsed AI area keeps its controls reachable through expansion',()=>{
 assert.match(css, /ai-collapsed #mermaid-ai-model-settings/);
 assert.match(css, /ai-collapsed \.mermaid-reference-card/);
 assert.match(css, /ai-collapsed \.mermaid-run-feedback/);
 assert.match(html, /id="mermaid-ai-collapse-btn"/);
});
test('editor loads versioned picker and quality helper before the application',()=>{
 assert.match(html,/style\.css\?v=20261110-me-ai-1/);
 assert(html.indexOf('task-provider-picker.js') < html.indexOf('src="app.js'));
 assert(html.indexOf('ai-quality.js') < html.indexOf('src="app.js'));
});
test('model settings retain the existing toggle ID and remembered collapsed state',()=>{
 assert.match(html,/summary id="mermaid-ai-provider-toggle-btn" aria-expanded="false"/);
 assert.match(app,/mdv_mermaid_ai_provider_collapsed_v1/);
 assert.match(app,/mermaidModelSettings.open = localStorage/);
});

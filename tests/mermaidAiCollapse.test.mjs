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
 assert.match(html,/style\.css\?v=20261112-webdav-jena-1/);
 assert(html.indexOf('task-provider-picker.js') < html.indexOf('src="app.js'));
 assert(html.indexOf('ai-quality.js') < html.indexOf('src="app.js'));
});
test('model settings retain the toggle ID and open within the expanded Jena panel',()=>{
 assert.match(html,/summary id="mermaid-ai-provider-toggle-btn" aria-expanded="false"/);
 assert.match(app,/mdv_mermaid_ai_provider_collapsed_v1/);
 assert.match(app,/mermaidModelSettings.open = true/);
 assert.match(css, /#image-to-mermaid\.ai-collapsed > #mermaid-ai-model-settings \{ display:none; \}/);
});

test('open model details cannot override the collapsed parent and disclosure has its own row',()=>{
 assert.match(css, /#image-to-mermaid:not\(\.ai-collapsed\) > #mermaid-ai-model-settings\[open\] \{ display:flex;/);
 assert.doesNotMatch(css, /#image-to-mermaid > #mermaid-ai-model-settings\[open\] \{ display:flex;/);
 assert.match(css, /#image-to-mermaid > #mermaid-ai-collapse-btn \{ position:static; grid-row:1; \}/);
 assert.match(css, /#image-to-mermaid > #mermaid-ai-model-settings \{ grid-row:2; min-width:0; \}/);
 assert.match(css, /#image-to-mermaid #mermaid-ai-provider-picker > button \{ font-size:12px;/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/app.js', import.meta.url), 'utf8');

test('collapsed Mermaid AI area hides its dynamically mounted provider controls', () => {
  assert.match(css, /#image-to-mermaid\.ai-collapsed \.ai-tool-provider-controls \{ display:none !important; \}/);
});

test('Mermaid editor loads the cache-busted collapse stylesheet', () => {
  assert.match(html, /style\.css\?v=20261021-ai-inline-21/);
});

test('expanded AI area keeps provider controls independently collapsed by default', () => {
  assert.match(html, /id="mermaid-ai-provider-toggle-btn"[^>]+aria-expanded="false"/);
  assert.match(css, /#image-to-mermaid\.ai-provider-collapsed \.ai-tool-provider-controls \{ display:none !important; \}/);
  assert.match(app, /const MERMAID_AI_PROVIDER_COLLAPSED_KEY = 'mdv_mermaid_ai_provider_collapsed_v1'/);
  assert.match(app, /function initMermaidAiProviderControlsState\(\) \{[\s\S]*?let collapsed = true;/);
  assert.match(app, /initMermaidAiProviderControlsState\(\);/);
});

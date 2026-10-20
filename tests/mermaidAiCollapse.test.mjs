import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../mdpro/js/mermaid/mermaid-editor/index.html', import.meta.url), 'utf8');

test('collapsed Mermaid AI area hides its dynamically mounted provider controls', () => {
  assert.match(css, /#image-to-mermaid\.ai-collapsed \.ai-tool-provider-controls[\s\S]*?\{ display:none; \}/);
});

test('Mermaid editor loads the cache-busted collapse stylesheet', () => {
  assert.match(html, /style\.css\?v=20261021-ai-collapse-18/);
});

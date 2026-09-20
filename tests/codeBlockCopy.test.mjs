import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../mdpro/css/style.css', import.meta.url), 'utf8');

test('rendered code blocks receive an accessible copy button', () => {
  assert.match(appSource, /function hydrateCodeBlockCopyButtons\(container\)/);
  assert.match(appSource, /querySelectorAll\('pre > code'\)/);
  assert.match(appSource, /button\.className = 'md-code-copy-button no-print'/);
  assert.match(appSource, /button\.setAttribute\('aria-label', '코드 복사'\)/);
  assert.match(appSource, /copyCodeBlockText\(code\.textContent \|\| '', doc\)/);
  assert.match(appSource, /hydrateCodeBlockCopyButtons\(container\)/);
});

test('code copy supports the Clipboard API and a legacy fallback', () => {
  assert.match(appSource, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(appSource, /fallbackCopyCodeBlockText\(value, ownerDocument\)/);
  assert.match(appSource, /doc\.execCommand\('copy'\)/);
});

test('copy button appears on hover or keyboard focus and stays out of print', () => {
  assert.match(styles, /pre\.md-code-copy-ready:hover > \.md-code-copy-button/);
  assert.match(styles, /pre\.md-code-copy-ready:focus-within > \.md-code-copy-button/);
  assert.match(styles, /\.no-print \{ display: none !important; \}/);
});

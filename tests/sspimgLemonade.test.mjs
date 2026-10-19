import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../mdpro/sidebarAI/sidebar-ai.js', import.meta.url), 'utf8');

test('sspimgAI exposes AI Studio and Lemonade image providers with independent model selection', () => {
  assert.match(sidebar, /providerSel\.id = 'ssp-provider'/);
  assert.match(sidebar, /AI Studio \(Gemini\)/);
  assert.match(sidebar, /Lemonade 로컬 이미지/);
  assert.match(sidebar, /refreshLemonadeImageModels/);
  assert.match(sidebar, /generateImage\(prompt, \{ provider: imageProvider/);
  assert.match(app, /ss_image_model_lemonade/);
  assert.match(app, /getCachedLemonadeImageModels/);
});

test('sspimgAI routes Lemonade generation and seed-image editing to their native endpoints', () => {
  assert.match(app, /function generateLemonadeSspImage\(prompt, options, signal\)/);
  assert.match(app, /openAICompatibleRequestUrl\(connection, 'images\/generations'\)/);
  assert.match(app, /openAICompatibleRequestUrl\(connection, 'images\/edits'\)/);
  assert.match(app, /form\.append\('image'/);
  assert.match(app, /imageProvider === 'lemonade'/);
  assert.match(app, /response_format: 'b64_json'/);
});

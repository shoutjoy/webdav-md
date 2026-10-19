import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const ttsSource = readFileSync(new URL('../mdpro/Apps/textToAudio/tts_creator.tsx', import.meta.url), 'utf8');

test('standalone app ships browser-safe React and its own compiled styles', () => {
  const bundle = readFileSync(new URL('../mdpro/Apps/textToAudio/tts-creator.bundle.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../mdpro/Apps/textToAudio/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../mdpro/Apps/textToAudio/tts-creator.css', import.meta.url), 'utf8');
  assert.doesNotMatch(bundle, /process\.env\.NODE_ENV/);
  assert.match(html, /href="\.\/tts-creator\.css/);
  assert.match(css, /\.bg-pink-50/);
  assert.match(css, /\.rounded-3xl/);
});

test('ENV exposes a microphone TTS2Audio tool and an internal app panel', () => {
  assert.match(indexSource, /id="tts2audio-visible"/);
  assert.match(indexSource, /id="tts2audio-name-visible"/);
  assert.match(indexSource, /id="tts2audio-open-from-settings"/);
  assert.match(indexSource, /id="btn-tts2audio"[\s\S]*?data-lucide="mic-2"/);
  assert.match(indexSource, /id="tts2audio-frame"[^>]+data-src="\.\/Apps\/textToAudio\/index\.html/);
  assert.match(appSource, /tts2audioVisible/);
  assert.match(appSource, /applyTts2AudioVisibility/);
});

test('TTS2Audio receives the protected AI Studio key without embedding it', () => {
  assert.match(appSource, /type: 'mdpro-tts2audio-context'/);
  assert.match(appSource, /getProtectedAiCredential\('gemini', 'ss_gemini_api_key'\)/);
  assert.match(ttsSource, /type: 'tts2audio-request-context'/);
  assert.match(ttsSource, /data\.type !== 'mdpro-tts2audio-context'/);
  assert.doesNotMatch(ttsSource, /const apiKey = ""/);
});

test('TTS2Audio popup supports edge and corner resizing', () => {
  for (const direction of ['n', 's', 'e', 'w', 'ne', 'se', 'sw', 'nw']) {
    assert.match(indexSource, new RegExp(`data-tts2audio-resize="${direction}"`));
  }
  assert.match(appSource, /bindTts2AudioPanelInteractions/);
  assert.match(appSource, /mode\.includes\('e'\)/);
  assert.match(appSource, /mode\.includes\('n'\)/);
});

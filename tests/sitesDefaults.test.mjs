import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const sitesSource = readFileSync(
  new URL('../mdpro/ShareSites/sitesshow/sitesshow.js', import.meta.url),
  'utf8'
);

test('Sites pre-registers the Gemini infographic batch app for new and existing lists', () => {
  assert.match(
    sitesSource,
    /const INFOGRAPHIC_BATCH_SITE_URL = 'https:\/\/share\.gemini\.google\/gbLtf5UsOzKs'/
  );
  assert.match(sitesSource, /item\.name === INFOGRAPHIC_BATCH_SITE_NAME[\s\S]*?infographicBatchSite\.url = INFOGRAPHIC_BATCH_SITE_URL/);
  assert.match(sitesSource, /DEFAULT_SITES_LIST\.filter\([\s\S]*?gemini\.google\.com\/share\//);
  assert.match(indexSource, /sitesshow\.js\?v=20261029-infographic-batch-link-1/);
});

test('Sites pre-registers TTS2Audio and migrates existing matching entries', () => {
  assert.match(sitesSource, /const TTS2AUDIO_SITE_NAME = 'TTS2Audio'/);
  assert.match(sitesSource, /const TTS2AUDIO_SITE_URL = 'https:\/\/gemini\.google\.com\/share\/c7f7b1435de1\?social_preview=false&skid=5242d8f3-71ff-4c13-8894-5ae8d15b552f'/);
  assert.match(sitesSource, /tts2audioSite\.name = TTS2AUDIO_SITE_NAME/);
  assert.match(sitesSource, /base\.push\(\{ name: TTS2AUDIO_SITE_NAME, url: TTS2AUDIO_SITE_URL \}\)/);
});

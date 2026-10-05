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
    /name: '인포그래픽 일괄작업', url: 'https:\/\/gemini\.google\.com\/share\/c008bb3f4c51\?skid=e25dc382-4e43-465e-b0e1-49ff3353204b'/
  );
  assert.match(sitesSource, /DEFAULT_SITES_LIST\.filter\([\s\S]*?gemini\.google\.com\/share\//);
  assert.match(indexSource, /sitesshow\.js\?v=20261005-infographic-batch-link-1/);
});

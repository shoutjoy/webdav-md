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
    /const INFOGRAPHIC_BATCH_SITE_URL = 'https:\/\/share\.gemini\.google\/c9j7dKVXR5Ay'/
  );
  assert.match(sitesSource, /item\.name === INFOGRAPHIC_BATCH_SITE_NAME[\s\S]*?infographicBatchSite\.url = INFOGRAPHIC_BATCH_SITE_URL/);
  assert.match(sitesSource, /DEFAULT_SITES_LIST\.filter\([\s\S]*?gemini\.google\.com\/share\//);
  assert.match(indexSource, /sitesshow\.js\?v=20261007-infographic-batch-link-1/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const htmlSource = readFileSync(new URL('../mdpro/index.html', import.meta.url), 'utf8');
const start = appSource.indexOf('function getRecentWorkVisibleFromSettings(settings)');
const featureSource = appSource.slice(start, appSource.indexOf('function applyChromeSplitTabVisibility', start));

test('app settings exposes the recent-work visibility checkbox', () => {
  assert.match(htmlSource, /id="recent-work-visible"[^>]+toggleRecentWorkVisibilitySection/);
  assert.match(htmlSource, /id="open-recent-work-menu-item"/);
});

test('recent-work menu remains visible by default and follows the saved checkbox value', () => {
  let hidden = false;
  let menuClosed = false;
  const menuItem = {
    classList: {
      toggle(name, force) {
        assert.equal(name, 'hidden');
        hidden = force;
      },
    },
  };
  const context = {
    document: { getElementById: id => id === 'open-recent-work-menu-item' ? menuItem : null },
    setOpenSourceMenuVisible(value) { menuClosed = value === false; },
    setAiSettings: async () => {},
    console,
  };

  vm.runInNewContext(featureSource, context);
  context.applyRecentWorkVisibility({});
  assert.equal(hidden, false);
  assert.equal(menuClosed, false);

  context.applyRecentWorkVisibility({ recentWorkVisible: false });
  assert.equal(hidden, true);
  assert.equal(menuClosed, true);
});

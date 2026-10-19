import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function fitPrintMath('), source.indexOf('function waitForPrintImages('));

function fixture(width, available = 680) {
  const attributes = new Map();
  const properties = new Map();
  const math = {
    style: {
      getPropertyValue: key => properties.get(key) || '',
      getPropertyPriority: () => '',
      setProperty: (key, value) => properties.set(key, value),
      removeProperty: key => properties.delete(key),
    },
    hasAttribute: key => attributes.has(key),
    setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: key => attributes.get(key),
    scrollWidth: width,
    getBoundingClientRect: () => ({ width: width * (Number(properties.get('zoom')) || 1) }),
  };
  let rootStyle = 'original';
  const root = {
    style: { cssText: rootStyle }, clientWidth: 680,
    ownerDocument: { defaultView: { getComputedStyle: node => node === math ? { zoom: properties.get('zoom') || '1' } : { paddingLeft: '0', paddingRight: '0' } } },
    getAttribute: () => rootStyle,
    setAttribute: (_, value) => { rootStyle = value; },
    querySelectorAll: () => [{ parentElement: { clientWidth: available }, querySelector: selector => selector === 'mjx-math' ? math : null }],
  };
  const context = { root };
  runInNewContext(helper + '\nfitPrintMath(root);', context);
  return { zoom: () => Number(properties.get('zoom')) || 1, again: () => runInNewContext('fitPrintMath(root)', context), rootStyle: () => rootStyle };
}

test('long print formulas fit the paper and repeated preparation does not shrink them again', () => {
  const formula = fixture(1000);
  assert.equal(formula.zoom(), 0.678);
  formula.again();
  assert.equal(formula.zoom(), 0.678);
  assert.equal(formula.rootStyle(), 'original');
});
test('short formulas retain their size; list and table formulas respect their narrower container', () => {
  assert.equal(fixture(240).zoom(), 1);
  assert.equal(fixture(1000, 520).zoom(), 0.518);
});

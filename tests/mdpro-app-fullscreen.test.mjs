import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('embedded fullscreen expands the app panel and restores without browser fullscreen', () => {
  const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function getAppFullscreenHost()'), source.indexOf("document.addEventListener('fullscreenchange', syncAppFullscreenButton)"));
  const classes = new Set();
  const panel = { classList: {
    contains: name => classes.has(name),
    toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
  }, requestFullscreen: () => assert.fail('must not request browser fullscreen') };
  const parentDocument = { body: { classList: { toggle() {} } }, exitFullscreen: () => assert.fail('must not exit browser fullscreen') };
  const context = vm.createContext({
    window: { frameElement: { closest: () => panel }, parent: { document: parentDocument } },
    document: { getElementById: () => null },
  });
  vm.runInContext(code, context);
  assert.equal(context.isAppFullscreenActive(), false);
  context.toggleAppFullscreen();
  assert.equal(classes.has('is-app-fullscreen'), true);
  assert.equal(context.isAppFullscreenActive(), true);
  context.toggleAppFullscreen();
  assert.equal(classes.has('is-app-fullscreen'), false);
});

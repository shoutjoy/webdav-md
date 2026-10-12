import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createServer } from 'vite';

test('Vite serves background removal as an executable classic script', async () => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const result = await server.transformRequest('/mdpro/Apps/fmaviewer/js/image/backgroundRemove.js');
    assert.ok(result?.code);
    const script = new vm.Script(result.code);
    const context = vm.createContext({ document: { addEventListener() {} } });
    script.runInContext(context);
    assert.equal(typeof context.openBackgroundRemoveEditor, 'function');
    assert.equal(typeof context.openBackgroundRemoveEditorForExternal, 'function');
    assert.equal(typeof context.initBackgroundRemoveFeature, 'function');
  } finally {
    await server.close();
  }
});

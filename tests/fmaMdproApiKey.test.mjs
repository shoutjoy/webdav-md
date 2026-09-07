import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/Apps/fmaviewer/js/image/imageUpscale.js', import.meta.url), 'utf8');
function host(key = '') {
    const values = new Map([['ss_gemini_api_key', key]]);
    const result = {
        document: { querySelector: () => null },
        localStorage: { getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value) }
    };
    result.parent = result;
    return result;
}
function setup(window) {
    const elements = {};
    const dom = new Proxy(elements, { get(target, name) {
        return target[name] ||= { value: '', style: {}, classList: { toggle() {} }, addEventListener() {}, focus() {} };
    } });
    const context = vm.createContext({ window, localStorage: window.localStorage, dom, images: [],
        document: { addEventListener() {}, querySelectorAll: () => [] } });
    vm.runInContext(source + '\ninitUpscaleFeature();', context);
    return { dom, context };
}

test('import button reads unlocked MDPro sibling vault and Apply saves the imported key', () => {
    const fma = host();
    const shell = host();
    const mdpro = host();
    mdpro.getProtectedAiCredential = () => 'mdpro-key';
    mdpro.MDPCredentialVault = { getSecret: id => id === 'gemini' ? 'mdpro-key' : '', getStatus: () => ({ locked: false }) };
    shell.document.querySelector = selector => selector === 'iframe.mdpro-frame' ? { contentWindow: mdpro } : null;
    fma.parent = shell;
    const { dom, context } = setup(fma);
    dom.btnImportMdproApiKey.onclick();
    assert.equal(dom.aiStudioApiKey.value, 'mdpro-key');
    assert.equal(dom.aiStudioApiKey.type, 'password');
    dom.btnApplySharedApiKey.onclick();
    assert.equal(vm.runInContext('getUsableAiStudioApiKey()', context), 'mdpro-key');
});

test('locked sibling vault does not import a stale plaintext key or replace the input', () => {
    const fma = host('stale');
    const mdpro = host('stale');
    mdpro.getProtectedAiCredential = () => '';
    mdpro.MDPCredentialVault = { getSecret: () => '', getStatus: () => ({ locked: true, entries: [{ id: 'gemini', configured: true }] }) };
    fma.parent = host();
    fma.parent.document.querySelector = () => ({ contentWindow: mdpro });
    const { dom } = setup(fma);
    dom.aiStudioApiKey.value = 'existing';
    dom.btnImportMdproApiKey.onclick();
    assert.equal(dom.aiStudioApiKey.value, 'existing');
    assert.match(dom.sharedApiKeyStatus.innerText, /잠금을 해제/);
});

test('standalone FMA imports shared local storage and reports a missing key', () => {
    for (const key of ['local-key', '']) {
        const { dom } = setup(host(key));
        dom.btnImportMdproApiKey.onclick();
        assert.equal(dom.aiStudioApiKey.value, key);
        if (!key) assert.match(dom.sharedApiKeyStatus.innerText, /키가 없습니다/);
    }
});

test('FMA opened in a new window can use the MDPro opener', () => {
    const fma = host();
    fma.opener = host();
    fma.opener.getProtectedAiCredential = () => 'opener-key';
    const { dom } = setup(fma);
    dom.btnImportMdproApiKey.onclick();
    assert.equal(dom.aiStudioApiKey.value, 'opener-key');
});

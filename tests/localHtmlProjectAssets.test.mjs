import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const explorerSource = fs.readFileSync(
    new URL('../mdpro/sidebar_left/local-folder-explorer.js', import.meta.url),
    'utf8'
);
const appSource = fs.readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');

function loadLocalJavaScriptPreviewHelpers(files) {
    const helperStart = appSource.indexOf('function makeLocalJavaScriptDataUrl(');
    const helperEnd = appSource.indexOf('async function prepareLocalHtmlDocumentForPreview(', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart);
    const context = {
        encodeURIComponent,
        Set,
        isLocalHtmlAssetUrl(value) {
            const url = String(value || '').trim();
            return !!url && url.charAt(0) !== '#'
                && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url);
        },
        async replaceAsync(value, pattern, replacer) {
            const source = String(value || '');
            const matches = Array.from(source.matchAll(pattern));
            const replacements = await Promise.all(matches.map(match => replacer(...match)));
            let cursor = 0;
            let output = '';
            matches.forEach((match, index) => {
                output += source.slice(cursor, match.index) + replacements[index];
                cursor = match.index + match[0].length;
            });
            return output + source.slice(cursor);
        },
        async resolveLocalHtmlAsset(modulePath, requestUrl) {
            const key = modulePath + '|' + requestUrl;
            const record = files.get(key);
            return record ? { path: record.path, file: { text: async () => record.source } } : null;
        }
    };
    vm.runInNewContext(appSource.slice(helperStart, helperEnd), context);
    return context;
}

function fakeScript(attributes) {
    const values = new Map(Object.entries(attributes || {}));
    return {
        textContent: '',
        ownerDocument: { body: { appendChild() {} } },
        getAttribute: name => values.has(name) ? values.get(name) : null,
        setAttribute: (name, value) => values.set(name, String(value)),
        removeAttribute: name => values.delete(name),
        hasAttribute: name => values.has(name),
        attributes: values
    };
}

function fileHandle(name, text) {
    const file = { name, text: async () => text };
    return { name, kind: 'file', getFile: async () => file };
}

function directoryHandle(name, children) {
    return {
        name,
        kind: 'directory',
        queryPermission: async () => 'granted',
        async *values() { yield* Object.values(children); },
        async getDirectoryHandle(childName) {
            const child = children[childName];
            if (!child || child.kind !== 'directory') throw new Error('Directory not found');
            return child;
        },
        async getFileHandle(childName) {
            const child = children[childName];
            if (!child || child.kind !== 'file') throw new Error('File not found');
            return child;
        }
    };
}

test('local folder explorer resolves HTML project assets relative to the opened document', async () => {
    const src = directoryHandle('src', {
        'index.html': fileHandle('index.html', '<html></html>'),
        'style.css': fileHandle('style.css', 'body { color: red; }'),
        js: directoryHandle('js', { 'app.js': fileHandle('app.js', 'window.ready = true;') })
    });
    const root = directoryHandle('Player', { src });
    const window = { showDirectoryPicker: async () => root };
    const context = {
        window,
        document: { readyState: 'loading', addEventListener() {} },
        indexedDB: undefined
    };
    vm.runInNewContext(explorerSource, context);
    await window.LocalFolderExplorer.activate();

    assert.equal(
        window.LocalFolderExplorer.resolveProjectFilePath('Player/src/index.html', './style.css?rev=2#top').path,
        'Player/src/style.css'
    );
    assert.equal(
        window.LocalFolderExplorer.resolveProjectFilePath('Player/src/index.html', '/src/js/app.js').path,
        'Player/src/js/app.js'
    );
    assert.equal(window.LocalFolderExplorer.resolveProjectFilePath('Player/src/index.html', '../../secret.js'), null);
    assert.equal(window.LocalFolderExplorer.resolveProjectFilePath('Player/src/index.html', 'https://cdn.test/app.js'), null);

    const resolved = await window.LocalFolderExplorer.getProjectFile('Player/src/index.html', './js/app.js');
    assert.equal(resolved.path, 'Player/src/js/app.js');
    assert.equal(await resolved.file.text(), 'window.ready = true;');
});

test('local CSS preparation inlines imports and converts nested asset URLs to blob URLs', async () => {
    const helperStart = appSource.indexOf('function isLocalHtmlAssetUrl(');
    const helperEnd = appSource.indexOf('async function prepareLocalHtmlDocumentForPreview(', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart);

    const files = new Map([
        ['Player/src/theme/base.css', { name: 'base.css', text: async () => '.icon{src:url("../../assets/font.woff2")}'}],
        ['Player/images/bg.png', { name: 'bg.png' }],
        ['Player/assets/font.woff2', { name: 'font.woff2' }]
    ]);
    const paths = {
        'Player/src/style.css|./theme/base.css': 'Player/src/theme/base.css',
        'Player/src/style.css|../images/bg.png': 'Player/images/bg.png',
        'Player/src/theme/base.css|../../assets/font.woff2': 'Player/assets/font.woff2'
    };
    const context = {
        window: {
            LocalFolderExplorer: {
                async getProjectFile(documentPath, requestUrl) {
                    const path = paths[documentPath + '|' + requestUrl];
                    return path && files.has(path) ? { path, file: files.get(path) } : null;
                }
            }
        },
        URL: { createObjectURL: file => 'blob:' + file.name },
        htmlPreviewLocalObjectUrls: [],
        Set
    };
    vm.runInNewContext(appSource.slice(helperStart, helperEnd), context);
    const css = await context.prepareLocalCssForHtmlPreview(
        '@import "./theme/base.css" screen; body{background:url(../images/bg.png)}',
        'Player/src/style.css',
        0,
        new Set(['Player/src/style.css'])
    );
    assert.match(css, /@media screen/);
    assert.match(css, /blob:font\.woff2/);
    assert.match(css, /blob:bg\.png/);
});

test('main HTML rendering prepares local project resources before assigning iframe srcdoc', () => {
    assert.match(appSource, /await prepareLocalHtmlDocumentForPreview\(htmlDocument, currentLocalFileRef\.path\)/);
    assert.match(appSource, /querySelectorAll\('script\[src\]'\)/);
    assert.match(appSource, /querySelectorAll\('link\[href\]'\)/);
    assert.match(appSource, /renderHtmlDocumentFrame\(viewer, preparedHtmlDocument/);
});

test('local JavaScript is inlined so sandboxed previews can execute it', () => {
    assert.match(appSource, /async function inlineLocalHtmlScript\(script, documentPath\)/);
    assert.match(appSource, /script\.removeAttribute\('src'\)/);
    assert.match(appSource, /script\.textContent = escapeInlineLocalScript\(/);
    assert.match(appSource, /await inlineLocalHtmlScript\(script, documentPath\)/);
    assert.doesNotMatch(
        appSource.slice(
            appSource.indexOf("for (const script of Array.from(parsed.querySelectorAll('script[src]')))"),
            appSource.indexOf('const assetAttributes =', appSource.indexOf("for (const script of Array.from(parsed.querySelectorAll('script[src]')))"))
        ),
        /registerHtmlPreviewLocalObjectUrl/
    );
});

test('inlined local JavaScript executes DOM interactions without a blob URL', async () => {
    const source = "document.querySelector('#run').onclick = () => { document.body.dataset.state = 'working'; };";
    const helpers = loadLocalJavaScriptPreviewHelpers(new Map([
        ['Player/index.html|./app.js', { path: 'Player/app.js', source }]
    ]));
    const script = fakeScript({ src: './app.js', defer: '' });
    assert.equal(await helpers.inlineLocalHtmlScript(script, 'Player/index.html'), true);
    assert.equal(script.attributes.has('src'), false);
    assert.equal(script.attributes.has('defer'), false);

    const button = {};
    const previewDocument = {
        body: { dataset: {} },
        querySelector: selector => selector === '#run' ? button : null
    };
    vm.runInNewContext(script.textContent, { document: previewDocument });
    button.onclick();
    assert.equal(previewDocument.body.dataset.state, 'working');
});

test('inline scripts cannot terminate their serialized script element early', async () => {
    const source = "window.template = '</script><button>unsafe</button>';";
    const helpers = loadLocalJavaScriptPreviewHelpers(new Map([
        ['Player/index.html|./app.js', { path: 'Player/app.js', source }]
    ]));
    const script = fakeScript({ src: './app.js' });
    await helpers.inlineLocalHtmlScript(script, 'Player/index.html');
    assert.doesNotMatch(script.textContent, /<\/script/i);
    assert.match(script.textContent, /<\\\/script/i);
});

test('local JavaScript modules rewrite static and dynamic relative imports', () => {
    assert.match(appSource, /prepareLocalJavaScriptModuleForPreview/);
    assert.match(appSource, /\(\\b\(\?:import\|export\)\\s\+/);
    assert.match(appSource, /\(\\bimport\\s\*\\\(\\s\*\)/);
    assert.match(appSource, /makeLocalJavaScriptDataUrl/);
});

test('module preparation resolves nested local imports into executable data URLs', async () => {
    const helpers = loadLocalJavaScriptPreviewHelpers(new Map([
        ['Player/app.js|./utils.js', {
            path: 'Player/utils.js',
            source: "export const value = 7; export const lazy = () => import('./lazy.js');"
        }],
        ['Player/utils.js|./lazy.js', {
            path: 'Player/lazy.js',
            source: 'export default 9;'
        }]
    ]));
    const prepared = await helpers.prepareLocalJavaScriptModuleForPreview(
        "import { value } from './utils.js'; window.result = value;",
        'Player/app.js',
        0,
        new Set(['Player/app.js'])
    );
    assert.doesNotMatch(prepared, /from ['"]\.\/utils\.js/);
    assert.match(prepared, /from ['"]data:text\/javascript;charset=utf-8,/);
    assert.match(decodeURIComponent(prepared), /import\(['"]data:text\/javascript;charset=utf-8,/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../mdpro/js/UI_PV/minipv.js', import.meta.url), 'utf8');
const render = script.slice(script.indexOf('function renderMiniPreviewContent()'), script.indexOf('function bindMiniPreviewInteractions()'));

function setup(hasMermaid, renderer) {
    const root = { innerHTML: '', classList: { remove() {} } };
    const snapshot = { renderSource: '```\nflowchart TD\nA-->B\n```', features: { hasMermaid } };
    const context = {
        miniPreviewContent: root, miniPreviewEnabled: true, isEditMode: true,
        miniPreviewViewMode: 'preview', miniPreviewRenderToken: 0,
        previewInternalImageObjectUrls: [], window: { MermaidTRT: { renderIn: renderer } },
        getMiniPreviewSourceMarkdown: () => snapshot.renderSource,
        prepareMarkdownRenderSnapshot: () => snapshot,
        isMarkdownRenderSnapshotCurrent: () => true,
        renderMarkdownSnapshotToHtml: async () => '<pre><code>flowchart TD\nA--&gt;B</code></pre>',
        revokeObjectUrls() {}, prepareMiniPreviewResponsiveTables() {},
        applyMiniPreviewZoom() {}, scheduleMiniPreviewScrollSync() {}, applyMiniPreviewLineSync() {}
    };
    vm.runInNewContext(render, context);
    return { context, root };
}

for (const tagged of [false, true]) {
    test(`miniPV delegates ${tagged ? 'tagged' : 'untagged'} diagrams to the shared renderer`, async () => {
        let received;
        const { context, root } = setup(tagged, async target => { received = target; });
        context.renderMiniPreviewContent();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(received, root);
        assert.match(root.innerHTML, /flowchart TD/);
    });
}

test('a completed stale Mermaid render cannot trigger preview scroll sync', async () => {
    let finish;
    const { context } = setup(false, () => new Promise(resolve => { finish = resolve; }));
    let syncs = 0;
    context.applyMiniPreviewLineSync = () => { syncs += 1; };
    context.renderMiniPreviewContent();
    await new Promise(resolve => setImmediate(resolve));
    const before = syncs;
    context.miniPreviewRenderToken += 1;
    finish();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(syncs, before);
});

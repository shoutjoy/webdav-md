import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('../mdpro/js/note-cover/note-cover.js', import.meta.url), 'utf8'), context);
const cover = context.window.NoteCoverRenderer;
const appSource = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');

test('cover deletion requires approval and cancellation leaves the document untouched', () => {
    const start = appSource.indexOf('function removeNoteCover()');
    const end = appSource.indexOf('\nfunction closeNoteCoverMenu()', start);
    for (const approved of [false, true]) {
        let applied = 0;
        let prompted = 0;
        const sandbox = {
            closeNoteCoverMenu() {},
            window: { NoteCoverRenderer: cover, confirm(message) {
                assert.equal(message, '표지를 지울까요?'); prompted++; return approved;
            } },
            getNoteCoverMarkdownSource: () => cover.insertDefaultCover('# 본문').markdown,
            isEditMode: true,
            applyNoteCoverMarkdownUpdate(result) { assert.equal(result.markdown, '# 본문'); applied++; return true; },
            showToast() {}
        };
        vm.runInNewContext(appSource.slice(start, end) + '\nremoveNoteCover();', sandbox);
        assert.equal(prompted, 1);
        assert.equal(applied, approved ? 1 : 0);
    }
});

test('entered fields survive serialization, including comment delimiters', () => {
    const fields = { title: '제목 "인용" -->', subtitle: '부제', author: '작성자 이름', date: '2026-09-08' };
    const result = cover.insertDefaultCover('# 본문', fields);
    const payload = JSON.parse(cover.findFirstCoverBlock(result.markdown).block.slice('<!-- note-cover'.length, -3));
    for (const [key, value] of Object.entries(fields)) {
        assert.equal(payload.elements.find(element => element.id === key).text, value);
    }
});

test('removing an inserted cover preserves the exact body', () => {
    for (const body of ['', '# 본문\n\n내용\n', '\n\n# 본문\r\n내용', '<!-- ordinary comment -->\n본문']) {
        const inserted = cover.insertDefaultCover(body, { title: '제목', subtitle: '', author: '', date: '' });
        assert.equal(cover.removeCover(inserted.markdown).markdown, body);
    }
});

test('missing cover is a no-op and duplicate insertion preserves the original', () => {
    assert.equal(cover.removeCover('# 본문').changed, false);
    const original = cover.insertDefaultCover('# 본문', { title: '기존' }).markdown;
    const duplicate = cover.insertDefaultCover(original, { title: '새 제목' });
    assert.equal(duplicate.changed, false);
    assert.equal(duplicate.markdown, original);
});

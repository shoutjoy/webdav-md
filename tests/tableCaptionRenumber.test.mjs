import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mdpro/js/app.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function renumberTableCaptions('), source.indexOf('function prepareCaptionPanel('));
const context = vm.createContext({});
vm.runInContext(functions, context);
const renumber = context.renumberTableCaptions;

test('renumbers mixed caption formats in source order and preserves titles and attributes', () => {
    const before = [
        '<span class="tbl-caption tbl-caption-align-left"><표 19> 제목에 표 27 참조</span>',
        '<span data-id="keep" class="tbl-caption tbl-caption-align-center">표 3. <b>설명</b></span>',
        "<span class='tbl-caption tbl-caption-align-right'>Table 3. Title &amp; text</span>",
        '<span class="tbl-caption">&lt;표 88&gt; 기존 문서</span>'
    ].join('\r\n\r\n');
    const result = renumber(before);
    assert.equal(result.count, 4);
    assert.equal(result.markdown, before.replace('<표 19>', '<표 1>').replace('표 3.', '표 2.').replace('&lt;표 88&gt;', '&lt;표 4&gt;'));
    assert.equal(renumber(result.markdown).changes.length, 0);
});

test('ignores references, figures, code examples and comments', () => {
    const caption = '<span class="tbl-caption"><표 99> 캡션</span>';
    const ignored = [
        '본문 <표 43> 참조 / Table 70.',
        '<span class="tbl-caption">[그림 9] 설명</span>',
        '<span class="other-tbl-caption"><표 8> 일반 텍스트</span>',
        '```html\n' + caption + '\n```',
        '~~~html\n' + caption + '\n~~~',
        '`' + caption + '`',
        '<!--\n' + caption + '\n-->'
    ].join('\n\n');
    assert.equal(renumber(ignored).count, 0);
    assert.equal(renumber(ignored).markdown, ignored);
    assert.equal(renumber(ignored + '\n' + caption).markdown, ignored + '\n' + caption.replace('99', '1'));
    assert.equal(renumber('```html\n' + caption).count, 0);
});

test('applies all changes as one editor transaction, updates next number and saves', () => {
    const input = '<span class="tbl-caption"><표 22> A</span>\n<span class="tbl-caption">표 8. B</span>';
    let transaction;
    let saved = false;
    let previewed = false;
    let event;
    const numberInput = { value: '99' };
    const textarea = {
        value: input, selectionStart: input.length, selectionEnd: input.length,
        scrollTop: 123, scrollLeft: 5,
        dispatchEvent(value) { event = value; },
        __mdCm6View: { dispatch(value) { transaction = value; } }
    };
    Object.assign(context, {
        syncEditModeStateFromDom() {}, isEditMode: true, editorTextarea: textarea,
        currentMarkdown: input, activeSidebarTab: '',
        Event: class { constructor(type) { this.type = type; } },
        getCaptionUi() { return { numberInput }; },
        updateCaptionInsertPreview() { previewed = true; },
        renderMarkdown() {}, performAutoSave() { saved = true; }, showToast() {}
    });
    context.renumberTableCaptionsInDocument();
    assert.equal(transaction.changes.length, 2);
    assert.equal(transaction.selection.anchor, input.length - 1);
    assert.equal(context.currentMarkdown, renumber(input).markdown);
    assert.equal(numberInput.value, '3');
    assert.equal(event.type, 'input');
    assert.ok(saved && previewed);
    assert.equal(textarea.scrollTop, 123);
});

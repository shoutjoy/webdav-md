import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Deterministic layout model exercises real editor event handlers without a browser.
function setup(createAllowed = true) {
    const elements = new Map();
    class Element {
        constructor(tag) {
            this.tag = tag; this.nodeType = 1; this.children = []; this.listeners = {}; this.value = '';
            this.style = {}; this.dataset = {}; this.textContent = ''; this.scrollTop = 0;
            this.selectionStart = this.selectionEnd = 0;
            this.isConnected = true;
            const classes = new Set();
            this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
        }
        set id(value) { elements.set(value, this); this._id = value; }
        get id() { return this._id; }
        get clientWidth() { return this.parent?.dataset.orientation === 'landscape' ? 100 : 80; }
        get clientHeight() { return this.parent?.dataset.orientation === 'landscape' ? 52 : 78; }
        get childNodes() { return this.children; }
        get scrollHeight() { return this.children.length * 26; }
        querySelectorAll(selector) {
            if (selector.includes('a4-view-section')) return this.children.filter(el => el.className === 'a4-view-section');
            if (selector.includes('a4-sheet')) return this.children.filter(el => el.className === 'a4-sheet');
            return [];
        }
        append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
        remove() { this.parent.children = this.parent.children.filter(item => item !== this); this.isConnected = false; }
        replaceChildren() { this.children.forEach(item => { item.isConnected = false; }); this.children = []; }
        setAttribute() {}
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
        dispatchEvent(event) { (this.listeners[event.type] || []).forEach(callback => callback(event)); }
        focus() { document.activeElement = this; this.dispatchEvent({ type: 'focus' }); }
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
        scrollIntoView() {}
        getBoundingClientRect() {
            const columns = Math.floor((parseFloat(this.style.width) || 80) / 8);
            const lines = this.textContent.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / columns)), 0);
            return { height: this.id === 'a4-measure' ? lines * 26 : 78, top: 0, bottom: 78 };
        }
    }
    const handlers = {};
    const document = { createElement: tag => new Element(tag), getElementById: id => elements.get(id), body: new Element('body'), addEventListener: (name, handler) => { handlers[name] = handler; } };
    const source = new Element('textarea'); source.id = 'viewer-edit-ta';
    const viewport = new Element('div'); viewport.id = 'content-viewport';
    const window = {};
    const context = vm.createContext({ document, window, Event, setNewFileMenuVisible() {}, toggleMode() {},
        createNewFile() {
            if (!createAllowed) return false;
            source.value = ''; window.A4Pages.sync(''); return true;
        },
        updateContent(value) { source.value = value; window.A4Pages.sync(value); },
    });
    vm.runInContext(readFileSync(new URL('../mdpro/js/a4-pages.js', import.meta.url), 'utf8'), context);
    const host = elements.get('a4-pages');
    const inputs = () => host.children.filter(el => el.className === 'a4-sheet').map(el => el.children[0]);
    const type = (input, text) => { input.value = text; input.selectionStart = text.length; input.dispatchEvent({ type: 'input' }); };
    return { window, source, host, inputs, type, document, handlers };
}

test('A4 is opt-in and original blank documents retain the original editor', () => {
    const env = setup();
    assert.equal(env.host.hidden, true);
    env.window.createA4File('portrait');
    assert.equal(env.inputs().length, 1);
    assert.match(env.source.value, /mdpro-a4: portrait/);
    env.window.A4Pages.sync('ordinary markdown');
    assert.equal(env.host.hidden, true);
});

test('canceling new A4 creation preserves the current document', () => {
    const env = setup(false);
    env.source.value = 'keep this document';
    env.window.A4Pages.sync(env.source.value);
    env.window.createA4File('landscape');
    assert.equal(env.source.value, 'keep this document');
    assert.equal(env.host.hidden, true);
});

test('long and A4 layouts convert in both directions without losing content', () => {
    const env = setup();
    const original = '# 긴 문서\n\n첫 문단\n둘째 문단';
    env.source.value = original;
    env.window.A4Pages.sync(original);

    assert.equal(env.window.A4Pages.convertLayout('landscape'), true);
    assert.equal(env.host.hidden, false);
    assert.match(env.source.value, /^<!-- mdpro-a4: landscape -->/);
    assert.match(env.source.value, /첫 문단\n둘째 문단$/);

    assert.equal(env.window.A4Pages.convertLayout('long'), true);
    assert.equal(env.host.hidden, true);
    assert.equal(env.source.value, original);
});

test('layout buttons wait for a required save before converting', async () => {
    const env = setup();
    env.source.value = '저장 전 내용';
    env.window.A4Pages.sync(env.source.value);
    let allowConversion = false;
    let saveRequests = 0;
    env.window.saveBeforeA4LayoutChange = async () => {
        saveRequests += 1;
        return allowConversion;
    };

    assert.equal(await env.window.convertCurrentPageLayout('portrait'), false);
    assert.equal(env.source.value, '저장 전 내용');
    allowConversion = true;
    assert.equal(await env.window.convertCurrentPageLayout('portrait'), true);
    assert.match(env.source.value, /^<!-- mdpro-a4: portrait -->/);
    assert.equal(saveRequests, 2);
});

test('explicit A4 page breaks become line breaks when converting to a long page', () => {
    const env = setup();
    env.window.createA4File('portrait');
    env.type(env.inputs()[0], '첫 페이지');
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    env.type(env.inputs()[1], '둘째 페이지');

    env.window.A4Pages.convertLayout('long');
    assert.equal(env.source.value, '첫 페이지\n둘째 페이지');
});

test('floating +P action adds a page only while A4 layout is active', () => {
    const env = setup();
    assert.equal(env.window.A4Pages.addPage(), false);
    env.window.createA4File('portrait');
    assert.equal(env.inputs().length, 1);
    assert.equal(env.window.A4Pages.addPage(), true);
    assert.equal(env.inputs().length, 2);
});

test('individual page directions survive reopening and whole-document changes clear overrides', () => {
    const env = setup();
    env.window.createA4File('portrait');
    env.type(env.inputs()[0], '첫 페이지');
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    env.type(env.inputs()[1], '둘째 페이지');
    env.window.A4Pages.changeDirection('landscape', 1);
    const sheets = () => env.host.children.filter(el => el.className === 'a4-sheet');
    assert.deepEqual(sheets().map(el => el.dataset.orientation), ['portrait', 'landscape']);
    const saved = env.source.value;
    assert.match(saved, /mdpro-a4-orientations: portrait,landscape/);
    env.window.A4Pages.sync('ordinary');
    env.window.A4Pages.sync(saved);
    assert.deepEqual(sheets().map(el => el.dataset.orientation), ['portrait', 'landscape']);
    env.inputs()[1].setSelectionRange(2, 4);
    env.inputs()[1].dispatchEvent({ type: 'select' });
    assert.equal(env.source.selectionStart, saved.indexOf('둘째 페이지') + 2);
    env.window.A4Pages.changeDirection('landscape');
    assert.ok(sheets().every(el => el.dataset.orientation === 'landscape'));
    assert.ok(!env.source.value.includes('mdpro-a4-orientations'));
    assert.deepEqual(env.inputs().map(el => el.value), ['첫 페이지', '둘째 페이지']);
});

test('direction changes reflow automatic pages without losing text', () => {
    const env = setup();
    env.window.createA4File('portrait');
    const text = '한글 abc😀 '.repeat(50);
    env.type(env.inputs()[0], text);
    env.window.A4Pages.changeDirection('landscape', 1);
    assert.equal(env.inputs().map(el => el.value).join(''), text);
    env.window.A4Pages.changeDirection('landscape');
    assert.equal(env.inputs().map(el => el.value).join(''), text);
});

test('view renders whole Markdown sections, keeps blank pages, and applies page controls', async () => {
    const env = setup();
    env.window.createA4File('portrait');
    const markdown = '```js\n' + 'const a = 1;\n'.repeat(10) + '```';
    env.type(env.inputs()[0], markdown);
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    env.window.A4Pages.changeDirection('landscape', 1);
    const target = env.document.createElement('div');
    const calls = [];
    await env.window.A4Pages.renderView(target, env.source.value, async text => { calls.push(text); return text; }, () => true);
    assert.deepEqual(calls, [markdown, '']);
    assert.equal(target.classList.contains('a4-view'), true);
    env.window.A4Pages.paginateView(target);
    const sheets = target.children.filter(el => el.className === 'a4-sheet');
    assert.deepEqual(sheets.map(el => el.dataset.orientation), ['portrait', 'landscape']);
    assert.equal(sheets[1].children[2].children[1].textContent, 'A4 세로');
    assert.equal(sheets[1].children[2].children.at(-1).textContent, '긴 문서');
    assert.equal(await env.window.A4Pages.renderView(target, 'ordinary', () => { throw Error('should not render'); }, () => true), false);
    assert.equal(target.classList.contains('a4-view'), false);
});

test('a stale asynchronous view cannot overwrite a newer document', async () => {
    const env = setup();
    env.window.createA4File('portrait');
    const target = env.document.createElement('div');
    const sentinel = env.document.createElement('p');
    target.append(sentinel);
    await env.window.A4Pages.renderView(target, env.source.value, async () => 'old result', () => false);
    assert.equal(target.children[0], sentinel);
});

test('view settings start collapsed and preview reuses the exact view pages', async () => {
    const env = setup();
    env.window.createA4File('portrait');
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    const target = env.document.createElement('div');
    await env.window.A4Pages.renderView(target, env.source.value, async () => '', () => true);
    const floating = target.children[0];
    assert.equal(floating.className, 'a4-floating-settings no-print');
    assert.equal(floating.children[1].hidden, true);
    floating.children[0].dispatchEvent({ type: 'click', stopPropagation() {} });
    assert.equal(floating.children[1].hidden, false);
    env.window.A4Pages.paginateView(target);
    const expected = target.querySelectorAll(':scope > .a4-sheet');
    let mounted;
    env.window.A4Presentation = { mount: (_, sheets) => { mounted = sheets; } };
    await env.window.A4Pages.preview({ closed: false }, env.source.value);
    assert.equal(mounted.length, 2);
    assert.equal(mounted[0], expected[0]);
    assert.equal(mounted[1], expected[1]);
});

test('Ctrl arrows move one view page, clamp at boundaries, and leave editing shortcuts alone', () => {
    const env = setup(); env.window.createA4File('portrait');
    const container = env.document.createElement('div'); container.id = 'viewer-container';
    let current = 0;
    const sheets = [0, 1, 2].map(index => {
        const sheet = env.document.createElement('section'); sheet.className = 'a4-sheet';
        sheet.getBoundingClientRect = () => ({ top: (index - current) * 1000 });
        sheet.scrollIntoView = () => { current = index; };
        return sheet;
    });
    container.append(...sheets);
    const press = (key, editing = false) => env.handlers.keydown({ key, ctrlKey: true, target: { closest: () => editing }, preventDefault() {}, stopImmediatePropagation() {} });
    press('ArrowRight'); assert.equal(current, 1);
    press('ArrowRight'); assert.equal(current, 2);
    press('ArrowRight'); assert.equal(current, 2);
    press('ArrowLeft', true); assert.equal(current, 2);
    press('ArrowLeft'); assert.equal(current, 1);
    container.classList.add('hidden'); press('ArrowLeft'); assert.equal(current, 1);
});

test('overflow preserves every character; editing an early page preserves later text', () => {
    const env = setup();
    env.window.createA4File('landscape');
    const text = '한글 텍스트 abc😀\n'.repeat(20);
    env.type(env.inputs()[0], text);
    assert.ok(env.inputs().length > 1);
    assert.equal(env.inputs().map(input => input.value).join(''), text);
    const first = env.inputs()[0].value;
    env.type(env.inputs()[0], '추가' + first);
    assert.equal(env.inputs().map(input => input.value).join(''), '추가' + text);
    assert.equal(env.source.value, '<!-- mdpro-a4: landscape -->\n추가' + text);
});

test('Add persists blank pages and orientation across reopening; undo restores content', () => {
    const env = setup();
    env.window.createA4File('portrait');
    env.type(env.inputs()[0], '첫 페이지');
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    assert.equal(env.inputs().length, 2);
    const saved = env.source.value;
    env.type(env.inputs()[1], '두 번째');
    env.inputs()[1].dispatchEvent({ type: 'keydown', key: 'z', ctrlKey: true, preventDefault() {} });
    assert.equal(env.source.value, saved);
    env.window.A4Pages.sync('ordinary');
    env.window.A4Pages.sync(saved);
    assert.equal(env.inputs().length, 2);
    assert.equal(env.inputs()[0].value, '첫 페이지');
    assert.equal(env.inputs()[1].value, '');
    assert.equal(env.host.dataset.orientation, 'portrait');
});

test('Korean composition is committed once and an explicit break can be removed', () => {
    const env = setup();
    env.window.createA4File('portrait');
    const input = env.inputs()[0];
    input.dispatchEvent({ type: 'compositionstart' });
    env.type(input, 'ㅎ');
    assert.equal(env.inputs()[0], input);
    input.value = '한글'; input.selectionStart = 2;
    input.dispatchEvent({ type: 'compositionend' });
    assert.equal(env.inputs()[0].value, '한글');
    env.host.children.at(-1).dispatchEvent({ type: 'click' });
    env.inputs()[1].dispatchEvent({ type: 'keydown', key: 'Backspace', preventDefault() {} });
    assert.equal(env.inputs().length, 1);
    assert.equal(env.inputs()[0].value, '한글');
});

test('rapid typing keeps the same focused textarea and publishes every character', () => {
    const env = setup();
    env.window.createA4File('portrait');
    const input = env.inputs()[0];
    for (const value of ['a', 'ab', 'abc', 'abcd', 'abc', 'abcde']) {
        env.type(input, value);
        assert.equal(env.inputs()[0], input);
        assert.equal(env.document.activeElement, input);
        assert.equal(env.source.value, '<!-- mdpro-a4: portrait -->\n' + value);
        assert.equal(env.source.selectionStart, env.source.value.length);
    }
});

test('consecutive Korean compositions and their final input events keep the input alive', () => {
    const env = setup();
    env.window.createA4File('portrait');
    const input = env.inputs()[0];
    for (const value of ['한', '한글', '한글 입력']) {
        input.dispatchEvent({ type: 'compositionstart' });
        env.type(input, value);
        input.dispatchEvent({ type: 'keydown', key: 'Backspace', isComposing: true,
            preventDefault() { assert.fail('IME keys must be handled by the browser'); } });
        input.dispatchEvent({ type: 'compositionend' });
        input.dispatchEvent({ type: 'input' });
        assert.equal(env.inputs()[0], input);
        assert.equal(env.source.value, '<!-- mdpro-a4: portrait -->\n' + value);
    }
});

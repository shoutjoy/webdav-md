import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Deterministic layout model exercises real editor event handlers without a browser.
function setup() {
    const elements = new Map();
    class Element {
        constructor(tag) {
            this.tag = tag; this.children = []; this.listeners = {}; this.value = '';
            this.style = {}; this.dataset = {}; this.textContent = ''; this.scrollTop = 0;
            this.selectionStart = this.selectionEnd = 0;
            this.isConnected = true;
            const classes = new Set();
            this.classList = { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
        }
        set id(value) { elements.set(value, this); this._id = value; }
        get id() { return this._id; }
        get clientWidth() { return 80; }
        get clientHeight() { return 78; }
        append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
        remove() { this.parent.children = this.parent.children.filter(item => item !== this); this.isConnected = false; }
        replaceChildren() { this.children.forEach(item => { item.isConnected = false; }); this.children = []; }
        setAttribute() {}
        addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
        dispatchEvent(event) { (this.listeners[event.type] || []).forEach(callback => callback(event)); }
        focus() { this.dispatchEvent({ type: 'focus' }); }
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
        scrollIntoView() {}
        getBoundingClientRect() {
            const lines = this.textContent.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 10)), 0);
            return { height: this.id === 'a4-measure' ? lines * 26 : 78, top: 0, bottom: 78 };
        }
    }
    const document = { createElement: tag => new Element(tag), getElementById: id => elements.get(id), body: new Element('body') };
    const source = new Element('textarea'); source.id = 'viewer-edit-ta';
    const viewport = new Element('div'); viewport.id = 'content-viewport';
    const window = {};
    const context = vm.createContext({ document, window, Event, setNewFileMenuVisible() {}, toggleMode() {},
        createNewFile() { source.value = ''; window.A4Pages.sync(''); },
        updateContent(value) { source.value = value; window.A4Pages.sync(value); },
    });
    vm.runInContext(readFileSync(new URL('../mdpro/js/a4-pages.js', import.meta.url), 'utf8'), context);
    const host = elements.get('a4-pages');
    const inputs = () => host.children.filter(el => el.className === 'a4-sheet').map(el => el.children[0]);
    const type = (input, text) => { input.value = text; input.selectionStart = text.length; input.dispatchEvent({ type: 'input' }); };
    return { window, source, host, inputs, type };
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

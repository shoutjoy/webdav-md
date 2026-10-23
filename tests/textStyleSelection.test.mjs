import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../mdpro/js/text-style/text-style.js', import.meta.url), 'utf8');

function fixture(cm = false) {
    const listeners = {};
    const nodes = new Map();
    const classes = () => ({ add() {}, remove() {}, toggle() {}, contains() { return false; } });
    const node = (id) => {
        if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, style: {}, classList: classes(),
            options: [], closest() { return null; }, setAttribute() {}, focus() { doc.activeElement = this; } });
        return nodes.get(id);
    };
    const doc = { readyState: 'loading', getElementById: node,
        addEventListener(name, fn) { listeners[name] = fn; } };
    const context = vm.createContext({ window: { document: doc, Event: class { constructor(type) { this.type = type; } } } });
    vm.runInContext(source, context);
    const ta = { value: '앞 선택 뒤', selectionStart: 2, selectionEnd: 4, scrollTop: 0, scrollLeft: 0,
        focus() { doc.activeElement = this; },
        setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
        setRangeText(text, start, end) { this.value = this.value.slice(0, start) + text + this.value.slice(end); },
        dispatchEvent(event) { this.lastEvent = event.type; } };
    if (cm) ta.__mdCm6View = { dom: { contains() { return false; } }, dispatch(tx) {
        ta.lastTransaction = tx;
        ta.value = ta.value.slice(0, tx.changes.from) + tx.changes.insert + ta.value.slice(tx.changes.to);
    } };
    const api = context.window.TextStyleTool;
    api.open({ textarea: ta, isEditMode: true });
    node('style-enable-text-color').checked = true;
    node('style-text-color').value = '#ef4444';
    return { api, ta, node, doc };
}

for (const cm of [false, true]) test(`color only replaces selection in ${cm ? 'CodeMirror' : 'textarea'}`, () => {
    const { api, ta } = fixture(cm);
    assert.equal(api.applySelection({ textarea: ta }).ok, true);
    assert.equal(ta.value, '앞 <span style="color:#ef4444;">선택</span> 뒤');
    if (cm) assert.equal(ta.lastTransaction.userEvent, 'input');
    else assert.equal(ta.lastEvent, 'input');
});

test('new editor selection becomes the target while the panel stays open', () => {
    const { api, ta } = fixture();
    ta.focus();
    ta.setSelectionRange(5, 6);
    assert.equal(api.applySelection({ textarea: ta }).ok, true);
    assert.equal(ta.value, '앞 선택 <span style="color:#ef4444;">뒤</span>');
});

test('empty selection and changed documents cannot modify other text', () => {
    const { api, ta } = fixture();
    ta.focus();
    ta.setSelectionRange(1, 1);
    assert.equal(api.applySelection({ textarea: ta }).ok, false);
    assert.equal(ta.value, '앞 선택 뒤');
    const other = fixture();
    other.ta.value = '다른 문서';
    assert.equal(other.api.applySelection({ textarea: other.ta }).ok, false);
    assert.equal(other.ta.value, '다른 문서');
});

test('table rows and multiline selections keep delimiters outside style spans', () => {
    const { api } = fixture();
    const wrap = text => api.__test.buildStyledHtml(text, { color: '#ef4444' });
    assert.equal(wrap('| a | b |'), '|<span style="color:#ef4444;"> a </span>|<span style="color:#ef4444;"> b </span>|');
    assert.equal(wrap('a\nb'), '<span style="color:#ef4444;">a</span>\n<span style="color:#ef4444;">b</span>');
    assert.equal(wrap('| --- | :---: |'), '| --- | :---: |');
});

test('all formatting controls produce their requested style', () => {
    const { api } = fixture();
    const html = api.__test.buildStyledHtml('선택', {
        fontSize: '18pt', fontFamily: 'Arial,sans-serif', color: '#ef4444',
        backgroundColor: '#fff59d', bold: true, italic: true, superscript: true
    });
    assert.equal(html, '<sup><em><strong><span style="font-size:18pt;font-family:Arial,sans-serif;color:#ef4444;background-color:#fff59d;">선택</span></strong></em></sup>');
    assert.equal(api.__test.buildStyledHtml('2', { subscript: true }), '<sub>2</sub>');
});

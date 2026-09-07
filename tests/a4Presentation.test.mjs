import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// A DOM/event fixture for state and drawing behavior; it does not emulate CSS layout.
function fixture() {
    function makeDocument() {
        const doc = { listeners: {}, baseURI: 'http://localhost/mdpro/index.html' };
        class Element {
            constructor(tag) {
                this.tag = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attrs = {};
                this.listeners = {}; this.textContent = ''; this.innerHTML = ''; this.scrollTop = 0;
                this.style = { setProperty(name, value) { this[name] = value; } };
                const classes = new Set();
                this.classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => classes.delete(n)), contains: n => classes.has(n),
                    toggle: (n, on) => { const enabled = on ?? !classes.has(n); if (enabled) classes.add(n); else classes.delete(n); return enabled; } };
                Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => { classes.clear(); value.split(' ').filter(Boolean).forEach(n => classes.add(n)); } });
            }
            append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
            replaceChildren() { this.children = []; }
            remove() { this.parent.children = this.parent.children.filter(item => item !== this); }
            setAttribute(name, value) { this.attrs[name] = value; }
            getAttribute(name) { return this.attrs[name]; }
            addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
            fire(name, data = {}) { (this.listeners[name] || []).forEach(handler => handler({ target: this, preventDefault() {}, stopImmediatePropagation() {}, ...data })); }
            closest() { return null; }
            setPointerCapture() {}
            get clientWidth() { return 1000; }
            get clientHeight() { return 800; }
            get offsetWidth() { return this.dataset.orientation === 'landscape' ? 1123 : 794; }
            get offsetHeight() { return this.dataset.orientation === 'landscape' ? 794 : 1123; }
            getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 1000 }; }
            scrollIntoView() { this.scrolled = true; }
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
            querySelectorAll(selector) {
                if (selector === '.a4-view-content, .a4-view-content *') return this.querySelectorAll('.a4-view-content');
                const direct = selector.startsWith(':scope > ');
                selector = selector.replace(':scope > ', '');
                const result = [];
                const matches = item => selector.startsWith('.') ? item.classList.contains(selector.slice(1)) : selector.startsWith('#') ? item.id === selector.slice(1) : item.tag === selector;
                const walk = parent => parent.children.forEach(child => { if (matches(child)) result.push(child); if (!direct) walk(child); });
                walk(this);
                return result;
            }
        }
        doc.createElement = tag => new Element(tag);
        doc.createElementNS = (_, tag) => new Element(tag);
        doc.head = new Element('head'); doc.body = new Element('body');
        doc.getElementById = id => doc.head.querySelector('#' + id) || doc.body.querySelector('#' + id);
        doc.addEventListener = (name, handler) => { (doc.listeners[name] ||= []).push(handler); };
        doc.fire = (name, data) => (doc.listeners[name] || []).forEach(handler => handler({ target: doc.body, preventDefault() {}, stopImmediatePropagation() {}, ...data }));
        doc.importNode = node => {
            const copy = new Element(node.tag);
            copy.className = node.className; copy.dataset = { ...node.dataset }; copy.innerHTML = node.innerHTML;
            copy.append(...node.children.map(child => doc.importNode(child)));
            return copy;
        };
        return doc;
    }
    const document = makeDocument();
    const drop = document.createElement('main'); drop.id = 'drop-zone'; drop.classList.add('document-light-mode'); document.body.append(drop);
    const child = makeDocument();
    ['pv-pages', 'pv-viewport', 'pv-content'].forEach(id => { const node = child.createElement('div'); node.id = id; child.body.append(node); });
    const win = { document: child, addEventListener() {}, closed: false };
    const window = {};
    vm.runInNewContext(readFileSync(new URL('../mdpro/js/a4-presentation.js', import.meta.url), 'utf8'), {
        window, document, URL, getComputedStyle: () => ({ fontSize: '16px', lineHeight: '26px', fontFamily: 'Arial', getPropertyValue: () => '16px' })
    });
    const pages = ['portrait', 'landscape'].map((orientation, i) => {
        const page = document.createElement('section'); page.className = 'a4-sheet'; page.dataset.orientation = orientation;
        const content = document.createElement('div'); content.className = 'a4-view-content'; content.innerHTML = 'page ' + i;
        page.append(content); return page;
    });
    const api = window.A4Presentation;
    const root = child.getElementById('pv-pages');
    const button = text => child.getElementById('a4-presentation-tools').children.find(node => node.textContent === text);
    const draw = (index = 0) => {
        const svg = root.querySelectorAll('.a4-ink')[index];
        svg.fire('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
        svg.fire('pointermove', { pointerId: 1, clientX: 500, clientY: 100 });
        svg.fire('pointerup', { pointerId: 1 });
        return svg;
    };
    return { api, pages, win, child, root, drop, button, draw };
}

test('pointer coordinates remain page-relative across zoom and eraser hits segments, not just vertices', () => {
    const { api } = fixture();
    assert.deepEqual(Array.from(api.point({ clientX: 300, clientY: 200 }, { left: 100, top: 100, width: 400, height: 200 })), [500, 500]);
    const stroke = { points: [[100, 100], [900, 100]] };
    assert.equal(api.hitStroke(stroke, [500, 110], { width: 500, height: 500 }), true);
    assert.equal(api.hitStroke(stroke, [500, 200], { width: 500, height: 500 }), false);
});

test('PV mirrors mixed page directions, switches slides, clamps navigation and follows document theme', () => {
    const env = fixture(); env.api.mount(env.win, env.pages);
    const sheets = env.root.querySelectorAll('.a4-sheet');
    assert.deepEqual(sheets.map(page => page.dataset.orientation), ['portrait', 'landscape']);
    assert.equal(env.child.body.classList.contains('a4-document-light'), true);
    env.button('슬라이드 시작').fire('click');
    assert.equal(sheets[1].classList.contains('a4-slide-hidden'), true);
    env.button('다음 →').fire('click');
    assert.equal(sheets[0].classList.contains('a4-slide-hidden'), true);
    assert.equal(env.button('다음 →').disabled, true);
    env.child.fire('keydown', { key: 'ArrowRight' });
    assert.equal(sheets[1].classList.contains('a4-slide-hidden'), false);
    env.child.fire('keydown', { key: 'Escape' });
    assert.equal(env.child.body.classList.contains('a4-slideshow'), false);
    env.drop.classList.remove('document-light-mode'); env.api.theme(env.win);
    assert.equal(env.child.body.classList.contains('a4-document-dark'), true);
});

test('pen and highlighter survive slide movement and identical sync; eraser and clearing affect only ink', () => {
    const env = fixture(); env.api.mount(env.win, env.pages);
    env.button('펜').fire('click'); let svg = env.draw();
    assert.equal(svg.children.length, 1);
    env.button('다음 →').fire('click'); env.button('형광펜').fire('click'); env.draw(1);
    env.api.mount(env.win, env.pages);
    assert.equal(env.root.querySelectorAll('.a4-ink')[0].children.length, 1);
    env.button('← 이전').fire('click'); env.button('지우개').fire('click');
    svg.fire('pointerdown', { button: 0, pointerId: 2, clientX: 300, clientY: 100 });
    svg.fire('pointerup', { pointerId: 2 });
    assert.equal(svg.children.length, 0);
    assert.equal(env.root.querySelectorAll('.a4-ink')[1].children.length, 1);
    env.button('전체 지우기').fire('click');
    assert.ok(env.root.querySelectorAll('.a4-ink').every(ink => ink.children.length === 0));
    assert.equal(env.root.querySelectorAll('.a4-view-content')[0].innerHTML, 'page 0');
});

test('pointer leaves no saved strokes; changed pages and document switches cannot inherit unrelated ink', () => {
    const env = fixture(); env.api.mount(env.win, env.pages);
    env.button('포인터').fire('click'); env.draw();
    assert.equal(env.root.querySelectorAll('.a4-ink')[0].children.length, 0);
    env.button('펜').fire('click'); env.draw(); env.draw(1);
    env.pages[0].querySelector('.a4-view-content').innerHTML = 'changed';
    env.api.mount(env.win, env.pages);
    assert.equal(env.root.querySelectorAll('.a4-ink')[0].children.length, 0);
    assert.equal(env.root.querySelectorAll('.a4-ink')[1].children.length, 1);
    env.api.resetDocument(); env.api.mount(env.win, env.pages);
    assert.ok(env.root.querySelectorAll('.a4-ink').every(ink => ink.children.length === 0));
    env.api.leave(env.win);
    assert.equal(env.child.body.classList.contains('a4-pv'), false);
});

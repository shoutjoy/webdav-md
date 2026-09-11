(function () {
    'use strict';
    const sessions = new WeakMap();
    let generation = 0;
    const SVG = 'http://www.w3.org/2000/svg';
    const clamp = (value, max) => Math.max(0, Math.min(max, value));

    function point(event, rect) {
        return [clamp((event.clientX - rect.left) / rect.width, 1) * 1000,
            clamp((event.clientY - rect.top) / rect.height, 1) * 1000];
    }

    function hitStroke(stroke, p, rect) {
        const scale = [rect.width / 1000, rect.height / 1000];
        const points = stroke.points;
        for (let i = 0; i < points.length; i++) {
            const a = points[Math.max(0, i - 1)];
            const b = points[i];
            const dx = (b[0] - a[0]) * scale[0];
            const dy = (b[1] - a[1]) * scale[1];
            const px = (p[0] - a[0]) * scale[0];
            const py = (p[1] - a[1]) * scale[1];
            const t = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1), 1);
            if (Math.hypot(px - t * dx, py - t * dy) <= 14) return true;
        }
        return false;
    }

    function theme(win) {
        if (!win || win.closed || !win.document) return false;
        // A newly opened popup can replace its document between document.write
        // and load. Keep one body reference so a transient second lookup cannot
        // turn null between the readiness check and the class updates.
        const body = win.document.body;
        if (!body || !body.classList) return false;
        const light = !!document.getElementById('drop-zone')?.classList.contains('document-light-mode');
        body.classList.toggle('a4-document-light', light);
        body.classList.toggle('a4-document-dark', !light);
        return true;
    }

    function renderInk(session, page, svg) {
        svg.replaceChildren();
        (session.ink[page] || []).forEach(stroke => {
            const path = svg.ownerDocument.createElementNS(SVG, 'path');
            const data = stroke.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
            path.setAttribute('d', data + (stroke.points.length === 1 ? ' l0.1,0' : ''));
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', stroke.tool === 'highlighter' ? '#fde047' : '#ef4444');
            path.setAttribute('stroke-width', stroke.tool === 'highlighter' ? '18' : '3');
            path.setAttribute('stroke-opacity', stroke.tool === 'highlighter' ? '.35' : '1');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.append(path);
        });
    }

    function attachInk(session, sheet, index) {
        const doc = sheet.ownerDocument;
        const svg = doc.createElementNS(SVG, 'svg');
        svg.classList.add('a4-ink');
        svg.setAttribute('viewBox', '0 0 1000 1000');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-label', `${index + 1} 페이지 필기`);
        const pointer = doc.createElement('span');
        pointer.className = 'a4-laser';
        pointer.hidden = true;
        sheet.append(svg, pointer);
        let active = null;
        let pointerId = null;
        function move(event) {
            const rect = svg.getBoundingClientRect();
            const p = point(event, rect);
            if (session.tool === 'pointer') {
                pointer.hidden = false;
                pointer.style.left = p[0] / 10 + '%';
                pointer.style.top = p[1] / 10 + '%';
            } else if (pointerId === event.pointerId) {
                if (session.tool === 'eraser') {
                    session.ink[index] = (session.ink[index] || []).filter(stroke => !hitStroke(stroke, p, rect));
                } else if (active) active.points.push(p);
                renderInk(session, index, svg);
            }
        }
        svg.addEventListener('pointerdown', event => {
            if (event.button !== 0 || session.tool === 'navigate') return;
            event.preventDefault();
            session.index = index;
            pointerId = event.pointerId;
            svg.setPointerCapture(event.pointerId);
            if (['pen', 'highlighter'].includes(session.tool)) {
                active = { tool: session.tool, points: [point(event, svg.getBoundingClientRect())] };
                (session.ink[index] ||= []).push(active);
            }
            move(event);
        });
        svg.addEventListener('pointermove', move);
        const end = () => { active = null; pointerId = null; };
        svg.addEventListener('pointerup', end);
        svg.addEventListener('pointercancel', end);
        svg.addEventListener('lostpointercapture', end);
        svg.addEventListener('pointerleave', () => { pointer.hidden = true; });
        renderInk(session, index, svg);
    }

    function refresh(session, scroll = false) {
        const { win, root } = session;
        const sheets = Array.from(root.querySelectorAll(':scope > .a4-sheet'));
        session.index = clamp(session.index, Math.max(0, sheets.length - 1));
        win.document.body.classList.toggle('a4-slideshow', session.slides);
        root.dataset.tool = session.tool;
        const viewport = win.document.getElementById('pv-viewport');
        sheets.forEach((sheet, index) => {
            sheet.classList.toggle('a4-slide-hidden', session.slides && index !== session.index);
            sheet.style.zoom = '';
            if (session.slides && index === session.index) {
                const width = sheet.offsetWidth;
                const height = sheet.offsetHeight;
                const scale = Math.min((viewport.clientWidth - 32) / width, (viewport.clientHeight - 32) / height);
                sheet.style.zoom = String(Math.max(.1, Math.min(2, scale)));
            }
            sheet.querySelector('.a4-laser').hidden = true;
        });
        session.counter.textContent = `${sheets.length ? session.index + 1 : 0} / ${sheets.length}`;
        session.previous.disabled = session.index === 0;
        session.next.disabled = session.index >= sheets.length - 1;
        session.slideButton.textContent = session.slides ? '슬라이드 종료' : '슬라이드 시작';
        session.slideButton.setAttribute('aria-pressed', String(session.slides));
        session.toolButtons.forEach((button, tool) => button.setAttribute('aria-pressed', String(tool === session.tool)));
        if (scroll && !session.slides) sheets[session.index]?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }

    function createSession(win, root) {
        const doc = win.document;
        const session = { win, root, generation, index: 0, slides: false, tool: 'navigate', ink: [], signatures: [], toolButtons: new Map() };
        const toolbar = doc.createElement('div');
        toolbar.id = 'a4-presentation-tools';
        toolbar.className = 'no-print';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'A4 슬라이드와 필기 도구');
        function button(label, handler) {
            const element = doc.createElement('button');
            element.type = 'button';
            element.textContent = label;
            element.addEventListener('click', handler);
            toolbar.append(element);
            return element;
        }
        session.slideButton = button('슬라이드 시작', () => { session.slides = !session.slides; refresh(session); });
        const navigate = delta => { session.index += delta; refresh(session, true); };
        session.previous = button('← 이전', () => navigate(-1));
        session.counter = doc.createElement('span');
        session.counter.setAttribute('aria-live', 'polite');
        toolbar.append(session.counter);
        session.next = button('다음 →', () => navigate(1));
        [['navigate', '선택'], ['pen', '펜'], ['highlighter', '형광펜'], ['eraser', '지우개'], ['pointer', '포인터']].forEach(([tool, label]) => {
            session.toolButtons.set(tool, button(label, () => { session.tool = tool; refresh(session); }));
        });
        button('이 페이지 지우기', () => {
            session.ink[session.index] = [];
            const svg = root.querySelectorAll('.a4-ink')[session.index];
            if (svg) renderInk(session, session.index, svg);
        });
        button('전체 지우기', () => {
            session.ink = [];
            root.querySelectorAll('.a4-ink').forEach((svg, index) => renderInk(session, index, svg));
        });
        doc.body.append(toolbar);
        win.addEventListener('resize', () => { if (doc.body.classList.contains('a4-pv')) refresh(session); });
        doc.addEventListener('keydown', event => {
            if (!doc.body.classList.contains('a4-pv') || doc.body.classList.contains('pv-editor-mode') || doc.body.classList.contains('pv-file-mode')) return;
            if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
            if (event.key === 'Escape' && session.slides) { session.slides = false; refresh(session); event.preventDefault(); }
            else if ((event.ctrlKey || session.slides) && ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(event.key)) {
                event.preventDefault(); event.stopImmediatePropagation();
                navigate(['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 1);
            }
        }, true);
        const viewport = doc.getElementById('pv-viewport');
        viewport.addEventListener('scroll', () => {
            if (session.slides || !doc.body.classList.contains('a4-pv')) return;
            const top = viewport.getBoundingClientRect().top;
            session.index = 0;
            root.querySelectorAll(':scope > .a4-sheet').forEach((sheet, index) => {
                if (sheet.getBoundingClientRect().top <= top + 24) session.index = index;
            });
            session.counter.textContent = `${session.index + 1} / ${root.querySelectorAll(':scope > .a4-sheet').length}`;
            session.previous.disabled = session.index === 0;
            session.next.disabled = session.index >= root.querySelectorAll(':scope > .a4-sheet').length - 1;
        }, { passive: true });
        return session;
    }

    function mount(win, pages) {
        const doc = win.document;
        const root = doc.getElementById('pv-pages');
        if (!root) return;
        if (!doc.getElementById('a4-presentation-style')) {
            const link = doc.createElement('link');
            link.id = 'a4-presentation-style';
            link.rel = 'stylesheet';
            link.href = new URL('./css/a4-pages.css?v=4', document.baseURI).href;
            link.addEventListener('load', () => { const active = sessions.get(win); if (active) refresh(active); });
            doc.head.append(link);
        }
        doc.body.classList.add('a4-pv');
        theme(win);
        let session = sessions.get(win);
        if (!session) { session = createSession(win, root); sessions.set(win, session); }
        if (session.generation !== generation) { session.ink = []; session.signatures = []; session.index = 0; session.generation = generation; }
        const signatures = pages.map(page => {
            const content = page.querySelector('.a4-view-content');
            const style = getComputedStyle(content);
            return page.dataset.orientation + ':' + style.fontSize + ':' + style.lineHeight + ':' + content.innerHTML;
        });
        if (root.querySelectorAll(':scope > .a4-sheet').length === signatures.length && session.signatures.length === signatures.length && signatures.every((value, i) => value === session.signatures[i])) {
            refresh(session);
            return;
        }
        const previous = session.signatures;
        session.ink = signatures.map((signature, i) => signature === previous[i] ? session.ink[i] || [] : []);
        session.signatures = signatures;
        const scrollTop = doc.getElementById('pv-viewport').scrollTop;
        const editor = doc.getElementById('pv-content');
        if (editor) editor.innerHTML = pages.map(page => page.querySelector('.a4-view-content').innerHTML).join('\n');
        root.replaceChildren();
        pages.forEach((page, index) => {
            const copy = doc.importNode(page, true);
            copy.classList.add('markdown-body');
            copy.querySelectorAll('.a4-controls').forEach(control => control.remove());
            const computed = getComputedStyle(page.querySelector('.a4-view-content'));
            copy.style.fontSize = computed.fontSize;
            copy.style.lineHeight = computed.lineHeight;
            copy.style.fontFamily = computed.fontFamily;
            const originals = page.querySelectorAll('.a4-view-content, .a4-view-content *');
            const copies = copy.querySelectorAll('.a4-view-content, .a4-view-content *');
            // PV has independent typography settings. Preserve the measured view layout.
            originals.forEach((node, i) => {
                const style = getComputedStyle(node);
                ['font-size', 'font-family', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'margin', 'padding', 'white-space', 'word-break', 'overflow-wrap', 'text-indent', 'box-sizing'].forEach(property => {
                    copies[i].style.setProperty(property, style.getPropertyValue(property));
                });
            });
            root.append(copy);
            attachInk(session, copy, index);
        });
        refresh(session);
        doc.getElementById('pv-viewport').scrollTop = scrollTop;
    }

    function leave(win) {
        if (!win || win.closed) return;
        win.document.body.classList.remove('a4-pv', 'a4-slideshow');
    }

    window.A4Presentation = { mount, leave, theme, resetDocument: () => { generation++; }, point, hitStroke,
        refreshViewport: win => { const session = sessions.get(win); if (session) refresh(session); } };
}());

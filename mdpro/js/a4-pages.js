/* Opt-in paged Markdown editor. Automatic wraps never alter the source text. */
(function () {
    'use strict';
    const HEADER = /^<!-- mdpro-a4: (portrait|landscape) -->\n/;
    const BREAK = '\n<!-- mdpro-a4-page-break -->\n';
    const DIRECTIONS = /^<!-- mdpro-a4-orientations: ((?:portrait|landscape)(?:,(?:portrait|landscape))*) -->\n/;
    const source = document.getElementById('viewer-edit-ta');
    const viewport = document.getElementById('content-viewport');
    const host = document.createElement('div');
    host.id = 'a4-pages';
    host.hidden = true;
    viewport.append(host);
    const measure = document.createElement('div');
    measure.id = 'a4-measure';
    document.body.append(measure);
    let orientation = null;
    let directions = [];
    let sections = [];
    let pages = [];
    let sending = false;
    let composing = false;
    let lastText = null;
    let history = [];
    let historyIndex = -1;
    let viewRevision = '';
    let viewPages = [];
    let floatingPosition = null;

    function prefix() {
        return `<!-- mdpro-a4: ${orientation} -->\n` + (directions.length ? `<!-- mdpro-a4-orientations: ${directions.join(',')} -->\n` : '');
    }

    function serialize() {
        return prefix() + sections.join(BREAK);
    }

    function directionAt(index) { return directions[index] || orientation; }

    function changeDirection(direction, index) {
        if (!orientation || !['portrait', 'landscape'].includes(direction)) return;
        if (index == null) {
            orientation = direction;
            directions = [];
        } else {
            while (directions.length <= index) directions.push(orientation);
            directions[index] = direction;
        }
        publish();
        render();
        // The view is also refreshed when a direction changes while viewing.
        if (typeof renderMarkdown === 'function') renderMarkdown({ force: true });
    }

    function controls(index) {
        const bar = document.createElement('div');
        bar.className = index == null ? 'a4-controls a4-document-controls no-print' : 'a4-controls a4-page-controls no-print';
        const label = document.createElement('span');
        label.textContent = index == null ? '문서 전체' : `${index + 1} 페이지`;
        bar.append(label);
        ['portrait', 'landscape'].forEach(direction => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = direction === 'portrait' ? 'A4 세로' : 'A4 가로';
            button.setAttribute('aria-label', `${index == null ? '문서 전체' : `${index + 1} 페이지`} ${button.textContent}로 전환`);
            button.setAttribute('aria-pressed', String(index == null ? !directions.length && orientation === direction : directionAt(index) === direction));
            button.addEventListener('click', event => { event.stopPropagation(); changeDirection(direction, index); });
            bar.append(button);
        });
        return bar;
    }

    function publish() {
        const text = serialize();
        lastText = text;
        sending = true;
        source.value = text;
        source.dispatchEvent(new Event('input', { bubbles: true }));
        sending = false;
        if (history[historyIndex] !== text) {
            history = history.slice(0, historyIndex + 1);
            history.push(text);
            if (history.length > 100) history.shift();
            historyIndex = history.length - 1;
        }
    }

    function fits(text, height) {
        measure.textContent = text + '\u200b';
        return measure.getBoundingClientRect().height <= height + 0.5;
    }

    function split(text, firstPage) {
        const chunks = [];
        let start = 0;
        do {
            const direction = directionAt(firstPage + chunks.length);
            const { width, height } = dimensions(direction);
            measure.style.width = width + 'px';
            let low = 0;
            let high = text.length - start;
            while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                if (fits(text.slice(start, start + middle), height)) low = middle;
                else high = middle - 1;
            }
            let size = Math.max(1, low);
            // Keep UTF-16 surrogate pairs together when a page ends at an emoji.
            const end = start + size;
            if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) size--;
            size = Math.max(1, size);
            chunks.push({ start, text: text.slice(start, start + size), direction });
            start += size;
        } while (start < text.length);
        return chunks;
    }

    function sourceOffset(page) {
        return prefix().length +
            sections.slice(0, page.section).reduce((sum, text) => sum + text.length + BREAK.length, 0) + page.start;
    }

    function selection(page, input) {
        const offset = sourceOffset(page);
        source.setSelectionRange(offset + input.selectionStart, offset + input.selectionEnd);
    }

    function dimensions(direction) {
        // Use a real sheet to measure the CSS millimetre dimensions.
        const probe = document.createElement('section');
        probe.className = 'a4-sheet';
        probe.dataset.orientation = direction;
        const area = document.createElement('textarea');
        area.className = 'a4-text';
        probe.append(area);
        host.append(probe);
        const width = area.clientWidth || (direction === 'portrait' ? 170 : 257) * 96 / 25.4;
        const height = area.clientHeight || (direction === 'portrait' ? 257 : 170) * 96 / 25.4;
        probe.remove();
        return { width, height };
    }

    function render(caret) {
        // Keep the focused textarea alive: replacing it during input (especially
        // compositionend) interrupts the browser's next IME/input event.
        if (caret && pages.length) {
            const next = [];
            sections.forEach((text, section) => {
                split(text, next.length).forEach(chunk => next.push({ ...chunk, section }));
            });
            if (next.length === pages.length && next.every((page, index) =>
                page.section === pages[index].section && page.direction === pages[index].direction)) {
                next.forEach((chunk, index) => {
                    const page = pages[index];
                    Object.assign(page, chunk);
                    if (page.input.value !== chunk.text) page.input.value = chunk.text;
                });
                const candidates = pages.filter(page => page.section === caret.section);
                const active = candidates.find(page => caret.position < page.start + page.text.length) || candidates.at(-1);
                if (active) {
                    const position = Math.max(0, Math.min(active.text.length, caret.position - active.start));
                    if (document.activeElement !== active.input) active.input.focus({ preventScroll: true });
                    if (active.input.selectionStart !== position || active.input.selectionEnd !== position) {
                        active.input.setSelectionRange(position, position);
                    }
                    selection(active, active.input);
                }
                return;
            }
        }
        const scroll = viewport.scrollTop;
        host.replaceChildren();
        pages = [];
        host.dataset.orientation = orientation;
        host.append(controls());
        sections.forEach((text, section) => {
            split(text, pages.length).forEach(chunk => {
                const page = { ...chunk, section };
                const sheet = document.createElement('section');
                sheet.className = 'a4-sheet';
                sheet.dataset.orientation = chunk.direction;
                const input = document.createElement('textarea');
                input.className = 'a4-text';
                input.spellcheck = false;
                input.value = chunk.text;
                input.placeholder = '이곳에 마크다운 내용을 입력하세요…';
                input.setAttribute('aria-label', `A4 ${chunk.direction === 'portrait' ? '세로' : '가로'} ${pages.length + 1} 페이지`);
                page.input = input;
                input.addEventListener('select', () => selection(page, input));
                input.addEventListener('keyup', () => selection(page, input));
                input.addEventListener('click', () => selection(page, input));
                input.addEventListener('focus', () => selection(page, input));
                input.addEventListener('compositionstart', () => { composing = true; });
                input.addEventListener('compositionend', () => { composing = false; edit(); });
                function edit() {
                    if (composing) return;
                    const position = page.start + input.selectionStart;
                    sections[section] = sections[section].slice(0, page.start) + input.value +
                        sections[section].slice(page.start + page.text.length);
                    page.text = input.value;
                    selection(page, input);
                    publish();
                    render({ section, position });
                }
                input.addEventListener('input', () => {
                    // Some engines send a final input after compositionend.
                    if (input.isConnected) edit();
                });
                input.addEventListener('keydown', event => {
                    if (composing || event.isComposing || event.keyCode === 229) return;
                    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
                        event.preventDefault();
                        const delta = event.key.toLowerCase() === 'y' || event.shiftKey ? 1 : -1;
                        const next = historyIndex + delta;
                        if (next >= 0 && next < history.length) {
                            const position = page.start + input.selectionStart;
                            historyIndex = next;
                            source.value = history[next];
                            sync(source.value, true);
                            render({ section: Math.min(section, sections.length - 1), position });
                            sending = true;
                            source.dispatchEvent(new Event('input', { bubbles: true }));
                            sending = false;
                        }
                    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !event.shiftKey && input.selectionStart === input.selectionEnd) {
                        const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
                        const boundary = backward ? input.selectionStart === 0 : input.selectionStart === input.value.length;
                        const adjacent = pages[pages.indexOf(page) + (backward ? -1 : 1)];
                        if (boundary && adjacent) {
                            event.preventDefault();
                            adjacent.input.focus();
                            const position = backward ? adjacent.text.length : 0;
                            adjacent.input.setSelectionRange(position, position);
                        }
                    } else if (event.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0) {
                        const previous = pages[pages.indexOf(page) - 1];
                        if (!previous) return;
                        event.preventDefault();
                        if (previous.section !== section) {
                            const position = sections[section - 1].length;
                            sections.splice(section - 1, 2, sections[section - 1] + sections[section]);
                            publish();
                            render({ section: section - 1, position });
                        } else {
                            previous.input.focus();
                            previous.input.setSelectionRange(previous.text.length, previous.text.length);
                        }
                    }
                });
                const number = document.createElement('span');
                number.className = 'a4-number';
                number.textContent = `${pages.length + 1} · A4 ${chunk.direction === 'portrait' ? '세로' : '가로'}`;
                sheet.append(input, number, controls(pages.length));
                host.append(sheet);
                pages.push(page);
            });
        });
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'a4-add';
        add.textContent = '+ Add 페이지';
        add.addEventListener('click', () => {
            sections.push('');
            publish();
            render({ section: sections.length - 1, position: 0 });
        });
        host.append(add);
        viewport.scrollTop = scroll;
        if (caret) {
            const candidates = pages.filter(page => page.section === caret.section);
            const page = candidates.find(page => caret.position < page.start + page.text.length) || candidates.at(-1);
            if (page) {
                page.input.focus({ preventScroll: true });
                const position = Math.max(0, Math.min(page.text.length, caret.position - page.start));
                page.input.setSelectionRange(position, position);
                const rect = page.input.getBoundingClientRect();
                const view = viewport.getBoundingClientRect();
                if (rect.top > view.bottom || rect.bottom < view.top) page.input.scrollIntoView({ block: 'start' });
            }
        }
    }

    function sync(text, keepHistory = false) {
        if (sending || text === lastText) return;
        lastText = text;
        const match = HEADER.exec(text);
        orientation = match ? match[1] : null;
        host.hidden = !orientation;
        viewport.classList.toggle('a4-active', !!orientation);
        if (!keepHistory) { history = [text]; historyIndex = 0; }
        if (!orientation) { host.replaceChildren(); viewRevision = ''; viewPages = []; return; }
        let body = text.slice(match[0].length);
        const overrides = DIRECTIONS.exec(body);
        directions = overrides ? overrides[1].split(',') : [];
        if (overrides) body = body.slice(overrides[0].length);
        sections = body.split(BREAK);
        render();
    }

    source.addEventListener('input', () => sync(source.value));

    async function renderView(target, text, renderHtml, isCurrent) {
        const enabled = HEADER.test(text);
        target.classList.toggle('a4-view', enabled);
        if (!enabled) return false;
        sync(text);
        const content = sections.slice();
        const html = await Promise.all(content.map(renderHtml));
        if (!isCurrent()) return true;
        target.replaceChildren();
        const floating = document.createElement('div');
        floating.className = 'a4-floating-settings no-print';
        if (floatingPosition) {
            floating.style.left = floatingPosition.x + 'px';
            floating.style.top = floatingPosition.y + 'px';
        }
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'a4-settings-toggle';
        toggle.textContent = 'A4';
        toggle.title = '페이지 설정';
        toggle.setAttribute('aria-label', '페이지 설정 열기');
        toggle.setAttribute('aria-expanded', 'false');
        const panel = controls();
        panel.hidden = true;
        let drag = null;
        let dragged = false;
        toggle.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            const rect = floating.getBoundingClientRect();
            drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
            dragged = false;
            toggle.setPointerCapture(event.pointerId);
        });
        toggle.addEventListener('pointermove', event => {
            if (!drag) return;
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.hypot(dx, dy) > 5) dragged = true;
            if (!dragged) return;
            floatingPosition = { x: Math.max(0, Math.min(window.innerWidth - 48, drag.left + dx)), y: Math.max(0, Math.min(window.innerHeight - 48, drag.top + dy)) };
            floating.style.left = floatingPosition.x + 'px';
            floating.style.top = floatingPosition.y + 'px';
        });
        toggle.addEventListener('pointerup', () => { drag = null; });
        toggle.addEventListener('pointercancel', () => { drag = null; });
        toggle.addEventListener('click', event => {
            event.stopPropagation();
            if (dragged) { dragged = false; return; }
            panel.hidden = !panel.hidden;
            toggle.setAttribute('aria-expanded', String(!panel.hidden));
        });
        floating.append(toggle, panel);
        target.append(floating);
        target.dataset.a4Revision = text;
        html.forEach(value => {
            const group = document.createElement('div');
            group.className = 'a4-view-section';
            group.innerHTML = value;
            target.append(group);
        });
        return true;
    }

    // Range fragments keep inline markup and nested lists intact across a page.
    function fragments(node, position) {
        const walker = document.createTreeWalker(node, 4 /* SHOW_TEXT */);
        let textNode;
        let remaining = position;
        while ((textNode = walker.nextNode())) {
            if (remaining <= textNode.length) break;
            remaining -= textNode.length;
        }
        if (!textNode) return [node.cloneNode(true), node.cloneNode(false)];
        const before = document.createRange();
        before.selectNodeContents(node);
        before.setEnd(textNode, remaining);
        const after = document.createRange();
        after.selectNodeContents(node);
        after.setStart(textNode, remaining);
        const first = node.cloneNode(false);
        const rest = node.cloneNode(false);
        first.append(before.cloneContents());
        rest.append(after.cloneContents());
        return [first, rest];
    }

    function paginateView(target) {
        if (!target.classList.contains('a4-view')) return;
        const groups = Array.from(target.querySelectorAll(':scope > .a4-view-section'));
        if (!groups.length) return;
        const container = document.getElementById('viewer-container');
        const hidden = container?.classList.contains('hidden');
        if (hidden) container.classList.add('a4-measuring');
        let index = 0;
        let body;
        function nextPage() {
            const direction = directionAt(index);
            const sheet = document.createElement('section');
            sheet.className = 'a4-sheet';
            sheet.dataset.orientation = direction;
            body = document.createElement('div');
            body.className = 'a4-view-content';
            const number = document.createElement('span');
            number.className = 'a4-number';
            number.textContent = `${index + 1} · A4 ${direction === 'portrait' ? '세로' : '가로'}`;
            sheet.append(body, number, controls(index++));
            target.append(sheet);
        }
        function overflows() { return body.scrollHeight > body.clientHeight + 1; }
        groups.forEach(group => {
            const pending = Array.from(group.childNodes).filter(node => node.nodeType !== 3 || node.textContent.trim());
            group.remove();
            nextPage();
            while (pending.length) {
                let node = pending.shift();
                if (node.nodeType === 3) {
                    const paragraph = document.createElement('p');
                    paragraph.textContent = node.textContent;
                    node = paragraph;
                }
                body.append(node);
                if (!overflows()) continue;
                node.remove();
                const text = node.textContent || '';
                let low = 0;
                let high = Math.max(0, text.length - 1);
                while (low < high) {
                    const middle = Math.ceil((low + high) / 2);
                    const [part] = fragments(node, middle);
                    body.append(part);
                    const fits = !overflows();
                    part.remove();
                    if (fits) low = middle;
                    else high = middle - 1;
                }
                if (low > 0) {
                    if (/[\uD800-\uDBFF]/.test(text[low - 1])) low--;
                }
                if (low > 0) {
                    const [part, rest] = fragments(node, low);
                    body.append(part);
                    pending.unshift(rest);
                    nextPage();
                } else if (body.childNodes.length) {
                    pending.unshift(node);
                    nextPage();
                } else {
                    // Atomic media cannot be split. Keep it inside this sheet.
                    const frame = document.createElement('div');
                    frame.className = 'a4-atomic-content';
                    frame.append(node);
                    body.append(frame);
                    if (pending.length) nextPage();
                }
            }
        });
        if (hidden) container.classList.remove('a4-measuring');
        viewRevision = target.dataset.a4Revision || source.value;
        viewPages = Array.from(target.querySelectorAll(':scope > .a4-sheet'));
    }

    async function preview(win, text) {
        if (!HEADER.test(text)) return false;
        if (viewRevision !== text || !viewPages.length) {
            if (typeof renderMarkdown === 'function') await renderMarkdown({ force: true });
        }
        if (source.value !== text || win.closed) return true;
        if (window.A4Presentation && viewPages.length) window.A4Presentation.mount(win, viewPages);
        return true;
    }

    function navigateView(delta) {
        const container = document.getElementById('viewer-container');
        if (!orientation || !container || container.classList.contains('hidden')) return false;
        const sheets = Array.from(container.querySelectorAll('#viewer > .a4-sheet'));
        if (!sheets.length) return false;
        const top = container.getBoundingClientRect().top;
        let current = 0;
        sheets.forEach((sheet, index) => {
            if (sheet.getBoundingClientRect().top <= top + 24) current = index;
        });
        sheets[Math.max(0, Math.min(sheets.length - 1, current + delta))].scrollIntoView({ block: 'start', behavior: 'instant' });
        return true;
    }
    document.addEventListener?.('keydown', event => {
        if (!event.ctrlKey || event.altKey || event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        if (event.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
        if (navigateView(event.key === 'ArrowRight' ? 1 : -1)) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);

    window.A4Pages = { sync, changeDirection, renderView, paginateView, preview, navigateView };
    window.createA4File = function (direction, event) {
        event?.stopPropagation();
        if (!['portrait', 'landscape'].includes(direction)) return;
        setNewFileMenuVisible(false);
        createNewFile();
        toggleMode('edit');
        updateContent(`<!-- mdpro-a4: ${direction} -->\n`);
        source.dispatchEvent(new Event('input', { bubbles: true }));
        pages[0]?.input.focus();
    };
    sync(source.value);
}());

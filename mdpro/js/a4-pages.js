/* Opt-in paged Markdown editor. Automatic wraps never alter the source text. */
(function () {
    'use strict';
    const HEADER = /^<!-- mdpro-a4: (portrait|landscape) -->\n/;
    const BREAK = '\n<!-- mdpro-a4-page-break -->\n';
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
    let sections = [];
    let pages = [];
    let sending = false;
    let composing = false;
    let lastText = null;
    let history = [];
    let historyIndex = -1;

    function serialize() {
        return `<!-- mdpro-a4: ${orientation} -->\n` + sections.join(BREAK);
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

    function split(text, width, height) {
        measure.style.width = width + 'px';
        const chunks = [];
        let start = 0;
        do {
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
            chunks.push({ start, text: text.slice(start, start + size) });
            start += size;
        } while (start < text.length);
        return chunks;
    }

    function sourceOffset(page) {
        return `<!-- mdpro-a4: ${orientation} -->\n`.length +
            sections.slice(0, page.section).reduce((sum, text) => sum + text.length + BREAK.length, 0) + page.start;
    }

    function selection(page, input) {
        const offset = sourceOffset(page);
        source.setSelectionRange(offset + input.selectionStart, offset + input.selectionEnd);
    }

    function render(caret) {
        const scroll = viewport.scrollTop;
        host.replaceChildren();
        pages = [];
        host.dataset.orientation = orientation;
        // Use a real sheet to measure the CSS millimetre dimensions.
        const probe = document.createElement('section');
        probe.className = 'a4-sheet';
        const area = document.createElement('textarea');
        area.className = 'a4-text';
        probe.append(area);
        host.append(probe);
        const width = area.clientWidth || (orientation === 'portrait' ? 170 : 257) * 96 / 25.4;
        const height = area.clientHeight || (orientation === 'portrait' ? 257 : 170) * 96 / 25.4;
        probe.remove();
        sections.forEach((text, section) => {
            split(text, width, height).forEach(chunk => {
                const page = { ...chunk, section };
                const sheet = document.createElement('section');
                sheet.className = 'a4-sheet';
                const input = document.createElement('textarea');
                input.className = 'a4-text';
                input.spellcheck = false;
                input.value = chunk.text;
                input.placeholder = '이곳에 마크다운 내용을 입력하세요…';
                input.setAttribute('aria-label', `A4 ${orientation === 'portrait' ? '세로' : '가로'} ${pages.length + 1} 페이지`);
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
                    publish();
                    render({ section, position });
                }
                input.addEventListener('input', () => {
                    // Some engines send a final input after compositionend.
                    if (input.isConnected) edit();
                });
                input.addEventListener('keydown', event => {
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
                number.textContent = `${pages.length + 1} · A4 ${orientation === 'portrait' ? '세로' : '가로'}`;
                sheet.append(input, number);
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
        if (!orientation) { host.replaceChildren(); return; }
        sections = text.slice(match[0].length).split(BREAK);
        render();
    }

    source.addEventListener('input', () => sync(source.value));
    window.A4Pages = { sync };
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

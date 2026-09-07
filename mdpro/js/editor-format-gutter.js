(function () {
    'use strict';

    const MAX_MEASURE_CHARS = 300000;
    let textarea;
    let wrapper;
    let gutter;
    let measure;
    let frameId = 0;
    let scrollFrameId = 0;
    let coverFolded = false;
    let coverScrollFloor = 0;
    let coverSummary;
    let savedPaddingBottom = '';
    let coverIdentity = '';

    function unfoldCover() {
        coverFolded = false;
        coverScrollFloor = 0;
        coverSummary.hidden = true;
        wrapper.classList.remove('note-cover-folded');
        textarea.style.paddingBottom = savedPaddingBottom;
        const highlight = document.getElementById('viewer-edit-highlight');
        if (highlight) highlight.style.paddingBottom = '';
        textarea.scrollTop = 0;
        schedule();
    }

    function coverLabel(block) {
        try {
            const config = JSON.parse(block.replace(/^<!--\s*note-cover\b/i, '').replace(/-->$/, ''));
            const values = (config.elements || []).filter(item => item.type === 'text')
                .map(item => String(item.text || '').trim()).filter(Boolean);
            return '표지 · ' + values.join(' · ');
        } catch (_) { return '표지'; }
    }

    function classifyLines(lines) {
        let inCode = false;
        let previousKind = '';
        return lines.map(function (line) {
            const text = String(line || '');
            const trimmed = text.trimStart();
            let match;
            let kind = '';
            let label = '';
            let title = '';

            if (/^(```|~~~)/.test(trimmed)) {
                kind = 'code'; label = 'CODE'; title = inCode ? '코드 블록 끝' : '코드 블록 시작';
                inCode = !inCode;
            } else if (!inCode && (match = trimmed.match(/^(#{1,6})(?:\s+|$)/))) {
                kind = 'heading'; label = 'H' + match[1].length; title = '제목 ' + label;
            } else if (!inCode && /^>\s?/.test(trimmed)) {
                kind = 'quote'; label = 'QUOTE'; title = '인용문';
            } else if (!inCode && /^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
                kind = 'rule'; label = 'HR'; title = '구분선';
            } else if (!inCode && /^\s*(?:[-+*]|\d+[.)])\s+/.test(text)) {
                kind = 'list';
                if (previousKind !== 'list') { label = 'LIST'; title = '목록 시작'; }
            } else if (!inCode && /^\s*\|.*\|\s*$/.test(text)) {
                kind = 'table';
                if (previousKind !== 'table') { label = 'TABLE'; title = '표 시작'; }
            }
            previousKind = kind;
            return label ? { label: label, kind: kind, title: title } : null;
        });
    }

    function copyMeasureTypography(computed) {
        [
            'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant',
            'fontStretch', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
        ].forEach(function (property) {
            measure.style[property] = computed[property];
        });
        measure.style.width = textarea.clientWidth + 'px';
    }

    function selectSourceLine(lineIndex, lines) {
        let start = 0;
        for (let i = 0; i < lineIndex; i += 1) start += lines[i].length + 1;
        const end = start + lines[lineIndex].length;
        textarea.focus();
        textarea.setSelectionRange(start, end);
    }

    function syncMarkerScroll() {
        scrollFrameId = 0;
        if (!textarea || !gutter) return;
        if (coverFolded && textarea.scrollTop < coverScrollFloor) textarea.scrollTop = coverScrollFloor;
        gutter.querySelectorAll('.editor-format-marker').forEach(function (button) {
            // Keep the cover control at the editor's top edge while the source scrolls.
            if (button.classList.contains('editor-cover-fold')) return;
            button.style.top = (Number(button.dataset.sourceTop) - textarea.scrollTop) + 'px';
        });
    }

    function scheduleScrollSync() {
        if (scrollFrameId) return;
        scrollFrameId = requestAnimationFrame(syncMarkerScroll);
    }

    function render() {
        frameId = 0;
        if (!textarea || !wrapper || textarea.offsetParent === null) return;
        const source = textarea.value || '';
        gutter.replaceChildren();
        if (!source || source.length > MAX_MEASURE_CHARS) return;

        const lines = source.split('\n');
        const formats = classifyLines(lines);
        const cover = /^\s*<!--\s*note-cover\b[\s\S]*?-->(?:\r?\n)?/i.exec(source);
        if (coverFolded && (!cover || cover[0] !== coverIdentity)) unfoldCover();
        if (!formats.some(Boolean) && !cover) return;

        copyMeasureTypography(getComputedStyle(textarea));
        measure.replaceChildren();
        const fragment = document.createDocumentFragment();
        const anchors = [];
        lines.forEach(function (line, index) {
            const anchor = document.createElement('span');
            anchor.className = 'editor-format-measure-anchor';
            anchor.dataset.line = String(index);
            fragment.appendChild(anchor);
            fragment.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) fragment.appendChild(document.createTextNode('\n'));
            anchors.push(anchor);
        });
        measure.appendChild(fragment);

        if (cover) {
            const endLine = source.slice(0, cover[0].length).split('\n').length - 1;
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
            // Without a trailing newline the last anchor is on the --> line itself.
            // Include that entire line in the hidden area, even for a cover-only document.
            const endTop = (anchors[endLine] ? anchors[endLine].offsetTop : measure.scrollHeight)
                + (cover[0].endsWith('\n') ? 0 : lineHeight);
            if (coverFolded) {
                coverScrollFloor = Math.max(0, endTop - 52);
                textarea.style.paddingBottom = textarea.clientHeight + 'px';
                const highlight = document.getElementById('viewer-edit-highlight');
                if (highlight) highlight.style.paddingBottom = textarea.clientHeight + 'px';
                if (textarea.scrollTop < coverScrollFloor) textarea.scrollTop = coverScrollFloor;
            } else {
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'editor-format-marker editor-cover-fold';
                toggle.textContent = '▼';
                toggle.title = '표지 접기';
                toggle.setAttribute('aria-label', '표지 접기');
                toggle.setAttribute('aria-expanded', 'true');
                toggle.style.top = '14px';
                toggle.style.zIndex = '1';
                toggle.addEventListener('click', function () {
                    savedPaddingBottom = textarea.style.paddingBottom;
                    coverIdentity = cover[0];
                    coverFolded = true;
                    textarea.setSelectionRange(coverIdentity.length, coverIdentity.length);
                    wrapper.classList.add('note-cover-folded');
                    coverSummary.querySelector('span').textContent = coverLabel(cover[0].trim());
                    coverSummary.title = coverSummary.querySelector('span').textContent;
                    coverSummary.hidden = false;
                    schedule();
                });
                gutter.appendChild(toggle);
            }
        }

        formats.forEach(function (format, index) {
            if (!format) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'editor-format-marker editor-format-' + format.kind;
            button.textContent = format.label;
            button.title = format.title + ' · 클릭하면 해당 원문 줄을 선택합니다.';
            button.dataset.sourceTop = String(anchors[index].offsetTop);
            button.style.top = (anchors[index].offsetTop - textarea.scrollTop) + 'px';
            button.addEventListener('click', function () { selectSourceLine(index, lines); });
            gutter.appendChild(button);
        });
    }

    function schedule() {
        if (frameId) return;
        frameId = requestAnimationFrame(render);
    }

    function init() {
        textarea = document.getElementById('viewer-edit-ta');
        wrapper = document.getElementById('editor-doc-wrap');
        if (!textarea || !wrapper || wrapper.querySelector('#editor-format-gutter')) return;

        gutter = document.createElement('div');
        gutter.id = 'editor-format-gutter';
        gutter.setAttribute('aria-label', '마크다운 줄 서식 표시');
        measure = document.createElement('div');
        measure.id = 'editor-format-measure';
        measure.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(gutter);
        wrapper.appendChild(measure);
        coverSummary = document.createElement('div');
        coverSummary.id = 'editor-cover-summary';
        coverSummary.hidden = true;
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.textContent = '▶';
        expand.title = '표지 펼치기';
        expand.setAttribute('aria-label', '표지 펼치기');
        expand.setAttribute('aria-expanded', 'false');
        expand.addEventListener('click', unfoldCover);
        coverSummary.append(expand, document.createElement('span'));
        wrapper.prepend(coverSummary);

        textarea.addEventListener('input', schedule);
        textarea.addEventListener('beforeinput', function (event) {
            if (!coverFolded) return;
            const boundary = coverIdentity.length;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start < boundary || (start === boundary && end === boundary
                && /^delete.*Backward$/.test(event.inputType || ''))) {
                event.preventDefault();
                textarea.setSelectionRange(boundary, Math.max(boundary, end));
            }
        });
        textarea.addEventListener('keydown', function (event) {
            // Reveal the source before keyboard navigation can enter hidden text.
            if (coverFolded && (event.key === 'ArrowUp' || event.key === 'PageUp'
                || ((event.ctrlKey || event.metaKey) && /^(Home|a|f)$/i.test(event.key))
                || textarea.selectionStart < coverIdentity.length)) unfoldCover();
        });
        textarea.addEventListener('scroll', scheduleScrollSync, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });
        document.addEventListener('md-viewer-mode-change', schedule);
        if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(textarea);
        schedule();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.refreshEditorFormatGutter = schedule;
})();

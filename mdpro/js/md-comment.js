(function (root, factory) {
    const api = factory(root);

    if (!root && typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (!root) return;

    root.MDComment = api;
    if (!root.document) return;

    const start = function () {
        api.initEditor(root.document);
    };
    if (root.document.readyState === 'loading') {
        root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})(typeof window !== 'undefined' ? window : null, function (root) {
    const OPEN = '<!--';
    const CLOSE = '-->';
    const NONPRINTING_STORAGE_KEY = 'mdpro-show-nonprinting-characters';
    const DEFAULT_HIGHLIGHT_OPTIONS = Object.freeze({
        largeDocumentThreshold: 200000,
        plainTextThreshold: 300000,
        largeDocumentDelayMs: 48
    });
    const DEFAULT_EDITOR_COMMENT_COLORS = Object.freeze({
        light: '#f59e0b',
        dark: '#facc15'
    });
    let activeEditorDebugState = null;
    let activeNonPrintingVisible = false;

    function normalizePositiveNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    function normalizeEditorCommentColor(value, fallback) {
        const candidate = String(value == null ? '' : value).trim();
        return /^#[0-9a-f]{6}$/i.test(candidate)
            ? candidate.toLowerCase()
            : String(fallback || '#facc15').toLowerCase();
    }

    function getHighlightOptions() {
        const configured = root && root.MD_COMMENT_HIGHLIGHT_OPTIONS
            ? root.MD_COMMENT_HIGHLIGHT_OPTIONS
            : {};
        const largeDocumentThreshold = normalizePositiveNumber(
            configured.largeDocumentThreshold,
            DEFAULT_HIGHLIGHT_OPTIONS.largeDocumentThreshold
        );
        return {
            largeDocumentThreshold: largeDocumentThreshold,
            plainTextThreshold: Math.max(
                largeDocumentThreshold,
                normalizePositiveNumber(configured.plainTextThreshold, DEFAULT_HIGHLIGHT_OPTIONS.plainTextThreshold)
            ),
            largeDocumentDelayMs: normalizePositiveNumber(
                configured.largeDocumentDelayMs,
                DEFAULT_HIGHLIGHT_OPTIONS.largeDocumentDelayMs
            )
        };
    }

    function getHighlightMode(value, options, showNonPrinting) {
        const source = String(value == null ? '' : value);
        const settings = options || DEFAULT_HIGHLIGHT_OPTIONS;
        if (showNonPrinting) {
            return source.length >= settings.largeDocumentThreshold ? 'mirror-large' : 'mirror';
        }
        if (source.indexOf(OPEN) < 0) return 'native';
        if (source.length >= settings.plainTextThreshold) return 'plain-large';
        if (source.length >= settings.largeDocumentThreshold) return 'mirror-large';
        return 'mirror';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function createTextMarkup(value, showNonPrinting) {
        const source = String(value == null ? '' : value);
        if (!showNonPrinting) return escapeHtml(source);
        const parts = [];
        let textStart = 0;
        for (let index = 0; index < source.length; index += 1) {
            const character = source[index];
            if (character !== ' ' && character !== '\t' && character !== '\n') continue;
            if (index > textStart) parts.push(escapeHtml(source.slice(textStart, index)));
            if (character === ' ') {
                parts.push('<span class="md-nonprinting-space"> </span>');
            } else if (character === '\t') {
                parts.push('<span class="md-nonprinting-tab">\t</span>');
            } else {
                parts.push('<span class="md-nonprinting-newline"></span>\n');
            }
            textStart = index + 1;
        }
        if (textStart < source.length) parts.push(escapeHtml(source.slice(textStart)));
        return parts.join('');
    }

    function stripForRender(value) {
        return String(value == null ? '' : value).replace(/<!--[\s\S]*?-->/g, function (comment) {
            // note-cover is application metadata that must reach NoteCoverRenderer.
            if (/^<!--\s*note-cover\b/i.test(comment)) return comment;
            return comment.replace(/[^\r\n]/g, '');
        });
    }

    function createHighlightMarkup(value, options) {
        const source = String(value == null ? '' : value);
        const showNonPrinting = !!(options && options.showNonPrinting);
        const parts = [];
        let cursor = 0;

        while (cursor < source.length) {
            const openAt = source.indexOf(OPEN, cursor);
            if (openAt < 0) {
                parts.push(createTextMarkup(source.slice(cursor), showNonPrinting));
                break;
            }
            parts.push(createTextMarkup(source.slice(cursor, openAt), showNonPrinting));
            const closeAt = source.indexOf(CLOSE, openAt + OPEN.length);
            const commentEnd = closeAt < 0 ? source.length : closeAt + CLOSE.length;
            parts.push('<span class="md-editor-comment">' + createTextMarkup(source.slice(openAt, commentEnd), showNonPrinting) + '</span>');
            cursor = commentEnd;
        }

        if (showNonPrinting && source.length > 0) {
            parts.push('<span class="md-nonprinting-newline"></span>');
        }
        if (source.endsWith('\n')) parts.push('\u200b');
        return parts.join('');
    }

    function getToggleReplacement(selectedText) {
        const selected = String(selectedText == null ? '' : selectedText);
        if (selected.startsWith(OPEN) && selected.endsWith(CLOSE)) {
            let inner = selected.slice(OPEN.length, selected.length - CLOSE.length);
            if (inner.startsWith(' ') && inner.endsWith(' ') && inner.length >= 2) {
                inner = inner.slice(1, -1);
            }
            return { replacement: inner, commented: false };
        }
        return { replacement: OPEN + ' ' + selected + ' ' + CLOSE, commented: true };
    }

    function initEditor(doc) {
        const textarea = doc.getElementById('viewer-edit-ta');
        const mirror = doc.getElementById('viewer-edit-highlight');
        const wrapper = doc.getElementById('editor-doc-wrap');
        if (!textarea || !mirror || !wrapper || textarea.__mdCommentEditorBound) return false;

        textarea.__mdCommentEditorBound = true;
        wrapper.classList.add('md-comment-editor-wrap');
        const highlightOptions = getHighlightOptions();
        let highlightFrameId = null;
        let highlightTimerId = null;
        let pendingForce = false;
        let geometryDirty = true;
        let isComposing = false;
        let lastRenderedValue = null;
        let lastRenderedMarkup = null;
        let lastMode = '';
        let lastGeometrySignature = '';
        let largeModeNoticeShown = false;
        try {
            activeNonPrintingVisible = root.localStorage.getItem(NONPRINTING_STORAGE_KEY) === 'true';
        } catch (_) {
            activeNonPrintingVisible = false;
        }
        const debugState = {
            scheduleRequests: 0,
            refreshCount: 0,
            rafRuns: 0,
            timerRuns: 0,
            geometrySyncs: 0,
            markupWrites: 0,
            skippedUnchanged: 0,
            nativeFastPathRuns: 0,
            largePlainPathRuns: 0,
            lastDurationMs: 0,
            maxDurationMs: 0,
            lastMode: '',
            lastChars: 0
        };
        activeEditorDebugState = debugState;

        const typographyProperties = [
            'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontVariant',
            'fontStretch', 'lineHeight', 'letterSpacing', 'wordSpacing',
            'textAlign', 'textIndent', 'textTransform', 'tabSize',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'
        ];

        function getNow() {
            return root.performance && typeof root.performance.now === 'function'
                ? root.performance.now()
                : Date.now();
        }

        function syncGeometry() {
            const computed = root.getComputedStyle(textarea);
            const values = typographyProperties.map(function (property) {
                return computed[property];
            });
            const width = textarea.clientWidth;
            const height = textarea.clientHeight;
            const signature = values.join('\u0001') + '\u0002' + width + '\u0002' + height;
            geometryDirty = false;
            if (signature === lastGeometrySignature) return false;

            typographyProperties.forEach(function (property, index) {
                mirror.style[property] = values[index];
            });
            mirror.style.width = width + 'px';
            mirror.style.height = height + 'px';
            lastGeometrySignature = signature;
            debugState.geometrySyncs += 1;
            return true;
        }

        function syncScroll() {
            mirror.scrollTop = textarea.scrollTop;
            mirror.scrollLeft = textarea.scrollLeft;
        }

        function applyHighlightMode(mode) {
            const mirrorEnabled = mode === 'mirror' || mode === 'mirror-large';
            wrapper.dataset.mdCommentHighlightMode = mode;
            textarea.dataset.mdCommentHighlightMode = mode;
            textarea.classList.toggle('md-comment-editor-input', mirrorEnabled);
            mirror.hidden = !mirrorEnabled;
            if (!mirrorEnabled && mirror.innerHTML) {
                mirror.innerHTML = '';
                lastRenderedMarkup = '';
                debugState.markupWrites += 1;
            }
            if (mode === 'plain-large' && !largeModeNoticeShown) {
                largeModeNoticeShown = true;
                if (typeof root.showToast === 'function') {
                    root.showToast('대용량 문서에서는 입력 속도를 위해 주석 색상 표시를 단순화합니다.');
                }
            }
        }

        function updateNonPrintingButton() {
            const button = doc.getElementById('btn-toggle-nonprinting');
            if (!button) return;
            button.classList.toggle('is-active', activeNonPrintingVisible);
            button.setAttribute('aria-pressed', activeNonPrintingVisible ? 'true' : 'false');
            button.title = (activeNonPrintingVisible ? '인쇄 불가 문자 숨기기' : '인쇄 불가 문자 표시') + ' (Ctrl+Shift+P)';
        }

        function setNonPrintingCharactersVisible(visible, notify) {
            activeNonPrintingVisible = !!visible;
            wrapper.classList.toggle('show-nonprinting-characters', activeNonPrintingVisible);
            updateNonPrintingButton();
            try {
                root.localStorage.setItem(NONPRINTING_STORAGE_KEY, activeNonPrintingVisible ? 'true' : 'false');
            } catch (_) {}
            if (root.MDCm6Prototype && typeof root.MDCm6Prototype.setNonPrintingCharacters === 'function') {
                root.MDCm6Prototype.setNonPrintingCharacters(textarea, activeNonPrintingVisible);
            }
            root.dispatchEvent(new root.CustomEvent('mdpro:nonprinting-change', {
                detail: { visible: activeNonPrintingVisible }
            }));
            scheduleHighlightRefresh({ force: true, geometry: true });
            if (notify && typeof root.showToast === 'function') {
                root.showToast(activeNonPrintingVisible ? '인쇄 불가 문자 표시를 켰습니다.' : '인쇄 불가 문자 표시를 껐습니다.');
            }
            return activeNonPrintingVisible;
        }

        function refresh(force) {
            if (isComposing && !force) return false;
            const startedAt = getNow();
            const source = textarea.value;
            const mode = getHighlightMode(source, highlightOptions, activeNonPrintingVisible);
            debugState.refreshCount += 1;
            debugState.lastChars = source.length;
            debugState.lastMode = mode;

            if (geometryDirty) syncGeometry();
            if (!force && source === lastRenderedValue && mode === lastMode) {
                debugState.skippedUnchanged += 1;
                syncScroll();
                return false;
            }

            applyHighlightMode(mode);
            if (mode === 'mirror' || mode === 'mirror-large') {
                const nextMarkup = createHighlightMarkup(source, { showNonPrinting: activeNonPrintingVisible });
                if (nextMarkup !== lastRenderedMarkup) {
                    mirror.innerHTML = nextMarkup;
                    lastRenderedMarkup = nextMarkup;
                    debugState.markupWrites += 1;
                }
            } else if (mode === 'native') {
                debugState.nativeFastPathRuns += 1;
            } else if (mode === 'plain-large') {
                debugState.largePlainPathRuns += 1;
            }

            lastRenderedValue = source;
            lastMode = mode;
            syncScroll();
            const duration = getNow() - startedAt;
            debugState.lastDurationMs = duration;
            debugState.maxDurationMs = Math.max(debugState.maxDurationMs, duration);
            return true;
        }

        function requestHighlightFrame() {
            if (highlightFrameId !== null) return;
            highlightFrameId = root.requestAnimationFrame(function () {
                highlightFrameId = null;
                debugState.rafRuns += 1;
                const force = pendingForce;
                pendingForce = false;
                refresh(force);
            });
        }

        function scheduleHighlightRefresh(request) {
            const options = request || {};
            debugState.scheduleRequests += 1;
            if (options.geometry) geometryDirty = true;
            if (options.force) pendingForce = true;
            if (isComposing && !options.force) return;

            const useDelay = !options.force
                && textarea.value.length >= highlightOptions.largeDocumentThreshold
                && highlightOptions.largeDocumentDelayMs > 0;
            if (useDelay) {
                if (highlightTimerId !== null) root.clearTimeout(highlightTimerId);
                highlightTimerId = root.setTimeout(function () {
                    highlightTimerId = null;
                    debugState.timerRuns += 1;
                    requestHighlightFrame();
                }, highlightOptions.largeDocumentDelayMs);
                return;
            }
            if (highlightTimerId !== null) {
                root.clearTimeout(highlightTimerId);
                highlightTimerId = null;
            }
            requestHighlightFrame();
        }

        function toggleSelectedComment(event) {
            if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) return false;
            if (event.code !== 'Slash' && event.key !== '/') return false;
            if (doc.activeElement !== textarea && event.target !== textarea) return false;

            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end) {
                if (typeof root.showToast === 'function') root.showToast('주석 처리할 영역을 먼저 선택하세요.');
                return true;
            }

            const selected = textarea.value.slice(start, end);
            const result = getToggleReplacement(selected);
            textarea.focus();
            textarea.setSelectionRange(start, end);

            let inserted = false;
            try {
                inserted = !!doc.execCommand('insertText', false, result.replacement);
            } catch (_) {}
            if (!inserted) {
                textarea.setRangeText(result.replacement, start, end, 'select');
                textarea.dispatchEvent(new root.Event('input', { bubbles: true }));
            }
            textarea.setSelectionRange(start, start + result.replacement.length);
            scheduleHighlightRefresh({ force: true });

            if (typeof root.showToast === 'function') {
                root.showToast(result.commented ? '선택 영역을 주석 처리했습니다.' : '선택 영역의 주석을 해제했습니다.');
            }
            return true;
        }

        function handleNonPrintingShortcut(event) {
            if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return false;
            if (event.code !== 'KeyP' && String(event.key || '').toLowerCase() !== 'p') return false;
            const target = event.target;
            if (target !== textarea && target && target.closest
                && target.closest('input, textarea, select, [contenteditable="true"]:not(.cm-content)')) return false;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
            setNonPrintingCharactersVisible(!activeNonPrintingVisible, true);
            return true;
        }

        textarea.addEventListener('input', function () {
            scheduleHighlightRefresh();
        });
        textarea.addEventListener('scroll', syncScroll, { passive: true });
        textarea.addEventListener('compositionstart', function () {
            isComposing = true;
        });
        textarea.addEventListener('compositionend', function () {
            isComposing = false;
            scheduleHighlightRefresh({ force: true });
        });
        root.addEventListener('resize', function () {
            scheduleHighlightRefresh({ geometry: true });
        });
        root.addEventListener('keydown', toggleSelectedComment, true);
        root.addEventListener('keydown', handleNonPrintingShortcut, true);

        const valueDescriptor = Object.getOwnPropertyDescriptor(root.HTMLTextAreaElement.prototype, 'value');
        if (valueDescriptor && valueDescriptor.get && valueDescriptor.set) {
            Object.defineProperty(textarea, 'value', {
                configurable: true,
                get: function () { return valueDescriptor.get.call(this); },
                set: function (nextValue) {
                    valueDescriptor.set.call(this, nextValue);
                    scheduleHighlightRefresh();
                }
            });
        }

        if (typeof root.ResizeObserver === 'function') {
            const resizeObserver = new root.ResizeObserver(function () {
                scheduleHighlightRefresh({ geometry: true });
            });
            resizeObserver.observe(textarea);
        }
        if (typeof root.MutationObserver === 'function') {
            const styleObserver = new root.MutationObserver(function () {
                scheduleHighlightRefresh({ geometry: true });
            });
            styleObserver.observe(textarea, { attributes: true, attributeFilter: ['class', 'style'] });
            const viewport = doc.getElementById('content-viewport');
            if (viewport) styleObserver.observe(viewport, { attributes: true, attributeFilter: ['class', 'style'] });
        }

        root.refreshMarkdownCommentHighlight = function (options) {
            scheduleHighlightRefresh(options || { force: true, geometry: true });
        };
        root.getMarkdownCommentPerformanceState = function () {
            return Object.assign({}, debugState);
        };
        root.setNonPrintingCharactersVisible = function (visible) {
            return setNonPrintingCharactersVisible(visible, false);
        };
        root.toggleNonPrintingCharacters = function () {
            return setNonPrintingCharactersVisible(!activeNonPrintingVisible, true);
        };
        updateNonPrintingButton();
        scheduleHighlightRefresh({ force: true, geometry: true });
        return true;
    }

    return {
        stripForRender: stripForRender,
        createHighlightMarkup: createHighlightMarkup,
        createTextMarkup: createTextMarkup,
        getToggleReplacement: getToggleReplacement,
        getHighlightMode: getHighlightMode,
        normalizeEditorCommentColor: normalizeEditorCommentColor,
        areNonPrintingCharactersVisible: function () { return activeNonPrintingVisible; },
        getEditorDebugState: function () {
            return activeEditorDebugState ? Object.assign({}, activeEditorDebugState) : null;
        },
        DEFAULT_HIGHLIGHT_OPTIONS: DEFAULT_HIGHLIGHT_OPTIONS,
        DEFAULT_EDITOR_COMMENT_COLORS: DEFAULT_EDITOR_COMMENT_COLORS,
        initEditor: initEditor
    };
});

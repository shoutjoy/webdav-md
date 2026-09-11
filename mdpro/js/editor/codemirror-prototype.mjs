import { EditorState, EditorSelection, StateField } from 'https://esm.sh/@codemirror/state@6';
import { EditorView, Decoration, WidgetType, GutterMarker, gutter, keymap } from 'https://esm.sh/@codemirror/view@6';
import { defaultKeymap, history, historyKeymap } from 'https://esm.sh/@codemirror/commands@6';
import { searchKeymap, highlightSelectionMatches } from 'https://esm.sh/@codemirror/search@6';

const COMMENT_START = '<!--';
const COMMENT_END = '-->';
const DATA_IMAGE_URL_RE = /data:image\/([a-z0-9.+-]+);base64,[a-z0-9+/=]+/gi;
const DATA_IMAGE_FOLD_MIN_LENGTH = 512;

function formatDataSize(base64Length) {
    const bytes = Math.max(0, Math.floor(base64Length * 3 / 4));
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

class DataImageFoldWidget extends WidgetType {
    constructor(mimeSubtype, base64Length, from) {
        super();
        this.mimeSubtype = mimeSubtype;
        this.base64Length = base64Length;
        this.from = from;
    }

    eq(other) {
        return other.mimeSubtype === this.mimeSubtype && other.base64Length === this.base64Length;
    }

    toDOM(view) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cm-data-image-fold';
        button.title = '클릭하여 인라인 이미지 데이터 펼치기';
        button.setAttribute('aria-label', '접힌 인라인 이미지 데이터 펼치기');
        button.innerHTML = '<span class="cm-data-image-fold-prefix">data:image/' + this.mimeSubtype + ';base64,</span>' +
            '<span class="cm-data-image-fold-ellipsis">\u2026</span>' +
            '<span class="cm-data-image-fold-badge">image_data \u00b7 ' + formatDataSize(this.base64Length) + ' \uc811\ud798</span>';
        button.addEventListener('mousedown', event => {
            event.preventDefault();
            view.dispatch({ selection: { anchor: this.from + 1 }, scrollIntoView: true });
            view.focus();
        });
        return button;
    }

    ignoreEvent() { return false; }
}

class DataImageGutterMarker extends GutterMarker {
    toDOM() {
        const marker = document.createElement('span');
        marker.className = 'cm-data-image-gutter-marker';
        marker.textContent = '\u25b8';
        marker.title = '인라인 이미지 데이터 펼치기';
        return marker;
    }
}

const dataImageGutterMarker = new DataImageGutterMarker();
const dataImageGutter = gutter({
    class: 'cm-data-image-gutter',
    lineMarker(view, line) {
        const text = view.state.doc.sliceString(line.from, line.to);
        DATA_IMAGE_URL_RE.lastIndex = 0;
        const match = DATA_IMAGE_URL_RE.exec(text);
        return match && match[0].length >= DATA_IMAGE_FOLD_MIN_LENGTH ? dataImageGutterMarker : null;
    },
    domEventHandlers: {
        mousedown(view, line, event) {
            const text = view.state.doc.sliceString(line.from, line.to);
            DATA_IMAGE_URL_RE.lastIndex = 0;
            const match = DATA_IMAGE_URL_RE.exec(text);
            if (!match || match[0].length < DATA_IMAGE_FOLD_MIN_LENGTH) return false;
            event.preventDefault();
            view.dispatch({ selection: { anchor: line.from + match.index + 1 }, scrollIntoView: true });
            view.focus();
            return true;
        }
    }
});

function buildDataImageDecorations(state) {
    const source = state.doc.toString();
    const selection = state.selection.main;
    const ranges = [];
    DATA_IMAGE_URL_RE.lastIndex = 0;
    let match;
    while ((match = DATA_IMAGE_URL_RE.exec(source))) {
        const from = match.index;
        const to = from + match[0].length;
        if (match[0].length < DATA_IMAGE_FOLD_MIN_LENGTH) continue;
        if (selection.from >= from && selection.from <= to) continue;
        const prefixLength = match[0].indexOf(',') + 1;
        ranges.push(Decoration.replace({
            widget: new DataImageFoldWidget(match[1], match[0].length - prefixLength, from),
            inclusive: false
        }).range(from, to));
    }
    return Decoration.set(ranges, true);
}

const dataImageDecorations = StateField.define({
    create: buildDataImageDecorations,
    update(value, transaction) {
        if (transaction.docChanged || transaction.selection) return buildDataImageDecorations(transaction.state);
        return value.map(transaction.changes);
    },
    provide: field => EditorView.decorations.from(field)
});

function buildCommentDecorations(state) {
    const source = state.doc.toString();
    const ranges = [];
    let cursor = 0;
    while (cursor < source.length) {
        const start = source.indexOf(COMMENT_START, cursor);
        if (start < 0) break;
        const close = source.indexOf(COMMENT_END, start + COMMENT_START.length);
        const end = close < 0 ? source.length : close + COMMENT_END.length;
        ranges.push(Decoration.mark({ class: 'cm-md-comment' }).range(start, end));
        if (close < 0) break;
        cursor = end;
    }
    return Decoration.set(ranges, true);
}

const commentDecorations = StateField.define({
    create: buildCommentDecorations,
    update(value, transaction) {
        return transaction.docChanged ? buildCommentDecorations(transaction.state) : value.map(transaction.changes);
    },
    provide: field => EditorView.decorations.from(field)
});

function toggleComment(view) {
    const selection = view.state.selection.main;
    let from = selection.from;
    let to = selection.to;
    if (from === to) {
        const line = view.state.doc.lineAt(from);
        from = line.from;
        to = line.to;
    }
    const selected = view.state.doc.sliceString(from, to);
    const trimmed = selected.trim();
    let insert;
    let anchor;
    let head;
    if (trimmed.startsWith(COMMENT_START) && trimmed.endsWith(COMMENT_END)) {
        const leading = selected.indexOf(COMMENT_START);
        const trailing = selected.length - (selected.lastIndexOf(COMMENT_END) + COMMENT_END.length);
        const body = selected.slice(leading + COMMENT_START.length, selected.length - trailing - COMMENT_END.length)
            .replace(/^\s/, '')
            .replace(/\s$/, '');
        insert = selected.slice(0, leading) + body + selected.slice(selected.length - trailing);
        anchor = from + leading;
        head = anchor + body.length;
    } else {
        insert = '<!-- ' + selected + ' -->';
        anchor = from + 4;
        head = anchor + selected.length;
    }
    view.dispatch({
        changes: { from, to, insert },
        selection: EditorSelection.range(anchor, head),
        userEvent: 'input.comment'
    });
    return true;
}

function ensureStyles() {
    if (document.getElementById('md-cm6-prototype-style')) return;
    const style = document.createElement('style');
    style.id = 'md-cm6-prototype-style';
    style.textContent = `
        .md-cm6-prototype{position:absolute;inset:0;min-width:0;background:#020617;color:#e5e7eb;overflow:hidden}
        .md-cm6-prototype .cm-editor{height:100%;font:inherit;background:transparent}
        .md-cm6-prototype .cm-scroller{overflow:auto;font-family:inherit;line-height:1.75;padding:20px 24px}
        .md-cm6-prototype .cm-content{min-height:100%;caret-color:#f8fafc}
        .md-cm6-prototype .cm-gutters{background:#0f172a;color:#64748b;border-right:1px solid #1e293b}
        .md-cm6-prototype .cm-activeLine,.md-cm6-prototype .cm-activeLineGutter{background:rgba(99,102,241,.08)}
        .md-cm6-prototype .cm-selectionBackground{background:rgba(99,102,241,.32)!important}
        .md-cm6-prototype .cm-md-comment{color:#7dd3fc;background:rgba(14,116,144,.16);border-radius:3px}
        .md-cm6-prototype .cm-data-image-fold{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin:0 2px;padding:2px 8px;border:1px solid #475569;border-radius:6px;background:#111827;color:#cbd5e1;font:600 .82em/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;vertical-align:baseline;cursor:pointer}
        .md-cm6-prototype .cm-data-image-fold:hover,.md-cm6-prototype .cm-data-image-fold:focus-visible{border-color:#818cf8;background:#1e1b4b;outline:none}
        .md-cm6-prototype .cm-data-image-fold-prefix{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .md-cm6-prototype .cm-data-image-fold-ellipsis{color:#94a3b8}
        .md-cm6-prototype .cm-data-image-fold-badge{flex:0 0 auto;padding:0 5px;border-radius:4px;background:#312e81;color:#e0e7ff}
        .md-cm6-prototype .cm-data-image-gutter{width:24px;background:transparent;border-right:0}
        .md-cm6-prototype .cm-data-image-gutter-marker{display:flex;width:20px;height:20px;align-items:center;justify-content:center;border:1px solid #475569;border-radius:5px;background:#111827;color:#a5b4fc;font:700 12px/1 sans-serif;cursor:pointer}
        .md-cm6-prototype .cm-data-image-gutter-marker:hover{border-color:#818cf8;background:#312e81;color:#eef2ff}
        .md-cm6-source-hidden{display:none!important}
        html:not(.dark) .md-cm6-prototype{background:#fff;color:#1f2937}
        html:not(.dark) .md-cm6-prototype .cm-content{caret-color:#111827}
        html:not(.dark) .md-cm6-prototype .cm-gutters{background:#f8fafc;color:#64748b;border-right-color:#e2e8f0}
        html:not(.dark) .md-cm6-prototype .cm-data-image-fold{border-color:#cbd5e1;background:#f8fafc;color:#334155}
        html:not(.dark) .md-cm6-prototype .cm-data-image-fold:hover,html:not(.dark) .md-cm6-prototype .cm-data-image-fold:focus-visible{border-color:#6366f1;background:#eef2ff}
        html:not(.dark) .md-cm6-prototype .cm-data-image-fold-badge{background:#e0e7ff;color:#4338ca}
        html:not(.dark) .md-cm6-prototype .cm-data-image-gutter-marker{border-color:#cbd5e1;background:#f8fafc;color:#4f46e5}
        html:not(.dark) .md-cm6-prototype .cm-data-image-gutter-marker:hover{border-color:#6366f1;background:#eef2ff}
    `;
    document.head.appendChild(style);
}

function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function installTextareaCompatibility(textarea, view) {
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    const startDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionStart');
    const endDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionEnd');
    const nativeSetSelectionRange = HTMLTextAreaElement.prototype.setSelectionRange;
    const nativeFocus = HTMLTextAreaElement.prototype.focus;
    const clamp = value => Math.max(0, Math.min(Number(value) || 0, view.state.doc.length));
    const select = (anchor, head) => {
        view.dispatch({ selection: EditorSelection.range(clamp(anchor), clamp(head)), scrollIntoView: true });
    };
    textarea.__mdCm6WriteNativeValue = value => valueDescriptor.set.call(textarea, value);

    Object.defineProperties(textarea, {
        value: {
            configurable: true,
            get: () => view.state.doc.toString(),
            set: value => {
                const next = String(value ?? '');
                valueDescriptor.set.call(textarea, next);
                if (next !== view.state.doc.toString()) {
                    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
                }
            }
        },
        selectionStart: {
            configurable: true,
            get: () => view.state.selection.main.from,
            set: value => select(value, Math.max(clamp(value), view.state.selection.main.to))
        },
        selectionEnd: {
            configurable: true,
            get: () => view.state.selection.main.to,
            set: value => select(Math.min(view.state.selection.main.from, clamp(value)), value)
        }
    });
    textarea.setSelectionRange = (start, end) => select(start, end);
    textarea.focus = () => view.focus();

    return function removeCompatibility() {
        const text = view.state.doc.toString();
        const selection = view.state.selection.main;
        delete textarea.value;
        delete textarea.selectionStart;
        delete textarea.selectionEnd;
        delete textarea.setSelectionRange;
        delete textarea.focus;
        textarea.__mdCm6WriteNativeValue = null;
        valueDescriptor.set.call(textarea, text);
        nativeSetSelectionRange.call(textarea, selection.from, selection.to);
        textarea.__mdCm6NativeFocus = nativeFocus;
    };
}

function percentile(values, ratio) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
}

async function runBenchmark(view, iterations = 10) {
    const fixtures = [
        { name: 'plain', unit: '본문 일반 텍스트 다음 줄\n' },
        { name: 'comments', unit: '본문 <!-- 주석 메모 --> 다음 줄\n' }
    ];
    const results = [];
    const original = view.state.doc.toString();
    window.__mdPerformanceBenchmarkActive = true;
    try {
        for (const fixture of fixtures) {
            for (const size of [10000, 100000, 300000, 600000]) {
                const base = fixture.unit.repeat(Math.ceil(size / fixture.unit.length)).slice(0, size);
                view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: base } });
                await nextPaint();
                const values = [];
                for (let index = 0; index < iterations; index += 1) {
                    const started = performance.now();
                    view.dispatch({ changes: { from: view.state.doc.length, insert: String(index % 10) } });
                    await nextPaint();
                    values.push(performance.now() - started);
                }
                results.push({
                    fixture: fixture.name,
                    chars: size,
                    p50Ms: Number(percentile(values, 0.5).toFixed(2)),
                    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
                    maxMs: Number(Math.max(...values).toFixed(2))
                });
            }
        }
    } finally {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } });
        window.__mdPerformanceBenchmarkActive = false;
    }
    return { generatedAt: new Date().toISOString(), results };
}

function mountBenchmarkControls(view) {
    if (new URLSearchParams(location.search).get('cmBench') !== '1') return;
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;width:min(520px,90vw);max-height:65vh;overflow:auto;padding:10px;background:#111827;color:#e5e7eb;border-radius:8px;font:12px/1.45 monospace';
    const button = document.createElement('button');
    button.id = 'md-cm6-bench-run';
    button.textContent = 'Run CodeMirror benchmark';
    button.style.cssText = 'padding:7px 10px;background:#4f46e5;color:white;border:0;border-radius:5px';
    const output = document.createElement('pre');
    output.id = 'md-cm6-bench-output';
    output.textContent = 'Ready';
    output.style.whiteSpace = 'pre-wrap';
    button.addEventListener('click', async () => {
        button.disabled = true;
        output.textContent = 'Running...';
        try { output.textContent = JSON.stringify(await runBenchmark(view), null, 2); }
        catch (error) { output.textContent = JSON.stringify({ error: String(error && error.stack || error) }); }
        finally { button.disabled = false; }
    });
    panel.append(button, output);
    document.body.appendChild(panel);
}

function mount(textarea, options = {}) {
    if (!textarea || textarea.__mdCm6View) return textarea && textarea.__mdCm6View;
    ensureStyles();
    const host = document.createElement('div');
    host.className = 'md-cm6-prototype';
    host.id = 'md-cm6-editor';
    textarea.parentElement.appendChild(host);
    textarea.classList.add('md-cm6-source-hidden');
    let syncTimer = null;
    let lastFlushedValue = textarea.value;
    const flush = () => {
        if (!textarea.__mdCm6View) return;
        const value = textarea.__mdCm6View.state.doc.toString();
        if (lastFlushedValue === value) return;
        lastFlushedValue = value;
        if (textarea.__mdCm6WriteNativeValue) textarea.__mdCm6WriteNativeValue(value);
        else textarea.value = value;
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    };
    const scheduleFlush = () => {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(flush, Number(options.syncDelayMs) || 120);
    };
    const view = new EditorView({
        state: EditorState.create({
            doc: textarea.value,
            extensions: [
                history(),
                highlightSelectionMatches(),
                commentDecorations,
                dataImageDecorations,
                dataImageGutter,
                EditorView.lineWrapping,
                EditorView.updateListener.of(update => {
                    if (update.docChanged) scheduleFlush();
                }),
                keymap.of([
                    { key: 'Mod-/', run: toggleComment },
                    ...defaultKeymap,
                    ...historyKeymap,
                    ...searchKeymap
                ])
            ]
        }),
        parent: host
    });
    textarea.__mdCm6View = view;
    textarea.__mdCm6RemoveCompatibility = installTextareaCompatibility(textarea, view);
    view.focus();
    window.addEventListener('beforeunload', flush);
    mountBenchmarkControls(view);
    return view;
}

function destroy(textarea) {
    if (!textarea || !textarea.__mdCm6View) return false;
    const view = textarea.__mdCm6View;
    if (textarea.__mdCm6RemoveCompatibility) textarea.__mdCm6RemoveCompatibility();
    textarea.__mdCm6RemoveCompatibility = null;
    view.destroy();
    const host = document.getElementById('md-cm6-editor');
    if (host) host.remove();
    textarea.classList.remove('md-cm6-source-hidden');
    textarea.__mdCm6View = null;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
}

window.MDCm6Prototype = Object.freeze({ mount, destroy, toggleComment, runBenchmark });

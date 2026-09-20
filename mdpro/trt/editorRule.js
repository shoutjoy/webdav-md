(function () {
    function applySelectionReplacement(options) {
        const opts = options || {};
        const editorTextarea = opts.editorTextarea;
        if (!editorTextarea) return false;
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        if (start === end) return false;

        const replacement = String(opts.replacement || '');
        const cmView = editorTextarea.__mdCm6View;
        const selectWholeWrappedText = !!opts.selectWholeWrappedText;
        const selectionStart = selectWholeWrappedText
            ? start
            : start + (opts.innerOffsetStart || 0);
        const selectionEnd = selectWholeWrappedText
            ? start + replacement.length
            : selectionStart + (opts.innerLength || 0);

        if (cmView && typeof cmView.dispatch === 'function') {
            const scrollTop = cmView.scrollDOM ? cmView.scrollDOM.scrollTop : 0;
            cmView.dispatch({
                changes: { from: start, to: end, insert: replacement },
                selection: { anchor: selectionStart, head: selectionEnd },
                userEvent: 'input.selection-wrap'
            });
            if (cmView.scrollDOM) cmView.scrollDOM.scrollTop = scrollTop;
            if (typeof cmView.focus === 'function') cmView.focus();
            if (typeof opts.onAfterApply === 'function') opts.onAfterApply();
            return true;
        }

        const currentScrollTop = editorTextarea.scrollTop;
        editorTextarea.focus();
        editorTextarea.setSelectionRange(start, end);
        if (typeof editorTextarea.setRangeText === 'function') {
            editorTextarea.setRangeText(replacement, start, end, 'end');
        } else {
            document.execCommand('insertText', false, replacement);
        }
        editorTextarea.scrollTop = currentScrollTop;

        editorTextarea.setSelectionRange(selectionStart, selectionEnd);
        if (typeof opts.onAfterApply === 'function') opts.onAfterApply();
        return true;
    }

    function wrapSelectedTextWithPair(options) {
        const opts = options || {};
        const editorTextarea = opts.editorTextarea;
        if (!opts.isEditMode || !editorTextarea) return false;

        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        if (start === end) return false;

        const before = String(opts.before || '');
        const after = String(opts.after || '');
        const selectedText = editorTextarea.value.substring(start, end);
        const replacement = before + selectedText + after;
        return applySelectionReplacement({
            editorTextarea: editorTextarea,
            replacement: replacement,
            selectWholeWrappedText: !!opts.selectWholeWrappedText,
            innerOffsetStart: before.length,
            innerLength: selectedText.length,
            onAfterApply: opts.onAfterApply
        });
    }

    function handleSelectionWrapByTypedPair(e, deps) {
        const d = deps || {};
        const editorTextarea = d.editorTextarea;
        if (!d.selectionWrapEnabled) return false;
        if (!d.isEditMode || !editorTextarea) return false;
        const cmView = editorTextarea.__mdCm6View;
        const editorHasFocus = document.activeElement === editorTextarea
            || !!(cmView && cmView.hasFocus);
        if (!editorHasFocus) return false;
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
        if (editorTextarea.selectionStart === editorTextarea.selectionEnd) return false;

        const key = String(e.key || '');
        let before = '';
        let after = '';
        let selectWholeWrappedText = false;

        if (key === '[') { before = '['; after = ']'; }
        else if (key === '(') { before = '('; after = ')'; }
        else if (key === '{') { before = '{'; after = '}'; }
        else if (key === '<') { before = '<'; after = '>'; }
        else if (key === '"') { before = '"'; after = '"'; }
        else if (key === "'") { before = "'"; after = "'"; }
        else if (key === '$') {
            const selectedText = editorTextarea.value.substring(editorTextarea.selectionStart, editorTextarea.selectionEnd);
            const inlineMathWrapped = /^\$[\s\S]*\$$/.test(selectedText) && !/^\$\$[\s\S]*\$\$$/.test(selectedText);
            if (inlineMathWrapped) {
                const inner = selectedText.slice(1, -1);
                e.preventDefault();
                return applySelectionReplacement({
                    editorTextarea: editorTextarea,
                    replacement: '$$' + inner + '$$',
                    selectWholeWrappedText: true,
                    onAfterApply: d.onAfterApply
                });
            }
            before = '$';
            after = '$';
            selectWholeWrappedText = true;
        }
        else if (key === '`') {
            const selectedText = editorTextarea.value.substring(editorTextarea.selectionStart, editorTextarea.selectionEnd);
            if (selectedText.includes('\n')) {
                before = '```\n';
                after = '\n```';
                selectWholeWrappedText = true;
            } else {
                before = '`';
                after = '`';
                selectWholeWrappedText = false;
            }
        }
        else return false;

        e.preventDefault();
        return wrapSelectedTextWithPair({
            isEditMode: d.isEditMode,
            editorTextarea: editorTextarea,
            before: before,
            after: after,
            selectWholeWrappedText: selectWholeWrappedText,
            onAfterApply: d.onAfterApply
        });
    }

    window.EditorRule = {
        wrapSelectedTextWithPair: wrapSelectedTextWithPair,
        handleSelectionWrapByTypedPair: handleSelectionWrapByTypedPair
    };
})();

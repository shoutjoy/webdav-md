/* Model-specific reasoning controls. No credentials or generation requests are stored here. */
(function (root) {
    'use strict';
    const specs = new Map();
    const key = c => JSON.stringify([c.provider, c.profile || '', c.model || '']);
    const levels = (kind, values, source, note) => ({ kind, values, source, note: note || '' });
    function describe(c, metadata) {
        const p = c.provider, m = String(c.model || '').replace(/^models\//, '').toLowerCase();
        let spec = null;
        if (p === 'openai-compatible' && c.profile === 'exaone' && m === 'k-exaone_v2.5') spec = levels('exaone', ['low', 'high', 'max'], '공식 모델 규격', '항상 추론하는 모델입니다. 끄기 옵션은 지원하지 않습니다.');
        if (spec) specs.set(key(c), spec); else specs.delete(key(c));
        return spec;
    }
    function valid(spec, value) {
        if (!spec || value === '' || value == null) return false;
        if (spec.kind === 'gemini-budget') return Number.isInteger(Number(value)) && (Number(value) === -1 || spec.allowOff && Number(value) === 0 || Number(value) >= spec.min && Number(value) <= spec.max);
        return spec.values.some(v => String(v) === String(value));
    }
    function read(c) {
        let saved = null;
        try { saved = JSON.parse(root.localStorage.getItem('ss_ai_reasoning_settings_v1:' + key(c)) || 'null'); } catch (_) {}
        const spec = specs.get(key(c));
        return saved && valid(spec, saved.value) ? Object.assign({}, c, { value: saved.value }) : null;
    }
    function save(c, value) {
        const storageKey = 'ss_ai_reasoning_settings_v1:' + key(c);
        if (value === '') { root.localStorage.removeItem(storageKey); return; }
        if (!valid(specs.get(key(c)), value)) throw new Error('이 모델이 지원하지 않는 추론 설정입니다.');
        root.localStorage.setItem(storageKey, JSON.stringify({ value }));
    }
    function choice(provider, model, request) {
        const c = request && request.reasoningSetting;
        if (!c || request.disableThinking === true || c.provider !== provider || c.model !== model) return null;
        const spec = specs.get(key(c));
        return valid(spec, c.value) ? { spec, value: c.value } : null;
    }
    function apply(provider, model, body, request) {
        const selected = choice(provider, model, request);
        if (!selected) return body;
        const { spec, value } = selected;
        if (spec.kind === 'exaone') body.reasoning_effort = value;
        else if (spec.kind === 'deepseek') { body.thinking = { type: value === 'off' ? 'disabled' : 'enabled' }; if (value !== 'off') body.reasoning_effort = value; else delete body.reasoning_effort; }
        else if (spec.kind === 'openai') body.reasoning = Object.assign({}, body.reasoning, { effort: value });
        else if (spec.kind === 'lmstudio') body.reasoning = value;
        else if (spec.kind === 'litertlm') body.thinking = String(value) === 'true';
        else if (spec.kind === 'ollama') body.think = spec.values.find(v => String(v) === String(value));
        else if (/^gemini-/.test(spec.kind)) {
            body.thinkingConfig = spec.kind === 'gemini-budget' ? { thinkingBudget: Number(value) } : { thinkingLevel: value };
        }
        return body;
    }
    function mount(host, getContext, detect, isRunning) {
        const details = root.document.createElement('details'); details.className = 'ai-chat-reasoning-settings';
        const summary = root.document.createElement('summary'); summary.textContent = 'TL'; summary.title = 'Think Level'; summary.setAttribute('aria-label', 'Think Level · 추론 수준 설정');
        const panel = root.document.createElement('div'); panel.className = 'ai-chat-reasoning-settings-body';
        const hint = root.document.createElement('small'); hint.setAttribute('role','status');
        const retry = root.document.createElement('button'); retry.type = 'button'; retry.textContent = '지원 다시 확인';
        panel.append(hint, retry); details.append(summary, panel); host.append(details);
        let current = null, input = null, signature = '', ticket = 0;
        function render(spec, error) {
            if (input) input.remove(); input = null;
            details.hidden = !spec; if (!spec) details.open = false;
            summary.title = 'Think Level' + (spec ? ' · ' + spec.source + (spec.note ? ' · ' + spec.note : '') : '');
            hint.hidden = true;
            hint.textContent = error || (spec ? spec.source + (spec.note ? ' · ' + spec.note : '') : '이 모델의 설정 지원 정보가 없습니다.');
            retry.hidden = true;
            if (!spec) return;
            if (spec.kind === 'gemini-budget') {
                input = root.document.createElement('input'); input.type = 'number'; input.min = '-1'; input.max = String(spec.max); input.step = '1'; input.placeholder = '자동'; input.title = '추론 토큰 예산 · ' + spec.note + ' · ' + spec.min + '~' + spec.max;
            } else {
                input = root.document.createElement('select'); input.add(new Option('자동', ''));
                spec.values.forEach(v => input.add(new Option(v === true ? '추론 켜기' : v === false || v === 'off' || v === 'none' ? '추론 끄기' : String(v), String(v))));
            }
            input.setAttribute('aria-label', spec.kind === 'gemini-budget' ? '추론 토큰 예산' : '모델별 추론 강도');
            input.value = read(current)?.value ?? ''; input.disabled = isRunning(); panel.insertBefore(input, hint);
            input.onchange = () => { try { save(current, input.value); input.setAttribute('aria-invalid','false'); hint.hidden = true; } catch (error) { input.setAttribute('aria-invalid','true'); hint.hidden = false; hint.textContent = error.message; } };
        }
        async function refresh(force) {
            const context = getContext(), next = key(context);
            if (input) input.disabled = isRunning(); retry.disabled = isRunning();
            if (next === signature && !force) return;
            signature = next; current = context; const id = ++ticket;
            const known = describe(context);
            render(known, known ? '' : /^(ollama|lmstudio|litertlm)$/.test(context.provider) ? '모델 추론 설정을 확인하는 중…' : '추론 설정 지원 미확인');
            try { const spec = await detect(context); if (id === ticket) render(spec, spec ? '' : '추론 설정 지원 미확인'); }
            catch (_) { if (id === ticket) render(null, '지원 정보 조회 실패 · 서버 주소와 실행 상태를 확인하세요.'); }
        }
        retry.onclick = () => refresh(true);
        return { refresh, selection: () => read(getContext()) };
    }
    root.AIReasoningSettings = Object.freeze({ describe, read, save, choice, apply, mount });
})(window);

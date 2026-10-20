(function (root) {
    'use strict';
    const catalog = [
        ['lmstudio', 'LM Studio', 'LMStudio', 'lmstudio'],
        ['litertlm', 'LiteRT-LM', 'LiteRTLM', 'litertlm'],
        ['aistudio', 'AI Studio (Gemini)', 'Gemini', 'gemini'],
        ['ollama', 'Ollama', 'Ollama', 'ollama'],
        ['lemonade', 'Lemonade', 'Lemonade', 'lemonade'],
        ['ollama-npu', 'Lemonade NPU', 'NPU', 'npu'],
        ['deepseek', 'DeepSeek (유료)', 'Deepseek', 'deepseek'],
        ['openai-compatible', 'OrcaRouter / OpenAI 호환', 'OpenAICompatible', 'openai_compatible'],
        ['openai', 'OpenAI · ChatGPT 모델 (유료 API)', 'OpenAI', 'openai']
    ];
    function entry(provider) { return catalog.find(row => row[0] === provider); }
    function read(tool) {
        let saved;
        try { saved = JSON.parse(root.localStorage.getItem('mdv_ai_tool_' + tool) || 'null'); } catch (_) { /* Use Jena defaults. */ }
        if (!saved && tool === 'img2math') {
            try { saved = JSON.parse(root.localStorage.getItem('mdv_img2math_model_selection_v1') || 'null'); } catch (_) { /* Use Jena defaults. */ }
        }
        const provider = entry(saved && saved.provider) ? saved.provider : root.localStorage.getItem('ss_ai_chat_provider') || 'lmstudio';
        const row = entry(provider) || catalog[0];
        return { provider: row[0], model: saved && saved.provider === row[0] ? saved.model || '' : root.localStorage.getItem('ss_ai_chat_' + row[3] + '_model') || '' };
    }
    function save(tool, selection) {
        if (!entry(selection.provider)) throw new Error('지원하지 않는 AI 공급자입니다.');
        const value = { provider: selection.provider, model: String(selection.model || '') };
        root.localStorage.setItem('mdv_ai_tool_' + tool, JSON.stringify(value));
        return value;
    }
    async function models(provider, refresh) {
        const row = entry(provider);
        const bridge = root.AIChatBridge;
        if (!row || !bridge) throw new Error('AI Jena 연결 모듈이 준비되지 않았습니다.');
        const method = (refresh ? 'refresh' : 'getCached') + row[2] + 'Models';
        const result = typeof bridge[method] === 'function' ? await bridge[method]() : [];
        return [...new Set((Array.isArray(result) ? result : result && result.models || []).map(item => typeof item === 'string' ? item : item.id || item.name).filter(Boolean))];
    }
    function mount(container, tool, options = {}) {
        const doc = container.ownerDocument;
        if (container.__aiToolPicker) return container.__aiToolPicker;
        const initial = read(tool);
        const wrap = doc.createElement('div');
        wrap.className = 'ai-tool-provider-controls';
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0;max-width:100%';
        const provider = doc.createElement('select');
        provider.id = tool + '-provider-select';
        provider.setAttribute('aria-label', 'AI 공급자');
        catalog.forEach(row => { const option = doc.createElement('option'); option.value = row[0]; option.textContent = row[1]; provider.appendChild(option); });
        provider.value = initial.provider;
        const model = options.modelSelect || doc.createElement('select');
        if (!options.modelSelect) model.id = tool + '-model-select';
        model.setAttribute('aria-label', 'AI 모델');
        [provider, model].forEach(select => { select.style.cssText += ';max-width:100%;min-width:0;padding:6px 8px;border:1px solid #3b6574;border-radius:8px;background:#102633;color:#e2e8f0;font-size:12px'; });
        const refresh = doc.createElement('button');
        refresh.type = 'button'; refresh.textContent = '모델 새로고침';
        refresh.style.cssText = 'padding:6px 8px;border:1px solid #3b6574;border-radius:8px;background:#102633;color:#e2e8f0;font-size:12px';
        const status = doc.createElement('span'); status.setAttribute('role', 'status'); status.style.cssText = 'font-size:12px;overflow-wrap:anywhere';
        wrap.appendChild(provider);
        if (!options.modelSelect) wrap.appendChild(model);
        wrap.appendChild(refresh); wrap.appendChild(status); container.appendChild(wrap);
        let epoch = 0;
        function commit() {
            const selection = save(tool, { provider: provider.value, model: model.value });
            if (options.onChange) options.onChange(selection);
            return selection;
        }
        async function reload(force) {
            const ticket = ++epoch;
            const selectedProvider = provider.value;
            const selected = read(tool);
            const preferred = selected.provider === selectedProvider ? selected.model : '';
            model.replaceChildren(); model.disabled = true; refresh.disabled = true;
            status.textContent = '모델 불러오는 중…';
            try {
                let ids = await models(selectedProvider, force);
                if (!ids.length && !force) ids = await models(selectedProvider, true);
                if (ticket !== epoch) return;
                if (preferred && !ids.includes(preferred)) ids.unshift(preferred);
                ids.forEach(id => { const option = doc.createElement('option'); option.value = id; option.textContent = id; model.appendChild(option); });
                model.value = ids.includes(preferred) ? preferred : ids[0] || '';
                model.disabled = !ids.length;
                status.textContent = ids.length ? '' : '사용 가능한 모델이 없습니다. 설정에서 모델을 확인하세요.';
                commit();
            } catch (error) {
                if (ticket !== epoch) return;
                if (preferred) { const option = doc.createElement('option'); option.value = preferred; option.textContent = preferred; model.appendChild(option); model.disabled = false; }
                status.textContent = '모델 조회 실패 · ' + error.message;
            } finally { if (ticket === epoch) refresh.disabled = false; }
        }
        provider.addEventListener('change', () => { save(tool, { provider: provider.value, model: '' }); reload(true); });
        model.addEventListener('change', commit);
        refresh.addEventListener('click', () => reload(true));
        const picker = { getValue: () => ({ provider: provider.value, model: model.value }), reload };
        container.__aiToolPicker = picker;
        reload(false);
        return picker;
    }
    root.AIToolProviders = Object.freeze({ catalog: () => catalog.map(row => row.slice()), read, save, models, mount });
})(window);

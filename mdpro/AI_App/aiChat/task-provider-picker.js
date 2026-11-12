(function (root) {
    'use strict';
    const providers = [
        ['lmstudio', 'LM Studio'], ['litertlm', 'LiteRT-LM'], ['aistudio', 'AI Studio (Gemini)'],
        ['ollama', 'Ollama'], ['deepseek', 'DeepSeek (유료)'], ['openai-compatible-env', 'OpenAI Compatible'],
        ['lemonade-flm', 'Lemonade FLM NPU'], ['lemonade', 'Lemonade'], ['openai', 'OpenAI · ChatGPT 모델 (유료 API)']
    ];
    const DEFAULT_AI_STUDIO_MODEL = 'gemini-3.5-flash-lite';
    root.AITaskProviders = providers;
    root.mountAITaskPicker = function (container, key, onChange) {
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key) || (key === 'mdv_mermaid_ai_selection_v1' ? localStorage.getItem('mdv_ai_tool_mermaid') : '') || '{}') || {}; } catch (_) {}
        if (saved.provider === 'ollama-npu') saved.provider = 'lemonade-flm';
        if (saved.provider === 'openai-compatible') saved.provider = /^(lemonade|lemonade-flm)$/.test(saved.openAICompatibleProvider || '') ? saved.openAICompatibleProvider : 'openai-compatible-env';
        const host = root.parent !== root ? root.parent : root;
        function parentModels(selectedProvider) {
            const requestId = 'task-models-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { root.removeEventListener('message', receive); reject(new Error('메인 창 AI 연결 확인 시간이 초과됐습니다.')); }, 15000);
                function receive(event) {
                    const data = event.data || {};
                    if (event.source !== host || data.type !== 'mdv-task-models-result' || data.requestId !== requestId) return;
                    clearTimeout(timer); root.removeEventListener('message', receive);
                    if (data.ok) resolve(data.info);
                    else reject(new Error(data.error || 'AI 연결에 실패했습니다.'));
                }
                root.addEventListener('message', receive);
                host.postMessage({ type: 'mdv-task-models-request', requestId, provider: selectedProvider }, '*');
            });
        }
        let hasSavedSelection = Object.prototype.hasOwnProperty.call(saved, 'provider');
        const hasAIStudioCredential = function () {
            try { return !!(host.AIChatBridge && host.AIChatBridge.hasAIStudioCredential && host.AIChatBridge.hasAIStudioCredential()); }
            catch (_) { return false; }
        };
        const provider = document.createElement('select');
        provider.setAttribute('aria-label', 'AI 공급자');
        provider.add(new Option('AI JENA 설정 사용', ''));
        providers.forEach(item => provider.add(new Option(item[1], item[0])));
        provider.value = hasSavedSelection ? (saved.provider || '') : 'aistudio';
        const model = document.createElement('input');
        model.setAttribute('aria-label', 'AI 모델');
        model.placeholder = '모델 선택 또는 ID 직접 입력';
        model.value = saved.model || (provider.value === 'aistudio' ? DEFAULT_AI_STUDIO_MODEL : '');
        const list = document.createElement('datalist');
        list.id = key + '-models'; model.setAttribute('list', list.id);
        const refresh = document.createElement('button');
        refresh.type = 'button'; refresh.textContent = '모델 새로고침';
        const status = document.createElement('small'); status.setAttribute('role', 'status');
        const badge = document.createElement('span');
        badge.className = 'ai-task-connection';
        badge.setAttribute('role', 'status');
        const details = container.closest('details');
        const summary = details && details.querySelector('summary');
        if (summary) summary.appendChild(badge);
        else container.appendChild(badge);
        function connection(text, state) {
            badge.textContent = text;
            badge.dataset.state = state;
            badge.title = text + ' · ' + (model.value || '모델 선택 필요');
        }
        let ticket = 0, resolvedProvider = '', compatibleProvider = saved.openAICompatibleProvider || '';
        function selection() {
            const localCompatible = /^(lemonade|lemonade-flm)$/.test(provider.value);
            return { provider: localCompatible || provider.value === 'openai-compatible-env' ? 'openai-compatible' : provider.value, model: provider.value ? model.value.trim() : '', openAICompatibleProvider: localCompatible ? provider.value : compatibleProvider };
        }
        function save() {
            const value = selection();
            try { localStorage.setItem(key, JSON.stringify({ provider: provider.value, model: value.model, openAICompatibleProvider: compatibleProvider })); } catch (_) {}
            if (onChange) onChange(value);
        }
        async function load(force) {
            const current = ++ticket;
            let selectedProvider = provider.value;
            let preferred = model.value;
            refresh.disabled = true; status.textContent = '모델 목록을 불러오는 중…';
            connection('연결 확인 중…', 'checking');
            try {
                if (host === root && host.openAiJenaChat) await host.openAiJenaChat(false);
                if (host === root && !host.AIChat) throw new Error('메인 창의 AI JENA 연결을 확인하세요.');
                let timer;
                let info;
                try {
                    info = await Promise.race([
                        host !== root ? parentModels(selectedProvider) : host.AIChat.getTaskModels(selectedProvider || undefined, true),
                        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('연결 확인 제한 시간(15초)을 초과했습니다.')), 15000); })
                    ]);
                } finally { clearTimeout(timer); }
                if (current !== ticket) return;
                if (Array.isArray(info.providers)) {
                    const value = provider.value;
                    provider.replaceChildren(new Option('AI JENA 설정 사용', ''));
                    info.providers.forEach(item => provider.add(new Option(item.label, item.value)));
                    provider.value = value;
                }
                resolvedProvider = info.provider;
                compatibleProvider = info.openAICompatibleProvider || '';
                list.replaceChildren();
                const models = Array.from(new Set([
                    selectedProvider === 'aistudio' ? DEFAULT_AI_STUDIO_MODEL : '',
                    info.model,
                    ...(info.models || []),
                    preferred
                ].filter(Boolean)));
                models.forEach(id => list.appendChild(new Option(id, id)));
                if (model.value === preferred) model.value = preferred || info.model || models[0] || '';
                status.textContent = '이미지 분석은 비전 모델을 선택하세요. API 키·주소는 AI JENA 설정을 사용합니다.';
                connection((info.providerLabel || (providers.find(item => item[0] === info.provider) || ['', info.provider])[1]) + ' · 연결됨', 'connected');
                container.title = status.textContent;
                save();
            } catch (error) { if (current === ticket) { status.textContent = error.message + ' · 모델 ID 직접 입력 가능'; container.title = status.textContent; connection('연결 실패 · ' + error.message, 'failed'); } }
            finally { if (current === ticket) refresh.disabled = false; }
        }
        provider.onchange = function () { hasSavedSelection = true; resolvedProvider = ''; compatibleProvider = ''; model.value = provider.value === 'aistudio' ? DEFAULT_AI_STUDIO_MODEL : ''; save(); load(true); };
        model.oninput = function () { connection('모델 변경 · 연결 확인 필요', 'unknown'); save(); };
        refresh.onclick = function () { load(true); };
        container.append(provider, model, list, refresh, status);
        container.style.cssText += ';display:flex;flex-wrap:wrap;gap:6px;align-items:center';
        if (!hasSavedSelection && host === root && host.addEventListener) {
            host.addEventListener('mdpro-ai-studio-credential-changed', function () {
                if (provider.value || !hasAIStudioCredential()) return;
                provider.value = 'aistudio';
                model.value = DEFAULT_AI_STUDIO_MODEL;
                save();
                load(true);
            });
        }
        load(false);
        return { selection: selection, setConnection: connection };
    };
})(window);

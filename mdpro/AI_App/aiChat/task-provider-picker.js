(function (root) {
    'use strict';
    // Shared runtime policy: server IDs are matched, never invented as installed models.
    root.AIJenaTaskPolicy = Object.freeze({
        aiStudioModel: 'gemini-3.5-flash-lite', localModel: 'gemma-4-e4b',
        defaultModel: function (provider, models, preferred) {
            const ids = (models || []).filter(Boolean);
            if (preferred) return preferred;
            if (provider === 'aistudio') return preferred || 'gemini-3.5-flash-lite';
            if (/^(lmstudio|ollama|litertlm|lemonade|lemonade-flm|ollama-npu)$/.test(provider)) {
                const match = ids.find(id => /gemma[-_: ]?4.*e4b/i.test(id));
                if (match) return match;
            }
            return preferred || ids[0] || '';
        },
        visionInstruction: 'Read only the supplied image. Preserve every visible label, Korean character, digit, decimal point, minus sign, subscript and reading order. Distinguish empty cells from zero; preserve table rows/columns, merged headers and diagram arrow directions. Inspect small details against nearby context but never invent unreadable content. Mark unclear text as [unclear] in text cells; for math or diagram syntax use the task-specific unreadable marker. Silently check omissions once, then return only the requested format. Do not solve, explain or make a second request.',
        textStream: function (render) {
            let text = '', timer = null, closed = false;
            function flush() { timer = null; if (!closed) render(text); }
            return {
                event: function (event) {
                    if (closed || !event || event.type !== 'message.delta' || !event.content) return;
                    const first = !text; text += String(event.content);
                    if (first) flush(); else if (!timer) timer = root.setTimeout(flush, 50);
                },
                close: function () { closed = true; if (timer) root.clearTimeout(timer); timer = null; }
            };
        }
    });
    const providers = [
        ['lmstudio', 'LM Studio'], ['litertlm', 'LiteRT-LM'], ['aistudio', 'AI Studio (Gemini)'],
        ['ollama', 'Ollama'], ['deepseek', 'DeepSeek (유료)'], ['openai-compatible-env', 'OpenAI Compatible'],
        ['lemonade-flm', 'Lemonade FLM NPU'], ['lemonade', 'Lemonade'], ['openai', 'OpenAI · ChatGPT 모델 (유료 API)']
    ];
    const DEFAULT_AI_STUDIO_MODEL = 'gemini-3.5-flash-lite';
    root.AITaskProviders = providers;
    root.formatAITaskConnectionError = function (error, selection) {
        const message = String(error && error.message || error);
        const lemonade = /^(lemonade|lemonade-flm)$/.test(selection && (selection.openAICompatibleProvider || selection.provider) || '');
        if (lemonade && root.location && root.location.protocol === 'file:' && /failed to fetch|network|Origin not allowed|CORS/i.test(message)) {
            return '파일(file://) 실행에서는 Lemonade가 연결을 차단할 수 있습니다. WebDAV 앱의 HTTP 주소에서 다시 열고 ENV의 Lemonade 주소와 프록시 연결을 확인하세요. (' + message + ')';
        }
        return message;
    };
    root.mountAITaskPicker = function (container, key, onChange, adapter) {
        adapter = adapter || {};
        let saved = {};
        try { saved = adapter.initialSelection || JSON.parse(localStorage.getItem(key) || (key === 'mdv_mermaid_ai_selection_v1' ? localStorage.getItem('mdv_ai_tool_mermaid') : '') || '{}') || {}; } catch (_) {}
        // A new WebDAV tool inherits the user's explicitly saved Jena provider.
        // Do not silently choose a cloud provider when the app already uses a local one.
        if (!Object.prototype.hasOwnProperty.call(saved, 'provider')) {
            try { if (localStorage.getItem('ss_ai_chat_provider')) saved = {provider:'',model:''}; } catch (_) {}
        }
        if (saved.provider === 'ollama-npu') saved.provider = 'lemonade-flm';
        if (saved.provider === 'openai-compatible') saved.provider = /^(lemonade|lemonade-flm)$/.test(saved.openAICompatibleProvider || '') ? saved.openAICompatibleProvider : 'openai-compatible-env';
        // The WebDAV app owns AIChat even when embedded in the React host.
        // Only child tools (ME/Tidy) without a local runtime use parent messages.
        const host = root.AIChat || typeof root.openAiJenaChat === 'function'
            ? root : root.parent !== root ? root.parent : root;
        function parentModels(selectedProvider, force) {
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
                host.postMessage({ type: 'mdv-task-models-request', requestId, provider: selectedProvider, model: model.value.trim(), refresh: !!force }, '*');
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
        list.id = key + '-models';
        const modelChoice = document.createElement('select');
        modelChoice.className = 'ai-task-model-list';
        modelChoice.setAttribute('aria-label', 'AI 모델 전체 목록');
        const manualId = '__manual_model_id__';
        let ticket = 0, resolvedProvider = '', compatibleProvider = saved.openAICompatibleProvider || '';
        function updateModelChoices(models) {
            modelChoice.replaceChildren(new Option('모델 선택', ''));
            models.forEach(id => modelChoice.add(new Option(id, id)));
            if (model.value && !models.includes(model.value)) modelChoice.add(new Option(model.value + ' · 저장된 ID', model.value));
            modelChoice.add(new Option('모델 ID 직접 입력…', manualId));
            modelChoice.value = model.value || '';
            model.hidden = true;
        }
        updateModelChoices(model.value ? [model.value] : []);
        const refresh = document.createElement('button');
        refresh.type = 'button'; refresh.textContent = '모델 새로고침';
        const loadModel = document.createElement('button');
        loadModel.type = 'button'; loadModel.textContent = '모델 로드'; loadModel.hidden = true;
        const checkVision = document.createElement('button');
        checkVision.type = 'button'; checkVision.textContent = '이미지 점검'; checkVision.hidden = true;
        checkVision.title = '실제 이미지의 숫자 인식으로 전송과 비전 응답을 확인합니다. 표·한글 인식 정확도는 별도입니다.';
        let loadingModel = false;
        function loadProvider() {
            const selected = provider.value || resolvedProvider;
            return selected === 'openai-compatible' ? compatibleProvider : selected;
        }
        function syncLoadButton() {
            loadModel.hidden = !/^(ollama|litertlm|lmstudio|lemonade|lemonade-flm)$/.test(loadProvider());
            loadModel.disabled = loadingModel || refresh.disabled || !(model.value.trim() || !provider.value);
            checkVision.hidden = !/^(ollama|litertlm)$/.test(loadProvider());
            checkVision.disabled = loadModel.disabled;
        }
        async function parentLoadModel(selectedProvider, selectedModel, checkVision) {
            const requestId = 'task-load-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { root.removeEventListener('message', receive); reject(new Error('모델 로드 확인 제한 시간을 초과했습니다.')); }, 330000);
                function receive(event) {
                    const data = event.data || {};
                    if (event.source !== host || data.type !== 'mdv-task-model-load-result' || data.requestId !== requestId) return;
                    clearTimeout(timer); root.removeEventListener('message', receive);
                    if (data.ok) resolve(data.info); else reject(new Error(data.error || '모델 로드 실패'));
                }
                root.addEventListener('message', receive);
                host.postMessage({ type: 'mdv-task-model-load-request', requestId, provider: selectedProvider, model: selectedModel, checkVision: !!checkVision }, '*');
            });
        }
        async function runModelAction(visionCheck) {
            if (loadingModel || loadModel.disabled) return;
            const selectedProvider = loadProvider();
            const selectedModel = model.value.trim();
            const label = (providers.find(item => item[0] === selectedProvider) || ['', selectedProvider])[1];
            loadingModel = true;
            provider.disabled = model.disabled = modelChoice.disabled = refresh.disabled = loadModel.disabled = checkVision.disabled = true;
            loadModel.textContent = '처리 중…'; status.hidden = false; status.textContent = label + (visionCheck ? ' 실제 이미지 인식 점검 중…' : ' 모델 로딩 중…');
            connection(label + ' · 모델 로딩 중…', 'checking');
            try {
                const info = adapter.loadModel ? await adapter.loadModel(selectedProvider, selectedModel, visionCheck) : host !== root ? await parentLoadModel(selectedProvider, selectedModel, visionCheck) : visionCheck ? await host.AIChat.checkTaskVision(selectedProvider, selectedModel) : await host.AIChat.loadTaskModel(selectedProvider, selectedModel);
                status.textContent = (info.visionVerified ? '이미지 점검 통과 · 숫자 실제 인식: ' : info.responseReady ? '모델 응답 확인 완료: ' : '모델 로드 완료: ') + info.model + (selectedProvider === 'ollama' && !visionCheck ? ' · 10분 유지' : '');
                connection(label + (info.visionVerified ? ' · 이미지 점검 통과 · ' : info.responseReady ? ' · 응답 준비 확인 · ' : ' · 로드 완료 · ') + info.model, 'connected');
            } catch (error) { status.textContent = (visionCheck ? '이미지 점검 실패: ' : '모델 로드 실패: ') + error.message; connection(status.textContent, 'failed'); }
            finally {
                loadingModel = false; provider.disabled = model.disabled = modelChoice.disabled = refresh.disabled = false;
                loadModel.textContent = '모델 로드'; syncLoadButton();
            }
        };
        loadModel.onclick = function () { return runModelAction(false); };
        checkVision.onclick = function () { return runModelAction(true); };
        const access = document.createElement('span');
        access.className = 'ai-task-litertlm-access'; access.hidden = true;
        const password = document.createElement('input');
        password.type = 'password'; password.autocomplete = 'off';
        password.placeholder = 'LiteRT-LM 비밀번호'; password.setAttribute('aria-label', 'LiteRT-LM 비밀번호');
        const unlock = document.createElement('button'); unlock.type = 'button'; unlock.textContent = '확인';
        access.append(password, unlock);
        const status = document.createElement('small'); status.setAttribute('role', 'status');
        status.className = 'ai-task-status';
        // This picker is shared by ME, Math and Table; contain diagnostics locally,
        // even when the host's controls inherit white-space: nowrap.
        status.style.cssText = 'flex:1 1 100%;min-width:0;max-width:100%;max-height:7.5em;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;box-sizing:border-box';
        status.tabIndex = 0;
        status.setAttribute('aria-label', 'AI 모델 처리 메시지');
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
        function syncAccess() {
            syncLoadButton();
            access.hidden = provider.value !== 'litertlm' && !(provider.value === '' && resolvedProvider === 'litertlm');
            // WebDAV owns authentication in ENV/requestLiteRTLM. Only adapters
            // with an explicit unlock API expose a second password control.
            if (!adapter.unlock) access.hidden = true;
            try { password.placeholder = host === root && host.AIChatBridge && host.AIChatBridge.isLiteRTLMUnlocked() ? '인증됨' : 'LiteRT-LM 비밀번호'; } catch (_) {}
        }
        async function unlockFromParent(value) {
            const requestId = 'task-litertlm-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => { root.removeEventListener('message', receive); reject(new Error('비밀번호 확인 시간이 초과됐습니다.')); }, 15000);
                function receive(event) {
                    const data = event.data || {};
                    if (event.source !== host || data.type !== 'mdv-task-litertlm-unlock-result' || data.requestId !== requestId) return;
                    clearTimeout(timer); root.removeEventListener('message', receive);
                    if (data.ok) resolve(true); else reject(new Error(data.error || '비밀번호가 올바르지 않습니다.'));
                }
                root.addEventListener('message', receive);
                host.postMessage({ type:'mdv-task-litertlm-unlock-request', requestId, password:value }, '*');
            });
        }
        unlock.onclick = async function () {
            const value = password.value; password.value = '';
            if (!value) { status.hidden = false; status.textContent = '비밀번호를 입력하세요.'; password.focus(); return; }
            unlock.disabled = true;
            try {
                const ok = adapter.unlock ? await adapter.unlock(value) : host !== root ? await unlockFromParent(value) : await host.AIChatBridge.unlockLiteRTLM(value);
                if (!ok) throw new Error('비밀번호가 올바르지 않습니다.');
                password.setAttribute('aria-invalid', 'false'); password.placeholder = '인증됨';
                await load(true);
            } catch (error) {
                password.setAttribute('aria-invalid', 'true'); status.hidden = false;
                status.textContent = error.message || '비밀번호 확인 실패';
            } finally { unlock.disabled = false; }
        };
        password.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); unlock.click(); } };
        function selection() {
            const localCompatible = /^(lemonade|lemonade-flm)$/.test(provider.value);
            return { provider: localCompatible || provider.value === 'openai-compatible-env' ? 'openai-compatible' : provider.value, model: provider.value ? model.value.trim() : '', openAICompatibleProvider: localCompatible ? provider.value : compatibleProvider };
        }
        function save() {
            const value = selection();
            try { localStorage.setItem(key, JSON.stringify({ provider: provider.value, model: value.model, openAICompatibleProvider: compatibleProvider })); } catch (_) {}
            syncLoadButton();
            if (onChange) onChange(value);
        }
        function showRuntime(info) {
            const runtime = info.runtime;
            if (!runtime) return;
            status.hidden = false;
            if (runtime.error) { status.textContent = '모델 목록 연결됨 · 적재 상태 확인 실패: ' + runtime.error; return; }
            const loaded = runtime.loadedModels || [];
            const matches = id => id.replace(/:latest$/i, '') === model.value.replace(/:latest$/i, '');
            const selectedLoaded = loaded.some(matches);
            status.textContent = (runtime.residencyKnown ? (loaded.length ? '적재됨: ' + loaded.join(' · ') : '현재 적재된 모델 없음') : '서버 연결됨 · 적재 상태 미제공 · 모델 로드로 응답 확인')
                + (runtime.vision === true ? ' · 선택 모델: 이미지 지원' : runtime.vision === false ? ' · 선택 모델: 이미지 미지원' : ' · 이미지 지원 미확인');
            if (runtime.capabilityError) status.textContent += ' · 지원 확인 실패: ' + runtime.capabilityError;
            connection((info.providerLabel || info.provider) + (selectedLoaded ? ' · 선택 모델 적재됨' : runtime.residencyKnown ? ' · 선택 모델 미적재' : ' · 적재 확인 필요'), 'connected');
        }
        async function load(force) {
            const current = ++ticket;
            let verified = !!force;
            let selectedProvider = provider.value;
            let preferred = model.value;
            syncAccess(); refresh.disabled = true; modelChoice.disabled = true; syncLoadButton(); status.hidden = false; status.textContent = '모델 목록을 불러오는 중…';
            connection('연결 확인 중…', 'checking');
            try {
                if (!adapter.getModels && host === root && host.openAiJenaChat) await host.openAiJenaChat(false);
                if (!adapter.getModels && host === root && !host.AIChat) throw new Error('메인 창의 AI JENA 연결을 확인하세요.');
                let timer;
                let info;
                try {
                    const query = refresh => adapter.getModels ? adapter.getModels(selectedProvider || undefined, refresh, preferred) : host !== root ? parentModels(selectedProvider, refresh) : host.AIChat.getTaskModels(selectedProvider || undefined, refresh, preferred);
                    const lookup = async () => {
                        const cached = await query(!!force);
                        if (!force && !(cached.models || []).length) { verified = true; return query(true); }
                        return cached;
                    };
                    info = await Promise.race([
                        lookup(),
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
                resolvedProvider = info.provider; syncAccess();
                compatibleProvider = info.openAICompatibleProvider || '';
                // Old Ollama-style IDs cannot be sent to Lemonade. Migrate only
                // this known alias when the server advertises the exact target.
                if (compatibleProvider === 'lemonade' && /^gemma4:e4b$/i.test(preferred.trim())
                    && (info.models || []).includes('Gemma-4-E4B-it-GGUF')) {
                    if (model.value === preferred) model.value = 'Gemma-4-E4B-it-GGUF';
                    preferred = 'Gemma-4-E4B-it-GGUF';
                }
                if (info.provider === 'aistudio' && /(?:^|-)image(?:-|$)/i.test(preferred)) {
                    if (model.value === preferred) model.value = '';
                    preferred = '';
                }
                list.replaceChildren();
                const localModels = /^(ollama|litertlm)$/.test(info.provider);
                const models = localModels ? Array.from(new Set(info.models || [])) : Array.from(new Set([
                    selectedProvider === 'aistudio' ? DEFAULT_AI_STUDIO_MODEL : '',
                    info.provider === 'aistudio' && /(?:^|-)image(?:-|$)/i.test(info.model) ? '' : info.model,
                    ...(info.models || []),
                    preferred
                ].filter(Boolean)));
                models.forEach(id => list.appendChild(new Option(id, id)));
                if (model.value === preferred) {
                    model.value = preferred || (models.includes(info.model) ? info.model : models[0]) || '';
                    const defaultProvider = info.provider === 'openai-compatible' ? info.openAICompatibleProvider : info.provider;
                    if (!preferred) model.value = root.AIJenaTaskPolicy.defaultModel(defaultProvider, models, '');
                }
                updateModelChoices(models);
                status.textContent = ''; status.hidden = true;
                connection((info.providerLabel || (providers.find(item => item[0] === info.provider) || ['', info.provider])[1]) + (verified ? ' · 연결됨 · ' : ' · 저장된 목록 · 새로고침으로 연결 확인 · ') + (info.models || []).length + '개', verified ? 'connected' : 'unknown');
                showRuntime(info);
                container.title = status.textContent;
                save();
            } catch (error) { if (current === ticket) { const message = root.formatAITaskConnectionError(error, selection()); status.hidden = false; status.textContent = message + (/^(ollama|litertlm)$/.test(loadProvider()) ? '' : ' · 모델 ID 직접 입력 가능'); container.title = status.textContent; const locked = /비밀번호|인증.*필요/.test(message) && loadProvider() === 'litertlm'; connection((locked ? '인증 대기 · ' : '연결 실패 · ') + message, locked ? 'unknown' : 'failed'); } }
            finally { if (current === ticket) { refresh.disabled = false; modelChoice.disabled = false; syncLoadButton(); } }
        }
        provider.onchange = function () { hasSavedSelection = true; resolvedProvider = ''; compatibleProvider = ''; password.value = ''; syncAccess(); model.value = provider.value === 'aistudio' ? DEFAULT_AI_STUDIO_MODEL : ''; updateModelChoices(model.value ? [model.value] : []); save(); load(true); };
        modelChoice.onchange = function () {
            model.hidden = modelChoice.value !== manualId;
            if (!model.hidden) { model.focus(); model.select(); return; }
            model.value = modelChoice.value;
            connection('모델 변경 · 연결 확인 필요', 'unknown'); save();
            if (/^(ollama|litertlm)$/.test(loadProvider())) load(true);
        };
        model.oninput = function () { connection('모델 변경 · 연결 확인 필요', 'unknown'); save(); };
        refresh.onclick = function () { load(true); };
        container.append(provider, modelChoice, model, list, refresh, loadModel, checkVision, access, status);
        container.style.cssText += ';display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0;max-width:100%;box-sizing:border-box';
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
        return { selection: selection, setConnection: connection, refresh: () => load(true),
            setSelection: function (value) {
                ++ticket;
                let id = value.provider || '';
                if (id === 'ollama-npu') id = 'lemonade-flm';
                if (id === 'openai-compatible') id = /^(lemonade|lemonade-flm)$/.test(value.openAICompatibleProvider || '') ? value.openAICompatibleProvider : 'openai-compatible-env';
                provider.value = id; resolvedProvider = ''; compatibleProvider = value.openAICompatibleProvider || '';
                model.value = value.model || ''; updateModelChoices(model.value ? [model.value] : []);
                save(); return load(true);
            }
        };
    };
})(window);

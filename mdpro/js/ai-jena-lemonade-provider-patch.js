(function (root) {
    'use strict';
    var DEFAULT_MODEL = 'Gemma-4-E4B-it-GGUF';
    var DEFAULT_NPU_MODEL = 'gemma4-it-e2b-FLM';

    function save(key, value) { try { root.localStorage.setItem(key, String(value)); } catch (_) {} }
    function add(select, value, label, beforeValue) {
        if (select.querySelector('option[value="' + value + '"]')) return;
        var option = new Option(label, value);
        select.insertBefore(option, select.querySelector('option[value="' + beforeValue + '"]'));
    }
    function configure(model, npu) {
        save('ss_openai_compatible_provider', 'lemonade');
        save('ss_openai_compatible_base_url', 'http://localhost:13305/api/v1');
        save('ss_openai_compatible_api_key', 'lemonade');
        save('ss_openai_compatible_model_id', model);
        save('ss_ai_chat_openai_compatible_model', model);
        if (npu) save('ss_ai_chat_npu_model', model);
    }
    async function activateLegacyNPU(select) {
        var status = document.getElementById('ai-chat-status');
        if (status) status.textContent = 'Lemonade NPU와 FastFlowLM 모델을 확인하는 중...';
        try {
            var response = await root.fetch('/api/lemonade/v1/models?show_all=true', { headers: { Accept: 'application/json', Authorization: 'Bearer lemonade' } });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var data = await response.json();
            var rows = (Array.isArray(data && data.data) ? data.data : []).filter(function (model) {
                return model && model.downloaded !== false && model.recipe === 'flm'
                    && (!Array.isArray(model.labels) || model.labels.includes('chat'));
            });
            var models = rows.map(function (model) { return String(model.id || ''); }).filter(Boolean);
            if (!models.length) throw new Error('사용 가능한 FastFlowLM NPU 채팅 모델이 없습니다.');
            var saved = root.localStorage.getItem('ss_ai_chat_npu_model');
            var model = models.includes(saved) ? saved : (models.includes(DEFAULT_NPU_MODEL) ? DEFAULT_NPU_MODEL : models[0]);
            configure(model, true);
            select.value = 'openai-compatible';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            root.setTimeout(function () {
                select.value = 'ollama-npu';
                var modelSelect = document.getElementById('ai-chat-model');
                if (modelSelect) {
                    modelSelect.innerHTML = '';
                    models.forEach(function (id) { modelSelect.add(new Option(id, id)); });
                    modelSelect.value = model;
                }
                if (status) textStatus(status, 'Lemonade NPU 연결 완료: ' + model, true);
            }, 0);
        } catch (error) {
            select.value = 'lmstudio';
            if (status) textStatus(status, 'Lemonade NPU를 사용할 수 없습니다. NPU 장치, FastFlowLM 백엔드 및 설치 모델을 확인하세요. (' + (error && error.message ? error.message : error) + ')', false);
        }
    }
    function textStatus(status, message, ok) {
        status.textContent = message;
        status.classList.toggle('error', !ok);
        status.classList.toggle('ok', ok);
    }
    function apply() {
        var select = document.getElementById('ai-chat-provider');
        if (!select || select.dataset.lemonadeProvidersPatched === '1') return;
        var modern = !!select.querySelector('option[value="lemonade"], option[value="ollama-npu"]');
        add(select, 'lemonade', 'Lemonade', 'deepseek');
        add(select, 'ollama-npu', 'Lemonade NPU', 'deepseek');
        select.dataset.lemonadeProvidersPatched = '1';
        if (modern) return;
        select.addEventListener('change', function (event) {
            var selected = event.target.value;
            if (selected !== 'lemonade' && selected !== 'ollama-npu') return;
            var npu = selected === 'ollama-npu';
            if (npu) {
                event.stopImmediatePropagation();
                activateLegacyNPU(event.target);
                return;
            }
            var model = npu ? (root.localStorage.getItem('ss_ai_chat_npu_model') || DEFAULT_NPU_MODEL)
                : (root.localStorage.getItem('ss_openai_compatible_model_id_lemonade') || DEFAULT_MODEL);
            configure(model, npu);
            event.target.value = 'openai-compatible';
            root.setTimeout(function () {
                var provider = document.getElementById('ai-chat-provider');
                var models = document.getElementById('ai-chat-model');
                if (provider) provider.value = selected;
                if (models && !Array.from(models.options).some(function (option) { return option.value === model; })) models.add(new Option(model, model));
                if (models) models.value = model;
            }, 0);
        }, true);
    }
    apply();
    new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
}(window));

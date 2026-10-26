/* FMA uses AI Jena's model-specific image settings, including standalone FMA. */
(() => {
    function host() { return getMdproSettingsHost(); }
    window.getFmaLemonadeImageSettings = (model, overrides) => {
        const bridge = host().AIChatBridge;
        if (bridge?.getLemonadeImageSettings) return bridge.getLemonadeImageSettings(model, overrides);
        const storage = host().localStorage;
        const key = "ss_ai_chat_lemonade_image_v1:" + model;
        let saved = {};
        try { saved = JSON.parse(storage.getItem(key) || "{}") || {}; } catch (_) {}
        const ownerKey = "ss_lemonade_image_legacy_model_v1";
        let owner = storage.getItem(ownerKey);
        if (owner == null) {
            owner = storage.getItem("ss_openai_compatible_model_id_lemonade") || "Gemma-4-E4B-it-GGUF";
            storage.setItem(ownerKey, owner);
        }
        const legacy = {};
        if (model === owner && !storage.getItem(key)) {
            const size = (storage.getItem("ss_lemonade_image_size") || "").match(/^(\d+)x(\d+)$/);
            if (size) { legacy.width = Number(size[1]); legacy.height = Number(size[2]); }
            if (storage.getItem("ss_lemonade_image_steps") != null) legacy.steps = storage.getItem("ss_lemonade_image_steps");
            if (storage.getItem("ss_lemonade_image_cfg_scale") != null) legacy.cfgScale = storage.getItem("ss_lemonade_image_cfg_scale");
        }
        const input = { ...legacy, ...saved, ...overrides };
        const number = (key, fallback, min, max, step) => {
            const value = input[key] === "" || input[key] == null ? fallback : Number(input[key]);
            return Math.max(min, Math.min(max, Math.round((Number.isFinite(value) ? value : fallback) / step) * step));
        };
        const flux = /flux/i.test(model);
        const settings = {
            width: number("width", flux ? 1024 : 512, 256, 1536, 64),
            height: number("height", flux ? 1024 : 512, 256, 1536, 64),
            steps: number("steps", flux && /base/i.test(model) ? 20 : 4, 1, 50, 1),
            cfgScale: Number(number("cfgScale", flux && /base/i.test(model) ? 4 : 1, 0, 15, 0.1).toFixed(1)),
            seed: number("seed", -1, -1, 2147483647, 1)
        };
        if (Object.keys(legacy).length) storage.setItem(key, JSON.stringify(settings));
        return settings;
    };
    window.saveFmaLemonadeImageSettings = (model, values) => {
        const bridge = host().AIChatBridge;
        if (bridge?.saveLemonadeImageSettings) return bridge.saveLemonadeImageSettings(model, values);
        const settings = window.getFmaLemonadeImageSettings(model, values);
        host().localStorage.setItem("ss_ai_chat_lemonade_image_v1:" + model, JSON.stringify(settings));
        return settings;
    };
    const presets = ["256x256", "512x512", "768x768", "1024x1024", "768x1024", "1024x768", "576x1024", "1024x576", "1024x1536", "1536x1024"];
    function modelFor(panel) {
        return panel.dataset.fmaLemonadeQuality === "editor"
            ? getAiJenaImageConnection().model
            : document.getElementById("fmaLemonadeImageModel").value;
    }
    window.syncFmaLemonadeQualityControls = () => {
        document.querySelectorAll("[data-fma-lemonade-quality]").forEach(panel => {
            const editor = panel.dataset.fmaLemonadeQuality === "editor";
            panel.hidden = editor && getAiJenaImageConnection().provider !== "lemonade";
            if (panel.hidden) return;
            const model = modelFor(panel);
            const values = window.getFmaLemonadeImageSettings(model);
            panel.dataset.model = model;
            panel.querySelectorAll("[data-quality-field]").forEach(control => {
                control.value = values[control.dataset.qualityField];
                control.disabled = typeof aiJenaState !== "undefined" && aiJenaState.processing;
            });
            const size = `${values.width}x${values.height}`;
            panel.querySelector("[data-quality-preset]").value = presets.includes(size) ? size : "custom";
            panel.querySelector("[data-quality-preset]").disabled = typeof aiJenaState !== "undefined" && aiJenaState.processing;
            panel.querySelector("[data-quality-swap]").disabled = typeof aiJenaState !== "undefined" && aiJenaState.processing;
        });
    };
    document.querySelectorAll("[data-fma-lemonade-quality]").forEach(panel => {
        panel.innerHTML = `<b>Lemonade 출력 해상도 · 품질</b>
            <label>크기 선택 <select data-quality-preset>${presets.map(size => `<option value="${size}">${size.replace("x", " × ")}</option>`).join("")}<option value="custom">직접 입력</option></select></label>
            <div class="fma-lemonade-quality-fields">
            <label>가로 px <input data-quality-field="width" type="number" min="256" max="1536" step="64"></label>
            <label>세로 px <input data-quality-field="height" type="number" min="256" max="1536" step="64"></label>
            <button data-quality-swap type="button">가로·세로 교환</button>
            <label>Steps <input data-quality-field="steps" type="number" min="1" max="50" step="1"></label>
            <label>CFG <input data-quality-field="cfgScale" type="number" min="0" max="15" step="0.1"></label>
            <label>Seed <input data-quality-field="seed" type="number" min="-1" max="2147483647" step="1"></label></div>
            <small>모델별 자동 저장 · AI Jena와 공유 · 64px 단위 · Seed -1은 무작위. 큰 크기는 메모리와 시간이 더 필요합니다.</small>`;
        panel.addEventListener("change", event => {
            if (typeof aiJenaState !== "undefined" && aiJenaState.processing) return window.syncFmaLemonadeQualityControls();
            const control = event.target;
            let values = {};
            if (control.hasAttribute("data-quality-preset")) {
                if (control.value === "custom") { panel.querySelector('[data-quality-field="width"]').focus(); return; }
                const [width, height] = control.value.split("x").map(Number);
                values = { width, height };
            } else if (control.dataset.qualityField) values[control.dataset.qualityField] = control.value;
            else return;
            window.saveFmaLemonadeImageSettings(panel.dataset.model, values);
            window.syncFmaLemonadeQualityControls();
        });
        panel.querySelector("[data-quality-swap]").addEventListener("click", () => {
            if (typeof aiJenaState !== "undefined" && aiJenaState.processing) return;
            const settings = window.getFmaLemonadeImageSettings(panel.dataset.model);
            window.saveFmaLemonadeImageSettings(panel.dataset.model, { width: settings.height, height: settings.width });
            window.syncFmaLemonadeQualityControls();
        });
    });
    host().addEventListener("ai-tool-settings-changed", () => window.syncFmaLemonadeQualityControls());
})();

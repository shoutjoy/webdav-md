/* Local image-model selection, shared with MDPro image generation. */
(() => {
    const fallback = "Flux-2-Klein-4B";
    const toggle = document.getElementById("btnLemonadeImgSettings");
    const panel = document.getElementById("fmaLemonadeSettings");
    const select = document.getElementById("fmaLemonadeImageModel");
    const refresh = document.getElementById("btnRefreshLemonadeImages");
    const apply = document.getElementById("btnApplyLemonadeImage");
    const status = document.getElementById("fmaLemonadeStatus");
    let busy = false;
    function host() { return typeof getMdproSettingsHost === "function" ? getMdproSettingsHost() : window; }
    window.getFmaLemonadeBaseUrl = () => {
        const storage = host().localStorage;
        const direct = location.hostname === "shoutjoy.github.io" || location.protocol === "file:";
        return (direct ? (storage.getItem("ss_openai_compatible_base_url_lemonade") || "http://localhost:13305/api/v1") : "/api/lemonade/v1").replace(/\/+$/, "");
    };
    function selected() { return host().localStorage.getItem("ss_image_model_lemonade") || fallback; }
    window.getFmaLemonadeImageModel = () => host().localStorage.getItem("ss_image_provider") === "lemonade" ? selected() : "";
    window.waitForFmaLemonadeIdle = async (base, signal, onPhase) => {
        const started = Date.now();
        while (true) {
            if (signal?.aborted) throw new DOMException("작업이 정지되었습니다.", "AbortError");
            const timeout = AbortSignal.timeout(15000);
            const response = await fetch(base + "/health", {
                headers: { Accept: "application/json", Authorization: "Bearer lemonade" },
                signal: signal ? AbortSignal.any([signal, timeout]) : timeout
            });
            if (!response.ok) throw new Error(`Lemonade 상태 확인 실패 (HTTP ${response.status})`);
            const health = await response.json();
            if (!Array.isArray(health.all_models_loaded)) throw new Error("Lemonade 이미지 서버 상태를 확인할 수 없습니다.");
            const busy = health.all_models_loaded.some(row => (row.type === "image" || row.recipe === "sd-cpp")
                && (row.is_busy || row.is_streaming || row.status === "in_use"));
            if (!busy) return;
            if (Date.now() - started >= 600000) throw new Error("이전 Lemonade 이미지 작업이 아직 실행 중입니다. 서버 작업 종료 후 다시 실행하세요.");
            onPhase?.("이전 Lemonade 이미지 작업 종료 대기 중입니다. 중지된 브라우저 요청도 서버에서 계산 중일 수 있습니다.");
            await new Promise((resolve, reject) => {
                function cancel() { clearTimeout(timer); reject(new DOMException("작업이 정지되었습니다.", "AbortError")); }
                const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, 2000);
                signal?.addEventListener("abort", cancel, { once: true });
                if (signal?.aborted) { signal.removeEventListener("abort", cancel); cancel(); }
            });
        }
    };
    window.requestFmaLemonadeImage = async (input, signal, options = {}) => {
        const model = options.model || window.getFmaLemonadeImageModel();
        const base = window.getFmaLemonadeBaseUrl();
        const prompt = input.filter(item => item.type === "text").map(item => item.text).join("\n\n");
        if (!model || !prompt.trim()) throw new Error("Lemonade 이미지 모델과 생성 프롬프트를 확인하세요.");
        const pictures = options.mode === "generate" ? [] : input.filter(item => item.type === "image");
        const quality = options.imageSettings || window.getFmaLemonadeImageSettings(model);
        const settings = {
            model, prompt, size: `${quality.width}x${quality.height}`,
            n: 1, response_format: "b64_json",
            steps: quality.steps, cfg_scale: quality.cfgScale, seed: quality.seed
        };
        async function send(edit) {
            if (signal?.aborted) throw new DOMException("작업이 정지되었습니다.", "AbortError");
            const headers = { Accept: "application/json", Authorization: "Bearer lemonade" };
            let body;
            if (edit) {
                body = new FormData();
                Object.entries(settings).forEach(([key, value]) => body.append(key, String(value)));
                pictures.forEach((picture, index) => {
                    if (!picture.data) throw new Error("Lemonade 참조 이미지 데이터가 없습니다.");
                    const bytes = Uint8Array.from(atob(picture.data), char => char.charCodeAt(0));
                    body.append(pictures.length > 1 ? "image[]" : "image",
                        new Blob([bytes], { type: picture.mime_type || "image/png" }), `reference-${index}.png`);
                });
            } else {
                headers["Content-Type"] = "application/json";
                body = JSON.stringify(settings);
            }
            await window.waitForFmaLemonadeIdle(base, signal, options.onPhase);
            options.onPhase?.(`Lemonade · ${model} · ${settings.size} · ${settings.steps} steps · ${edit ? "원본 참조 편집" : "새 이미지 생성"} 응답 대기 중입니다.`);
            const response = await fetch(base.replace(/\/+$/, "") + (edit ? "/images/edits" : "/images/generations"), { method: "POST", headers, body, signal });
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch (_) { data = {}; }
            if (!response.ok || data.error) {
                const message = data.error?.message || (typeof data.error === "string" ? data.error : "") || text.slice(0, 300) || "이미지 요청 실패";
                const error = new Error(`Lemonade · ${model} · HTTP ${response.status}: ${message}`);
                error.canGenerate = [404, 405, 415, 422].includes(response.status)
                    || (response.status >= 500 && /sd-server|generate_image returned no results|unsupported|not supported|not implemented/i.test(error.message));
                throw error;
            }
            const image = data.data?.[0];
            const encoded = image?.b64_json || image?.b64Json;
            if (!encoded) throw new Error("Lemonade 응답에 이미지가 없습니다.");
            const mimeType = image.mime_type || image.mimeType || "image/png";
            return { src: `data:${mimeType};base64,${String(encoded).replace(/^data:[^;,]+;base64,/i, "")}`, mimeType, provider: "lemonade", model };
        }
        try {
            return await send(pictures.length > 0);
        } catch (error) {
            if (error.name === "AbortError" || signal?.aborted || !pictures.length || !error.canGenerate
                || !["edit", "pose"].includes(options.mode)) throw error;
            throw new Error(`이미지 편집 실패: ${error.message}. 원본·참조 이미지 보존을 위해 새 이미지 생성으로 자동 전환하지 않았습니다. 연결·모델 상태를 확인하고 다시 편집하세요. 새로 생성하려면 ‘새 이미지 생성’을 선택하세요.`);
        }
    };
    function render(ids, value) {
        select.replaceChildren();
        [...new Set([fallback, ...ids, value].filter(Boolean))].forEach(id => {
            const option = document.createElement("option");
            option.value = option.textContent = id;
            select.append(option);
        });
        select.value = value;
        window.syncFmaLemonadeQualityControls();
    }
    async function request(path, body) {
        const storage = host().localStorage;
        const base = window.getFmaLemonadeBaseUrl();
        const response = await fetch(base.replace(/\/+$/, "") + "/" + path, {
            method: body ? "POST" : "GET",
            headers: { Accept: "application/json", Authorization: "Bearer lemonade", ...(body ? { "Content-Type": "application/json" } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(body ? 600000 : 15000)
        });
        if (!response.ok) throw new Error((await response.text()).slice(0, 300) || `HTTP ${response.status}`);
        return response.json();
    }
    async function models() {
        if (busy) return;
        busy = true; refresh.disabled = apply.disabled = true;
        const value = select.value || selected();
        status.textContent = "Lemonade 이미지 모델 목록 확인 중…";
        try {
            const data = await request("models?show_all=true");
            const rows = Array.isArray(data) ? data : data.data || data.models || [];
            const ids = rows.filter(row => /image|diffusion|flux|sdxl|stable.diffusion|sd-cpp|thenoise/i.test([row.id, row.kind, row.type, row.recipe, ...(Array.isArray(row.labels) ? row.labels : [])].join(" "))).map(row => row.id || row.model_name).filter(Boolean);
            render(ids, value);
            status.textContent = `이미지 모델 ${ids.length}개 확인 · 선택 후 적용 · Load를 누르세요.`;
        } catch (error) { status.textContent = `모델 목록 확인 실패: ${error.message}`; }
        finally { busy = false; refresh.disabled = apply.disabled = false; }
    }
    toggle.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) { render([], selected()); models(); }
    });
    refresh.addEventListener("click", models);
    select.addEventListener("change", () => window.syncFmaLemonadeQualityControls());
    apply.addEventListener("click", async () => {
        if (busy) return;
        busy = true; refresh.disabled = apply.disabled = select.disabled = true;
        const model = select.value || fallback;
        status.textContent = `${model} 불러오는 중… 처음에는 시간이 걸릴 수 있습니다.`;
        try {
            const quality = window.getFmaLemonadeImageSettings(model);
            await request("load", { model_name: model, width: quality.width, height: quality.height, steps: quality.steps, cfg_scale: quality.cfgScale, seed: quality.seed, save_options: true });
            const storage = host().localStorage;
            storage.setItem("ss_image_model_lemonade", model);
            storage.setItem("ss_image_provider", "lemonade");
            host().dispatchEvent(new Event("ai-tool-settings-changed"));
            if (typeof updateAiJenaKeyStatus === "function") updateAiJenaKeyStatus();
            if (images.length && typeof renderDynamicMeta === "function") renderDynamicMeta(currentIndex);
            status.textContent = `${model} Load 완료 · Lemonade 이미지 모델로 적용했습니다.`;
        } catch (error) { status.textContent = `적용 · Load 실패: ${error.message}`; }
        finally { busy = false; refresh.disabled = apply.disabled = select.disabled = false; }
    });
})();

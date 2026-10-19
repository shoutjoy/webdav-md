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
    function selected() { return host().localStorage.getItem("ss_image_model_lemonade") || fallback; }
    window.getFmaLemonadeImageModel = () => host().localStorage.getItem("ss_image_provider") === "lemonade" ? selected() : "";
    window.requestFmaLemonadeImage = async (input, signal) => {
        const storage = host().localStorage;
        const model = window.getFmaLemonadeImageModel();
        const direct = location.hostname === "shoutjoy.github.io" || location.protocol === "file:";
        const base = direct ? (storage.getItem("ss_openai_compatible_base_url_lemonade") || "http://localhost:13305/api/v1") : "/api/lemonade/v1";
        const prompt = input.filter(item => item.type === "text").map(item => item.text).join("\n\n");
        const pictures = input.filter(item => item.type === "image");
        let body;
        const headers = { Accept: "application/json", Authorization: "Bearer lemonade" };
        const size = storage.getItem("ss_lemonade_image_size") || "512x512";
        if (pictures.length) {
            body = new FormData();
            body.append("model", model); body.append("prompt", prompt);
            body.append("size", size); body.append("response_format", "b64_json");
            body.append("n", "1"); body.append("steps", storage.getItem("ss_lemonade_image_steps") || "4");
            body.append("cfg_scale", storage.getItem("ss_lemonade_image_cfg_scale") || "1");
            pictures.forEach((picture, index) => {
                const bytes = Uint8Array.from(atob(picture.data), char => char.charCodeAt(0));
                body.append(index === 0 ? "image" : "image[]", new Blob([bytes], { type: picture.mime_type }), `reference-${index}.png`);
            });
        } else {
            headers["Content-Type"] = "application/json";
            body = JSON.stringify({ model, prompt, size, n: 1, response_format: "b64_json", steps: Number(storage.getItem("ss_lemonade_image_steps")) || 4, cfg_scale: Number(storage.getItem("ss_lemonade_image_cfg_scale") || 1) });
        }
        const response = await fetch(base.replace(/\/+$/, "") + (pictures.length ? "/images/edits" : "/images/generations"), { method: "POST", headers, body, signal });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error?.message || `Lemonade 이미지 요청 실패 (${response.status})`);
        const image = data.data?.[0];
        if (!image?.b64_json) throw new Error("Lemonade 응답에 이미지가 없습니다.");
        const mimeType = image.mime_type || "image/png";
        return { src: `data:${mimeType};base64,${image.b64_json}`, mimeType };
    };
    function render(ids, value) {
        select.replaceChildren();
        [...new Set([fallback, ...ids, value].filter(Boolean))].forEach(id => {
            const option = document.createElement("option");
            option.value = option.textContent = id;
            select.append(option);
        });
        select.value = value;
    }
    async function request(path, body) {
        const storage = host().localStorage;
        const direct = location.hostname === "shoutjoy.github.io" || location.protocol === "file:";
        const base = direct ? (storage.getItem("ss_openai_compatible_base_url_lemonade") || "http://localhost:13305/api/v1") : "/api/lemonade/v1";
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
    apply.addEventListener("click", async () => {
        if (busy) return;
        busy = true; refresh.disabled = apply.disabled = select.disabled = true;
        const model = select.value || fallback;
        status.textContent = `${model} 불러오는 중… 처음에는 시간이 걸릴 수 있습니다.`;
        try {
            await request("load", { model_name: model, width: 512, height: 512, steps: 4, cfg_scale: 1, save_options: true });
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

/* FMA Jena image provider selection and Gemini image transport. */
function getAiJenaImageConnection() {
    const host = getMdproSettingsHost();
    const storage = host.localStorage;
    const sessionProvider = typeof aiJenaState !== "undefined" ? aiJenaState.imageProvider : "";
    const preferred = sessionProvider || storage.getItem("ss_fma_jena_provider") || storage.getItem("ss_image_provider");
    const provider = preferred === "lemonade" ? "lemonade" : "aistudio";
    const model = storage.getItem("ss_fma_jena_model_" + provider)
        || storage.getItem(provider === "lemonade" ? "ss_image_model_lemonade" : "ss_image_model")
        || (provider === "lemonade" ? "Flux-2-Klein-4B" : "gemini-3.1-flash-image");
    const normalized = model.replace(/^models\//, "");
    const aliases = { "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image", "gemini-3-pro-image-preview": "gemini-3-pro-image" };
    return { provider, model: provider === "aistudio" ? aliases[normalized] || normalized : normalized };
}

async function requestAiJenaStudioImage(input, signal, model) {
    const apiKey = getUsableAiStudioApiKey();
    if (!apiKey) throw new Error("AI Studio API 키가 없거나 사용이 중지/잠금 상태입니다. FMA 설정에서 키 사용 및 MDPro 보관함 잠금을 확인하세요.");
    const parts = input.map(item => item.type === "image"
        ? { inlineData: { mimeType: item.mime_type || "image/png", data: item.data } }
        : { text: item.text });
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, signal,
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(`AI Studio · ${model} · HTTP ${response.status}: ${data.error?.message || "이미지 요청 실패"}`);
    const image = findGeneratedImageBlock(data.candidates || []);
    if (!image) {
        const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || "이미지 출력 없음";
        const text = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join(" ").slice(0, 300);
        throw new Error(`AI Studio · ${model}: ${reason}${text ? " · " + text : ""}`);
    }
    const mimeType = image.mimeType || "image/png";
    return { src: `data:${mimeType};base64,${image.data}`, mimeType, provider: "aistudio", model };
}

function initAiJenaModelControls() {
    const provider = document.getElementById("aiJenaProvider");
    const model = document.getElementById("aiJenaImageModel");
    const refresh = document.getElementById("btnAiJenaRefreshModels");
    const status = document.getElementById("aiJenaModelStatus");
    if (!provider || !model || !refresh) return;
    let revision = 0;
    const known = { aistudio: ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"], lemonade: ["Flux-2-Klein-4B", "Flux-2-Klein-9B-GGUF"] };
    function render(ids = []) {
        const selected = getAiJenaImageConnection();
        provider.value = selected.provider;
        model.replaceChildren();
        [...new Set([selected.model, ...ids, ...known[selected.provider]])].forEach(id => {
            const option = document.createElement("option");
            option.value = option.textContent = id;
            model.appendChild(option);
        });
        model.value = selected.model;
        if (typeof updateAiJenaKeyStatus === "function") updateAiJenaKeyStatus();
    }
    async function refreshModels() {
        const version = ++revision;
        const selected = getAiJenaImageConnection();
        refresh.disabled = true;
        status.textContent = "모델 목록으로 연결 확인 중…";
        try {
            const lemonade = selected.provider === "lemonade";
            const apiKey = lemonade ? "lemonade" : getUsableAiStudioApiKey();
            if (!apiKey) throw new Error("AI Studio 키 사용/보관함 잠금을 확인하세요.");
            let url = lemonade ? window.getFmaLemonadeBaseUrl() + "/models?show_all=true"
                : "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
            const rows = [];
            do {
                const response = await fetch(url, { headers: lemonade
                    ? { Accept: "application/json", Authorization: "Bearer lemonade" }
                    : { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15000) });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error?.message || "목록 요청 실패"}`);
                rows.push(...(Array.isArray(data) ? data : data.data || data.models || []));
                url = !lemonade && data.nextPageToken
                    ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=" + encodeURIComponent(data.nextPageToken) : "";
            } while (url && version === revision);
            if (version !== revision) return;
            const ids = rows.filter(row => lemonade
                ? /image|diffusion|flux|sdxl|stable.diffusion|sd-cpp/i.test([row.id, row.kind, row.type, row.recipe, ...(Array.isArray(row.labels) ? row.labels : [])].join(" "))
                : /image/i.test(row.name || "") && (row.supportedGenerationMethods || []).includes("generateContent"))
                .map(row => String(row.id || row.name || row.model_name || "").replace(/^models\//, "")).filter(Boolean);
            render(ids);
            status.textContent = `연결 확인 · 이미지 모델 ${ids.length}개 · 생성 성공 여부는 실행 시 확인됩니다.`;
        } catch (error) {
            if (version === revision) status.textContent = "연결 확인 실패: " + error.message;
        } finally { if (version === revision) refresh.disabled = false; }
    }
    provider.addEventListener("change", () => {
        if (typeof aiJenaState !== "undefined" && aiJenaState.processing) return render();
        if (typeof aiJenaState !== "undefined") aiJenaState.imageProvider = provider.value;
        getMdproSettingsHost().localStorage.setItem("ss_fma_jena_provider", provider.value);
        render();
        refreshModels();
    });
    model.addEventListener("change", () => {
        if (typeof aiJenaState !== "undefined" && aiJenaState.processing) return render();
        getMdproSettingsHost().localStorage.setItem("ss_fma_jena_model_" + provider.value, model.value);
        if (typeof updateAiJenaKeyStatus === "function") updateAiJenaKeyStatus();
        status.textContent = "선택한 모델을 다음 실행에 사용합니다.";
    });
    window.renderAiJenaModelControls = render;
    refresh.addEventListener("click", refreshModels);
    render();
}

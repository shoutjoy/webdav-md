(function (root) {
    'use strict';
    const jobs = new Map();
    function cancelled() { return new DOMException('작업이 중지되었습니다.', 'AbortError'); }
    function start(prefix, options) {
        options = options || {};
        if (jobs.has(prefix)) throw new Error('진행 중인 작업을 중지한 뒤 다시 실행하세요.');
        const controller = new AbortController();
        const output = options.output;
        const original = output && output.value;
        const readonly = output && output.readOnly;
        let expected = original, ended = false, committed = false, text = '', first = 0, tokens = 0, estimated = true, responseEnded = 0, paintTimer;
        const started = performance.now();
        const button = document.getElementById(prefix + '-generate');
        let panel = document.getElementById(prefix + '-task-status');
        if (!panel && button) {
            panel = document.createElement('div'); panel.id = prefix + '-task-status';
            panel.className = 'jena-task-status'; panel.setAttribute('role', 'status');
            const metrics = document.createElement('span'); metrics.dataset.metrics = '';
            const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = '중지';
            stop.dataset.stop = ''; stop.onclick = () => controller.abort();
            panel.append(metrics, stop); button.after(panel);
        }
        const locks = Array.from(document.querySelectorAll(options.lockSelector || '#' + prefix + '-insert'))
            .map(element => ({element,disabled:element.disabled}));
        locks.forEach(item => { item.element.disabled = true; });
        if (output) output.readOnly = true;
        function active() { return !ended && !controller.signal.aborted && jobs.get(prefix) === job; }
        function assertActive() { if (!active()) throw cancelled(); }
        function paint() {
            paintTimer = null;
            if (!active()) return;
            const now = responseEnded || performance.now(), elapsed = (now - started) / 1000;
            if (panel) {
                const label = panel.querySelector('[data-metrics]');
                label.textContent = (options.label || 'Jena') + ' · ' + elapsed.toFixed(1) + '초 · 생성 ' + Math.ceil(tokens) + ' tok'
                    + (estimated ? ' (문자 추정)' : '') + (first ? ' · 수신 ' + (tokens / Math.max(.001, (now - first) / 1000)).toFixed(1) + ' tok/s' : ' · 첫 응답 대기');
            }
            if (!committed && options.stream !== false && output && output.value === expected && text) {
                expected = text.replace(/^\s*```(?:javascript|js|latex|tex|math|markdown|md|html)?[^\n]*\n/i, '').replace(/\n```\s*$/, '');
                output.value = expected;
            }
        }
        const tick = root.setInterval(paint, 500);
        const job = {
            signal:controller.signal,
            assertActive,
            complete: async function (request) {
                assertActive();
                await root.openAiJenaChat(false);
                assertActive();
                if (!root.AIChat || !root.AIChat.completeTask) throw new Error('메인 창을 새로고침한 뒤 다시 실행하세요.');
                const result = await root.AIChat.completeTask(Object.assign({}, request, {
                    signal:controller.signal, task:options.task || 'jena-tool', timeoutMs:180000,
                    onStreamEvent:event => {
                        if (!active()) return;
                        if (event && (event.type === 'message.delta' || event.type === 'reasoning.delta') && event.content) {
                            const firstChunk = !first, firstText = event.type === 'message.delta' && !text;
                            if (firstChunk) first = performance.now();
                            if (event.type === 'message.delta') text += String(event.content);
                            // Incremental estimate; do not repeatedly tokenize the entire response.
                            for (const char of String(event.content)) tokens += char.charCodeAt(0) < 128 ? .25 : 2/3;
                            if (!paintTimer) paintTimer = root.setTimeout(paint, firstChunk || firstText ? 0 : 50);
                        }
                        if (typeof request.onStreamEvent === 'function') request.onStreamEvent(event);
                    }
                }));
                assertActive();
                responseEnded = performance.now();
                const usage=result && result.usage || {};
                const reported=usage.outputTokens ?? usage.completion_tokens ?? usage.completionTokens;
                if (reported != null && Number.isFinite(Number(reported))) { tokens=Number(reported); estimated=usage.estimated === true; }
                paint();
                return result;
            },
            commit: function (value) { assertActive(); committed = true; if (output) { expected = String(value); output.value = expected; } },
            finish: function (success) {
                if (ended) return;
                if (!success && output && output.value === expected) output.value = original;
                ended=true; root.clearInterval(tick); root.clearTimeout(paintTimer);
                if (output) output.readOnly=readonly;
                locks.forEach(item => { item.element.disabled=item.disabled; });
                if (jobs.get(prefix) === job) jobs.delete(prefix);
                if (panel) {
                    panel.querySelector('[data-stop]').disabled=true;
                    const label=panel.querySelector('[data-metrics]');
                    label.textContent=(success ? '완료' : controller.signal.aborted ? '중지됨' : '실패') + ' · ' + label.textContent;
                }
            },
            abort: () => controller.abort()
        };
        jobs.set(prefix, job);
        if (panel) {
            panel.hidden=false;
            const stop=panel.querySelector('[data-stop]');
            stop.disabled=false;
            // The panel is reused; its stop handler must own this run's controller.
            stop.onclick=() => controller.abort();
        }
        paint();
        return job;
    }
    root.JenaToolRuntime = Object.freeze({start, cancel:prefix => jobs.get(prefix)?.abort()});
})(window);

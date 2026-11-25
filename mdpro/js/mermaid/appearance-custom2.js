/* Source-backed XY bar value labels. Adds SVG text without changing chart data. */
(function (root) {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    const layerSelector = '[data-mdpro-value-labels]';
    const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const bounds = { fontSize: [4, 120], distance: [0, 200], x: [-1000, 1000], y: [-1000, 1000], decimals: [-1, 6] };

    function parse(source) {
        const code = root.MermaidAppearanceSource.baseSource(String(source));
        const body = code.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
            .replace(/%%\{[\s\S]*?\}%%/g, '').replace(/%%[^\n]*/g, '');
        const header = body.match(/^\s*xychart(?:-beta)?\b([^\n]*)/i);
        if (!header) return { horizontal: false, series: [] };
        const series = [];
        let plot = 0;
        for (const match of body.matchAll(/^[ \t]*(bar|line)[ \t]*\[([^\]]*)\]/gm)) {
            const plotIndex = plot++;
            if (match[1] === 'line') continue;
            const tokens = match[2].split(',').map(v => v.trim());
            if (!tokens.length || tokens.length > 500 || tokens.some(v => !numberPattern.test(v) || !Number.isFinite(Number(v)))) {
                throw Error('bar [...]에는 유한한 숫자를 1~500개까지 입력할 수 있습니다.');
            }
            series.push({ index: series.length, plot: plotIndex, values: tokens.map(Number), tokens });
        }
        return { horizontal: /\bhorizontal\b/i.test(header[1]), series };
    }

    function clean(value) {
        if (!value || value.version !== 1 || !/^[a-f\d]+-\d+$/.test(value.sourceKey) || !Array.isArray(value.items) || value.items.length > 20) throw Error('숫자 항목 설정 형식 오류');
        const ids = new Set();
        let count = 0;
        const items = value.items.map(item => {
            if (!item || typeof item.id !== 'string' || !/^[\w-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 80 || !Number.isInteger(item.series) || item.series < 0 || item.series > 100) throw Error('숫자 항목 이름·계열 오류');
            ids.add(item.id);
            if (!Array.isArray(item.indices) || !item.indices.length || new Set(item.indices).size !== item.indices.length || item.indices.some(i => !Number.isInteger(i) || i < 0 || i >= 500) || (count += item.indices.length) > 500) throw Error('숫자는 중복 없이 총 500개까지 표시할 수 있습니다.');
            for (const [key, [min, max]] of Object.entries(bounds)) if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < min || item[key] > max) throw Error('숫자 항목 범위 오류: ' + key);
            if (!Number.isInteger(item.decimals) || !['outside', 'inside', 'center'].includes(item.position) || typeof item.grouping !== 'boolean' || (item.color !== null && !/^#[a-f\d]{6}$/i.test(item.color))) throw Error('숫자 표시 형식 오류');
            for (const key of ['prefix', 'suffix']) if (typeof item[key] !== 'string' || item[key].length > 24) throw Error('접두·접미 문자는 24자까지 입력할 수 있습니다.');
            return { id: item.id, label: item.label, series: item.series, indices: [...item.indices],
                ...Object.fromEntries(Object.keys(bounds).map(key => [key, item[key]])),
                position: item.position, grouping: item.grouping, color: item.color, prefix: item.prefix, suffix: item.suffix };
        });
        const annotations=value.annotations==null||(Array.isArray(value.annotations)&&!value.annotations.length)?[]:root.MermaidAppearanceContent?.clean(value.annotations);
        if(!annotations)throw Error('추가 내용 모듈이 준비되지 않았습니다.');
        return { version: 1, sourceKey: value.sourceKey, items, annotations };
    }

    function format(value, item) {
        const options = { useGrouping: item.grouping, maximumFractionDigits: item.decimals < 0 ? 20 : item.decimals };
        if (item.decimals >= 0) options.minimumFractionDigits = item.decimals;
        return item.prefix + new Intl.NumberFormat('en-US', options).format(value) + item.suffix;
    }

    function apply(svg, source, value) {
        svg.querySelectorAll(layerSelector).forEach(el => el.remove());
        svg.querySelectorAll('[data-mdpro-added-content]').forEach(el=>el.remove());
        delete svg.dataset.mdproValueLabelError;
        if (!value) return 0;
        const settings = clean(value);
        if (settings.sourceKey !== root.MermaidAppearanceCustom.sourceKey(source)) {
            svg.dataset.mdproValueLabelError = '원본 코드가 변경되었습니다. 숫자 항목을 다시 추가하세요.';
            return 0;
        }
        const data = parse(source), layer = document.createElementNS(NS, 'g');
        layer.setAttribute('data-mdpro-value-labels', '1');
        layer.style.pointerEvents = 'none';
        const text = svg.querySelector('text');
        const autoColor = text ? root.getComputedStyle(text).fill : '#172033';
        let rendered = 0;
        for (const item of settings.items) {
            const series = data.series[item.series];
            const bars = series ? Array.from(svg.querySelectorAll('.bar-plot-' + series.plot + ' rect')) : [];
            if (!series || bars.length !== series.values.length || item.indices.some(i => i >= bars.length)) {
                svg.dataset.mdproValueLabelError = '코드의 숫자와 실제 막대 개수가 다릅니다. 도표를 확인한 뒤 다시 추가하세요.';
                continue;
            }
            for (const index of item.indices) {
                const bar = bars[index], b = bar.getBBox();
                let x = b.x + b.width / 2, y = b.y + b.height / 2, anchor = 'middle';
                if (data.horizontal) {
                    if (item.position !== 'center') {
                        const outside = item.position === 'outside';
                        x = b.x + b.width + (outside ? item.distance : -item.distance);
                        anchor = outside ? 'start' : 'end';
                    }
                } else if (item.position !== 'center') {
                    const offset = item.distance + item.fontSize / 2;
                    y = b.y + (item.position === 'outside' ? -offset : offset);
                }
                const matrix = svg.getScreenCTM().inverse().multiply(bar.getScreenCTM());
                const point = new DOMPoint(x, y).matrixTransform(matrix);
                const label = document.createElementNS(NS, 'text');
                label.setAttribute('data-value-item', item.id);
                label.setAttribute('data-value-index', index);
                label.setAttribute('x', point.x + item.x);
                label.setAttribute('y', point.y + item.y);
                label.setAttribute('text-anchor', anchor);
                label.setAttribute('dominant-baseline', 'central');
                label.style.setProperty('font-size', item.fontSize + 'px', 'important');
                label.style.setProperty('fill', item.color || autoColor, 'important');
                label.style.setProperty('font-weight', '600', 'important');
                label.textContent = format(series.values[index], item);
                layer.append(label); rendered++;
            }
        }
        svg.append(layer);
        if (rendered) {
            const b = svg.getBBox(), v = String(svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
            if (v.length === 4 && v.every(Number.isFinite)) {
                const x = Math.min(v[0], b.x - 8), y = Math.min(v[1], b.y - 8);
                svg.setAttribute('viewBox', [x, y, Math.max(v[0] + v[2], b.x + b.width + 8) - x, Math.max(v[1] + v[3], b.y + b.height + 8) - y].join(' '));
            }
        }
        if(root.MermaidAppearanceContent)rendered+=root.MermaidAppearanceContent.apply(svg,settings.annotations);
        return rendered;
    }

    function attach(wrapper, host, change) {
        const box = document.createElement('fieldset'); box.className = 'trt-mermaid-category trt-mermaid-custom2';
        box.style.cssText = 'grid-column:1/-1;display:flex;flex-direction:column;align-items:stretch';
        const legend = document.createElement('legend'); legend.textContent = '커스터마이즈 2 · 텍스트·내용 추가';
        const note = document.createElement('p'); note.textContent = '자유 텍스트·제목·메모는 모든 도표에서 추가할 수 있습니다. 아래 XY 숫자 추가는 별도로 유지됩니다.';
        const status = document.createElement('p'); status.setAttribute('role', 'status');
        const series = document.createElement('select'); series.setAttribute('aria-label', '숫자를 가져올 코드'); series.title = '숫자를 읽을 bar [...] 계열을 선택합니다. 축 눈금이나 line [...] 값은 사용하지 않습니다.';
        const indices = document.createElement('select'); indices.multiple = true; indices.size = 6; indices.style.cssText = 'width:100%;height:130px'; indices.setAttribute('aria-label', '표시할 숫자 항목'); indices.title = '숫자를 표시할 막대를 고릅니다. 기본은 전체이며 Ctrl/⌘로 개별 선택, Shift로 연속 선택합니다.';
        const name = document.createElement('input'); name.type = 'text'; name.style.cssText = 'width:100%;min-width:0;height:34px;box-sizing:border-box;color:#172033;background:#fff'; name.maxLength = 80; name.placeholder = '항목 이름 · 예: 월별 매출 수치'; name.setAttribute('aria-label', '숫자 항목 이름'); name.title = '추가할 숫자 묶음의 이름입니다. 비우면 막대 계열 이름을 사용합니다.';
        const tools = document.createElement('div'); tools.style.cssText = 'display:grid;gap:12px;width:100%';
        function button(text, title, action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = title; b.className = 'trt-mermaid-btn trt-mermaid-fixed-fit'; b.onclick = action; return b; }
        const add = button('막대 위에 숫자 추가', '선택한 코드 숫자를 실제 막대 끝에 표시합니다. 원래 bar/line 값은 바꾸지 않습니다.', async () => {
            try {
                const selected = Array.from(indices.selectedOptions, o => Number(o.value));
                if (!selected.length || !parsed.series.length) throw Error('bar [...] 계열과 표시할 숫자를 선택하세요.');
                const config = current();
                config.items.push({ id: 'values-' + crypto.randomUUID(), label: name.value.trim() || '막대 ' + (Number(series.value) + 1) + ' 수치', series: Number(series.value), indices: selected, fontSize: 16, color: null, distance: 8, x: 0, y: 0, position: 'outside', grouping: true, decimals: -1, prefix: '', suffix: '' });
                await commit(config);
            } catch (error) { status.textContent = error.message; }
        });
        const xy=document.createElement('details'),xyTitle=document.createElement('summary');xyTitle.textContent='XY 막대 숫자 추가';xy.append(xyTitle,series,indices,name,add,tools);box.append(legend,note,xy,status); host.append(box);
        let parsed = { series: [] }, sourceSeen = null;
        const content=root.MermaidAppearanceContent?.attach(wrapper,box,current,commit);
        if(content)box.prepend(legend);
        function current() {
            const value = wrapper.__mdvMermaidAppearance?.custom2;
            const key = root.MermaidAppearanceCustom.sourceKey(wrapper.dataset.mermaidOriginalSource);
            return value && value.sourceKey === key ? clean(value) : { version: 1, sourceKey: key, items: [] };
        }
        function fillNumbers() {
            indices.replaceChildren();
            const values = parsed.series[Number(series.value)]?.tokens || [];
            values.forEach((value, index) => { const option = new Option((index + 1) + ' · ' + value, String(index)); option.selected = true; option.title = '원본 코드의 ' + (index + 1) + '번째 막대 값: ' + value; indices.add(option); });
        }
        series.onchange = fillNumbers;
        async function commit(config) {
            await change({ custom2: config.items.length || config.annotations?.length ? clean(config) : null });
            refresh();
        }
        function renderTools() {
            tools.replaceChildren();
            for (const item of current().items) {
                const card = document.createElement('section'); card.className = 'trt-custom2-item';
                card.style.cssText = 'display:grid;gap:8px;border:1px solid #94a3b8;border-radius:6px;padding:10px';
                const title = document.createElement('strong'); title.textContent = item.label + ' · ' + item.indices.length + '개 숫자'; title.title = '원본 막대 데이터에서 읽은 숫자 묶음입니다. 아래 설정으로 표시 모양만 조절합니다.'; card.append(title);
                async function set(key, value) {
                    try { const config = current(); const target = config.items.find(v => v.id === item.id); if (!target) throw Error('숫자 항목을 다시 추가하세요.'); target[key] = value; await commit(config); }
                    catch (error) { status.textContent = error.message; }
                }
                function field(key, label, type, help, options) {
                    const row = document.createElement('label'), input = document.createElement(options ? 'select' : 'input');
                    input.setAttribute('aria-label', item.label + ' ' + label); input.title = help;
                    if (options) { for (const [v, text] of options) input.add(new Option(text, v)); input.value = item[key]; }
                    else { input.type = type; if (bounds[key]) { [input.min, input.max] = bounds[key]; input.step = key === 'decimals' ? '1' : 'any'; } if (type === 'checkbox') input.checked = item[key]; else input.value = item[key] ?? '#172033'; if (type === 'text') { input.maxLength = 24; input.style.cssText = 'width:140px;max-width:60%;min-width:0;color:#172033;background:#fff'; } }
                    input.onchange = () => { if (input.checkValidity() && (type !== 'number' || input.value !== '')) set(key, type === 'number' ? Number(input.value) : type === 'checkbox' ? input.checked : input.value); else status.textContent = label + ' 범위를 확인하세요.'; };
                    row.append(document.createTextNode(label), input); card.append(row); return input;
                }
                field('position', '표시 위치', 'select', '막대 끝 바깥·안쪽 또는 가운데에 표시합니다. 세로 막대는 위쪽, 가로 막대는 오른쪽 끝을 기준으로 합니다.', [['outside', '막대 끝 바깥'], ['inside', '막대 끝 안쪽'], ['center', '막대 가운데']]);
                field('fontSize', '글자 크기', 'number', '숫자 글자 크기입니다. 4~120px.');
                field('color', '글자색', 'color', '숫자 글자색을 직접 지정합니다. 기본은 도표 글자색을 따릅니다.');
                card.append(button('도표 글자색 사용', '직접 지정한 색을 해제하고 현재 도표의 글자색을 따릅니다.', () => set('color', null)));
                field('distance', '막대와 간격', 'number', '막대 끝과 글자 사이의 간격입니다. 0~200. 가운데 배치에는 적용하지 않습니다.');
                field('x', '가로 이동', 'number', '숫자만 가로로 이동합니다. 음수는 왼쪽, 양수는 오른쪽입니다.');
                field('y', '세로 이동', 'number', '숫자만 세로로 이동합니다. 음수는 위, 양수는 아래입니다.');
                field('grouping', '천 단위 구분', 'checkbox', '5000을 5,000처럼 표시합니다. 원래 코드 숫자는 유지합니다.');
                field('decimals', '소수 자릿수', 'number', '-1은 자동, 0~6은 고정 소수 자릿수입니다. 표시값만 반올림합니다.');
                field('prefix', '앞에 붙일 글자', 'text', '숫자 앞에 붙일 글자입니다. 예: $. 최대 24자.');
                field('suffix', '뒤에 붙일 글자', 'text', '숫자 뒤에 붙일 글자입니다. 예: 원, %, 명. 최대 24자.');
                card.append(button('숫자 항목 삭제', '이 숫자 묶음만 삭제합니다. 원래 막대·코드·다른 커스텀 도구는 유지합니다.', async () => { try { const config = current(); config.items = config.items.filter(v => v.id !== item.id); await commit(config); } catch (error) { status.textContent = error.message; } }));
                tools.append(card);
            }
        }
        function refresh() {
            try {
                const source = wrapper.dataset.mermaidOriginalSource;
                if (source !== sourceSeen) {
                    parsed = parse(source); series.replaceChildren();
                    for (const data of parsed.series) series.add(new Option('막대 ' + (data.index + 1) + ' · bar [' + data.tokens.join(', ') + ']', String(data.index)));
                    fillNumbers(); sourceSeen = source;
                }
                add.disabled = series.disabled = indices.disabled = !parsed.series.length;
                renderTools();content?.refresh();
                status.textContent = wrapper.querySelector('.trt-mermaid-canvas svg')?.dataset.mdproValueLabelError || (parsed.series.length ? '코드에 적용 전에는 미리보기만 변경됩니다.' : '이 도표에서는 위의 텍스트·내용 추가를 사용하세요. XY 숫자는 bar [...]가 있을 때 사용합니다.');
            } catch (error) { add.disabled = true; status.textContent = error.message; }
        }
        refresh();
        return { refresh };
    }
    root.MermaidAppearanceCustom2 = { parse, clean, format, apply, attach };
})(window);

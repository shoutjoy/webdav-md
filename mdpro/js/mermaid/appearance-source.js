/* Mermaid display controls -> explicit source command, with durable pre-change snapshots. */
(function (root) {
    'use strict';
    const START = '%% MDPRO appearance start';
    const END = '%% MDPRO appearance end';
    const TYPE = 'mermaid_style_snapshot';
    const ranges = {font:[4,200],stroke:[0,100],nodeStroke:[0,100],arrowSize:[.1,10],edgeLength:[.1,30],width:[.1,10],alpha:[0,1],pointSize:[.5,100],chartWidth:[.2,10],chartHeight:[.2,10],layoutSpacing:[.1,20]};
    const fontFamilies = ['Malgun Gothic', 'Noto Sans KR', 'Nanum Gothic', 'Arial', 'Georgia', 'Consolas', 'sans-serif', 'serif', 'monospace'];
    function blocks(text) {
        const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
        const result = [];
        let fence = null, offset = 0;
        for (const line of lines) {
            const clean = line.replace(/\r?\n$/, '');
            if (!fence) {
                const m = clean.match(/^( {0,3})(`{3,}|~{3,})\s*([^\s]*)[^\r\n]*$/);
                if (m) fence = { char: m[2][0], length: m[2].length, mermaid: m[3].toLowerCase() === 'mermaid', start: offset + line.length, indent: m[1] };
            } else if (new RegExp('^ {0,3}' + fence.char + '{' + fence.length + ',}\\s*$').test(clean)) {
                if (fence.mermaid) result.push({ start: fence.start, end: offset, code: text.slice(fence.start, offset), indent: fence.indent });
                fence = null;
            }
            offset += line.length;
        }
        return result;
    }
    function stripManaged(source) {
        const starts = source.match(/^%% MDPRO appearance start\r?$/gm) || [];
        const ends = source.match(/^%% MDPRO appearance end\r?$/gm) || [];
        if (!starts.length && !ends.length) return source;
        if (starts.length !== 1 || ends.length !== 1) throw new Error('스타일 기록 주석이 손상되었습니다.');
        const pattern = /^%% MDPRO appearance start\r?\n[\s\S]*?^%% MDPRO appearance end(?:\r?\n|$)/m;
        if (!pattern.test(source)) throw new Error('스타일 기록 주석 순서를 확인하세요.');
        const direction = (source.match(/^%% MDPRO appearance original-direction (TD|TB|BT|LR|RL|default)\r?$/m) || [])[1];
        const stripped = source.replace(pattern, '');
        return direction ? withDirection(stripped, direction === 'default' ? '' : direction) : stripped;
    }
    function readAppearance(source) {
        const match = String(source).match(/^%% MDPRO appearance values (.+)$/m);
        if (!match) return null;
        try {
            const value = JSON.parse(match[1]), clean = {};
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            for (const [key, [min, max]] of Object.entries(ranges)) {
                if (value[key] == null) continue;
                if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < min || value[key] > max) return null;
                clean[key] = value[key];
            }
            for (const key of ['color', 'nodeColor', 'fill', 'textColor']) if (value[key] != null) {
                if (!/^#[\da-f]{6}$/i.test(value[key])) return null;
                clean[key] = value[key];
            }
            if (value.direction != null) { if (!['TD', 'LR'].includes(value.direction)) return null; clean.direction = value.direction; }
            if (value.fontFamily != null) { if (!fontFamilies.includes(value.fontFamily)) return null; clean.fontFamily = value.fontFamily; }
            if (value.fontWeight != null) { if (![400, 700].includes(value.fontWeight)) return null; clean.fontWeight = value.fontWeight; }
            if (value.custom != null) { if (!root.MermaidAppearanceCustom) return null; clean.custom = root.MermaidAppearanceCustom.clean(value.custom); }
            if (value.custom2 != null) { if (!root.MermaidAppearanceCustom2) return null; clean.custom2 = root.MermaidAppearanceCustom2.clean(value.custom2); }
            return clean;
        } catch (_) { return null; }
    }
    function withDirection(source, direction) {
        if (direction == null) return source;
        if (direction !== '' && !['TD', 'TB', 'BT', 'LR', 'RL'].includes(direction)) throw new Error('잘못된 방향');
        return source.replace(/^([ \t]*(?:flowchart|graph))(?:[ \t]+(?:TD|TB|BT|LR|RL))?(?=[ \t;\r\n]|$)/m, '$1' + (direction ? ' ' + direction : ''));
    }
    function serialize(source, appearance, nodes, edgeCount) {
        let original = stripManaged(source).replace(/\r?\n$/, '');
        const a = Object.assign({}, appearance || {}), config = {};
        if (a.custom != null) { if (!root.MermaidAppearanceCustom) throw Error('커스텀 모듈이 준비되지 않았습니다.'); a.custom=root.MermaidAppearanceCustom.clean(a.custom); }
        if (a.custom2 != null) { if (!root.MermaidAppearanceCustom2) throw Error('숫자 항목 모듈이 준비되지 않았습니다.'); a.custom2=root.MermaidAppearanceCustom2.clean(a.custom2); }
        // Keep handwritten config and its CSS; refuse ambiguous configuration rather than erase it.
        const isFlow = !root.MermaidAppearanceTypes || root.MermaidAppearanceTypes.flow(original);
        if (isFlow && /^\s*---(?:\r?\n)/.test(original)) throw new Error('YAML 설정 도표는 코드 적용을 지원하지 않습니다. 미리보기 조절은 사용할 수 있습니다.');
        original.replace(/%%\{\s*(?:init|initialize)\s*:\s*([\s\S]*?)\}%%/gi, (_, json) => {
            let value;
            try { value = JSON.parse(json); } catch (_) { throw new Error('기존 init 설정을 JSON 형식으로 정리한 뒤 적용하세요.'); }
            return _;
        });
        const number = (key, min, max) => {
            if (a[key] == null) return null;
            [min, max] = ranges[key] || [min, max];
            const value = Number(a[key]);
            if (!Number.isFinite(value) || value < min || value > max) throw new Error('잘못된 스타일 값: ' + key);
            return value;
        };
        const color = key => { if (a[key] == null) return null; if (!/^#[\da-f]{6}$/i.test(a[key])) throw new Error('잘못된 색상'); return a[key]; };
        const arrowSize = number('arrowSize', .25, 3);
        const edgeLength = number('edgeLength', .5, 5);
        const font = number('font', 8, 48), stroke = number('stroke', .5, 10), nodeStroke = number('nodeStroke', .5, 10), width = number('width', .3, 3);
        const edgeColor = color('color'), nodeColor = color('nodeColor'), fill = color('fill'), textColor = color('textColor'), alpha = number('alpha', 0, 1);
        if (a.direction != null && !['TD', 'LR'].includes(a.direction)) throw new Error('잘못된 방향');
        if (a.fontFamily != null && !fontFamilies.includes(a.fontFamily)) throw new Error('지원하지 않는 폰트');
        if (a.fontWeight != null && ![400, 700].includes(a.fontWeight)) throw new Error('잘못된 글자 굵기');
        const originalDirection = (original.match(/^[ \t]*(?:flowchart|graph)[ \t]+(TD|TB|BT|LR|RL)\b/m) || [])[1] || 'default';
        if (a.direction) original = withDirection(original, a.direction);
        if (!isFlow) {
            for (const [key, min, max] of [['pointSize',1,30],['chartWidth',.5,3],['chartHeight',.5,3],['layoutSpacing',.5,5]]) number(key,min,max);
            if (!Object.values(a).some(v => v != null)) return original;
            const makeManaged = directive => START + '\n%% MDPRO appearance values ' + JSON.stringify(a).replace(/%/g,'\\u0025') + '\n' + directive + END + '\n';
            // Comments after frontmatter preserve the user's YAML and diagram indentation.
            const front = original.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
            if (front) return front[0] + makeManaged('') + original.slice(front[0].length);
            const standard = root.MermaidAppearanceTypes.config(original, a);
            standard.themeCSS = root.MermaidAppearanceTypes.css(a);
            if (font != null) standard.themeVariables = { fontSize: font + 'px' };
            if (a.fontFamily) standard.fontFamily = a.fontFamily;
            return makeManaged('%%{init: ' + JSON.stringify(standard) + '}%%\n') + original;
        }
        const rules = [];
        const nodeStyles = [];
        if (font != null) { config.themeVariables = { fontSize: font + 'px' }; nodeStyles.push('font-size:' + font + 'px'); }
        if (nodeStroke != null) nodeStyles.push('stroke-width:' + nodeStroke + 'px');
        if (nodeColor) nodeStyles.push('stroke:' + nodeColor);
        if (a.fontFamily) { nodeStyles.push('font-family:' + a.fontFamily); config.themeVariables = Object.assign({}, config.themeVariables, { fontFamily: a.fontFamily }); }
        if (a.fontWeight != null) nodeStyles.push('font-weight:' + a.fontWeight);
        if (fill) nodeStyles.push('fill:' + fill);
        if (alpha != null) nodeStyles.push('fill-opacity:' + alpha);
        if (textColor) { nodeStyles.push('color:' + textColor); config.themeVariables = Object.assign({}, config.themeVariables, { textColor, nodeTextColor: textColor, edgeLabelTextColor: textColor }); }
        if (nodeStyles.length) {
            if (!nodes || !nodes.length || nodes.some(id => !/^[\p{L}\p{N}_-]+$/u.test(id))) throw new Error('도형 ID를 안전하게 확인하지 못했습니다.');
            nodes.forEach(id => rules.push('style ' + id + ' ' + nodeStyles.join(',')));
        }
        const edgeStyles = [];
        if (stroke != null) edgeStyles.push('stroke-width:' + stroke + 'px');
        if (edgeColor) { edgeStyles.push('stroke:' + edgeColor); config.themeVariables = Object.assign({}, config.themeVariables, { lineColor: edgeColor }); }
        if (a.fontFamily) edgeStyles.push('font-family:' + a.fontFamily);
        if (a.fontWeight != null) edgeStyles.push('font-weight:' + a.fontWeight);
        if (textColor) edgeStyles.push('color:' + textColor);
        if (edgeStyles.length && edgeCount > 0) rules.push('linkStyle ' + Array.from({ length: edgeCount }, (_, i) => i).join(',') + ' ' + edgeStyles.join(','));
        if (width != null) config.flowchart = { padding: 20 * width, wrappingWidth: 200 * width };
        if (edgeLength != null) config.flowchart = Object.assign({}, config.flowchart, { rankSpacing: 50 * edgeLength });
        if (![a.custom, a.custom2, arrowSize, edgeLength, font, stroke, nodeStroke, width, edgeColor, nodeColor, fill, textColor, alpha, a.direction, a.fontFamily, a.fontWeight].some(v => v != null)) return original;
        // Standard Mermaid style/linkStyle commands survive reopening and other renderers.
        const directive = Object.keys(config).length ? '%%{init: ' + JSON.stringify(config) + '}%%\n' : '';
        return original + '\n' + START + '\n%% MDPRO appearance values ' + JSON.stringify(a).replace(/%/g,'\\u0025') + '\n%% MDPRO appearance original-direction ' + originalDirection + '\n' + directive + rules.join('\n') + '\n' + END;
    }

    function target(wrapper) {
        const viewer = document.getElementById('viewer');
        if (!viewer || !viewer.contains(wrapper)) throw new Error('현재 문서 보기에서만 코드를 적용할 수 있습니다.');
        const base = root.MermaidAppearanceEditor.read();
        if (base.readOnly) throw new Error('읽기 전용 문서입니다.');
        const source = String(wrapper.getAttribute('data-mermaid-original-source') || '').trim();
        const matches = blocks(base.content).map((b, index) => ({ ...b, index })).filter(b => b.code.trim() === source);
        const peers = Array.from(viewer.querySelectorAll('.trt-mermaid-wrapper')).filter(w => String(w.getAttribute('data-mermaid-original-source') || '').trim() === source);
        if (!matches.length || matches.length !== peers.length) throw new Error('원본 도표 위치를 안전하게 찾지 못했습니다. 보기를 새로 열어 주세요.');
        const block = matches[peers.indexOf(wrapper)];
        if (!block) throw new Error('현재 도표가 변경되었습니다.');
        return { base, block };
    }
    function database() {
        if (root.isInDbStorageEnabled && !root.isInDbStorageEnabled()) throw new Error('inDB 사용을 켜야 이전 코드를 저장하고 적용할 수 있습니다.');
        const db = root.InDbStorage && root.InDbStorage.getDatabase();
        if (!db || !db.objectStoreNames.contains('mermaid_refs')) throw new Error('inDB가 준비되지 않았습니다.');
        return db;
    }
    async function records() {
        const db = database();
        return new Promise((resolve, reject) => {
            const request = db.transaction('mermaid_refs', 'readonly').objectStore('mermaid_refs').getAll();
            request.onsuccess = () => resolve(request.result.filter(r => r.recordType === TYPE));
            request.onerror = () => reject(request.error);
        });
    }
    async function replace(wrapper, nextCode, reason, exact) {
        const { base, block } = target(wrapper);
        const nl = block.code.includes('\r\n') ? '\r\n' : '\n';
        const replacement = exact ? nextCode : nextCode.replace(/\r\n/g, '\n').replace(/\n/g, nl) + nl;
        if (replacement === block.code) throw new Error('원본과 같은 코드입니다.');
        database();
        // Validate actual Mermaid syntax before saving or touching the document.
        await root.MermaidTRT.validateSource(replacement);
        const record = { id: 'mermaid-style-' + crypto.randomUUID(), recordType: TYPE, createdAt: Date.now(), updatedAt: Date.now(),
            documentKey: base.documentKey, blockIndex: block.index, code: block.code, afterCode: replacement,
            prompt: reason, imageName: 'Mermaid 스타일 변경 전', reason };
        if (!await root.saveFeatureRecordToInDb('mermaid_refs', record)) throw new Error('변경 전 코드 저장에 실패했습니다. 원본은 변경하지 않았습니다.');
        // The command checks the full snapshot again after asynchronous parse/DB work.
        root.MermaidAppearanceEditor.replace(base, block.start, block.end, replacement);
        if (root.showToast) root.showToast('Mermaid 코드를 적용했습니다. 변경 기록 또는 Ctrl+Z로 복원할 수 있습니다.');
        return record;
    }
    async function apply(wrapper) {
        const { block } = target(wrapper);
        const nodes = Array.from(wrapper.querySelectorAll('svg .node')).map(node => (node.id.match(/flowchart-(.+)-\d+$/) || [])[1]);
        return replace(wrapper, serialize(block.code, wrapper.__mdvMermaidAppearance, nodes, wrapper.querySelectorAll('svg .flowchart-link').length), '스타일 코드 적용');
    }
    async function showHistory(wrapper, host) {
        let panel = host.querySelector('.trt-mermaid-source-history');
        if (panel) { panel.remove(); return; }
        panel = document.createElement('section'); panel.className = 'trt-mermaid-source-history';
        panel.style.cssText = 'flex:1 0 100%;max-height:320px;overflow:auto;min-width:0;white-space:normal';
        panel.setAttribute('aria-label', 'Mermaid 코드 변경 기록'); host.append(panel);
        const status = document.createElement('p'); status.setAttribute('role', 'status'); panel.append(status);
        try {
            const { base, block } = target(wrapper);
            const all = (await records()).filter(r => r.documentKey === base.documentKey && r.blockIndex === block.index);
            // Follow code lineage, preventing same-name/position documents from sharing unrelated history.
            const known = new Set([block.code.trim()]);
            let changed;
            do { changed = false; for (const r of all) if (known.has(r.code.trim()) || known.has(r.afterCode.trim())) {
                for (const code of [r.code, r.afterCode]) if (!known.has(code.trim())) { known.add(code.trim()); changed = true; }
            } } while (changed);
            const list = all.filter(r => known.has(r.afterCode.trim())).sort((a, b) => b.createdAt - a.createdAt);
            status.textContent = list.length ? '선택한 코드로 복원 시 현재 코드도 inDB에 저장합니다.' : '이 도표의 저장된 변경 기록이 없습니다.';
            for (const record of list) {
                const item = document.createElement('details'), title = document.createElement('summary'), code = document.createElement('pre');
                title.textContent = new Date(record.createdAt).toLocaleString('ko-KR') + ' · ' + record.reason;
                code.textContent = record.code; code.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto';
                const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'trt-mermaid-btn trt-mermaid-fixed-fit'; restore.textContent = '이 코드로 복원';
                restore.onclick = async () => { restore.disabled = true; try { await replace(wrapper, record.code, '이 코드로 복원', true); } catch (error) { status.textContent = error.message; } finally { restore.disabled = false; } };
                const remove = document.createElement('button'); remove.type = 'button'; remove.className = restore.className; remove.textContent = '삭제';
                remove.title = '이 변경 기록만 삭제';
                remove.onclick = async () => {
                    remove.disabled = restore.disabled = true;
                    try {
                        database();
                        if (typeof root.deleteFeatureRecordFromInDb !== 'function' || !await root.deleteFeatureRecordFromInDb('mermaid_refs', record.id)) throw new Error('변경 기록을 삭제하지 못했습니다.');
                        item.remove();
                        status.textContent = panel.querySelector('details') ? '선택한 변경 기록을 삭제했습니다.' : '이 도표의 저장된 변경 기록이 없습니다.';
                    } catch (error) { status.textContent = '삭제 실패: ' + error.message; }
                    finally { remove.disabled = restore.disabled = false; }
                };
                const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap'; actions.append(restore, remove);
                item.append(title, code, actions); panel.append(item);
            }
        } catch (error) { status.textContent = error.message; }
    }
    root.MermaidAppearanceSource = { apply, showHistory, serialize, blocks, readAppearance, withDirection, fontFamilies, ranges, baseSource: stripManaged, replaceCode: function(wrapper,code){if(typeof code!=='string'||!code.trim()||code.length>500000)throw Error('수정 코드를 확인하세요.');return replace(wrapper,code.replace(/\r?\n$/,''),'Jena ME 내용 수정 코드 교체');} };
})(window);

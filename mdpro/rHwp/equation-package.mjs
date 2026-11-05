const HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
const HH = 'http://www.hancom.co.kr/hwpml/2011/head';
const parse = text => {
    const xml = new DOMParser().parseFromString(text,'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('수식 문서 XML 오류');
    return xml;
};
export async function embedEquations(bytes, equations, core) {
    if (!equations.length) return bytes;
    const templates = core.HwpDocument.createEmpty();
    let nativeBytes;
    try {
        templates.createBlankDocument();
        for (const eq of equations) {
            const result = JSON.parse(templates.insertEquation(0,0,0,eq.script,1000,0));
            if (!result.ok) throw new Error('한글 수식 개체 생성 실패');
        }
        const output = templates.exportHwpxWithReport();
        try {
            if (JSON.parse(output.contentLoss()).count) throw new Error('수식 직렬화 손실');
            nativeBytes = output.takeBytes();
        } finally {output.free();}
    } finally {templates.free();}
    const nativeZip = await globalThis.JSZip.loadAsync(nativeBytes);
    const nativeXml = parse(await nativeZip.file('Contents/section0.xml').async('string'));
    // Insertion at offset zero prepends each object. Match by unique native
    // instance IDs assigned at creation, not by visual paragraph order.
    const native = [...nativeXml.getElementsByTagNameNS(HP,'equation')].sort((a,b) => Number(a.getAttribute('id'))-Number(b.getAttribute('id')));
    if (native.length !== equations.length) throw new Error('수식 생성 개체 수 불일치');
    const zip = await globalThis.JSZip.loadAsync(bytes);
    const xml = parse(await zip.file('Contents/section0.xml').async('string'));
    const header = parse(await zip.file('Contents/header.xml').async('string'));
    const properties = header.getElementsByTagNameNS(HH,'paraProperties')[0];
    let inserted = 0;
    for (const [index,eq] of equations.entries()) {
        const matches = [...xml.getElementsByTagNameNS(HP,'t')].filter(t => t.textContent.includes(eq.marker));
        if (matches.length !== 1 || matches[0].textContent.split(eq.marker).length !== 2) throw new Error('수식 위치 누락 또는 중복');
        const t = matches[0], parent = t.parentNode;
        const [before,after] = t.textContent.split(eq.marker);
        const object = xml.importNode(native[index],true);
        object.getElementsByTagNameNS(HP,'pos')[0].setAttribute('affectLSpacing','1');
        if (object.getElementsByTagNameNS(HP,'script')[0].textContent !== eq.script) throw new Error('수식 생성 순서 불일치');
        const size = object.getElementsByTagNameNS(HP,'sz')[0];
        let available = 51024;
        const cell = t.closest('tc');
        if (cell) { const cellSize = cell.getElementsByTagNameNS(HP,'cellSz')[0]; if (cellSize) available = Math.min(available, Number(cellSize.getAttribute('width'))-700); }
        const width = Number(size.getAttribute('width'));
        if (width > available && available > 0) {
            const scale = available/width;
            if(scale<.1)throw new Error('표 셀 폭에 비해 수식이 너무 큽니다. 열 폭을 늘려주세요.');
            object.setAttribute('baseUnit',String(Math.max(100,Math.floor(1000*scale))));
            for (const key of ['width','height']) size.setAttribute(key,String(Math.floor(Number(size.getAttribute(key))*scale)));
        }
        const comment = object.getElementsByTagNameNS(HP,'shapeComment')[0];
        if (comment) comment.textContent = '수식: ' + eq.tex;
        if (before) { const text = xml.createElementNS(HP,'hp:t');text.textContent=before;parent.insertBefore(text,t); }
        parent.insertBefore(object,t);
        if (after) { const text = xml.createElementNS(HP,'hp:t');text.textContent=after;parent.insertBefore(text,t); }
        t.remove(); inserted++;
    }
    // Placeholder line metrics are invalid once equation sizes are installed.
    for (const lines of [...xml.getElementsByTagNameNS(HP,'linesegarray')]) lines.remove();
    if (inserted !== equations.length) throw new Error('수식 개체 수 불일치');
    // Engine-generated equation positions currently serialize affectLSpacing=0.
    // Reserve a minimum line height in each containing paragraph, derived from
    // the actual native equation dimensions rather than a fixed sleep/font size.
    for (const p of [...xml.getElementsByTagNameNS(HP,'p')]) {
        const objects = [...p.children].filter(e=>e.localName==='run').flatMap(run=>[...run.children].filter(e=>e.localName==='equation'));
        if (!objects.length) continue;
        // Reserve both ascent and descent around the text baseline. The native
        // equation box is anchored at the baseline, not centered in text height.
        const height = Math.max(1600,...objects.map(eq=>2*Number(eq.getElementsByTagNameNS(HP,'sz')[0].getAttribute('height'))+400));
        const original = [...properties.children].find(pr=>pr.getAttribute('id')===p.getAttribute('paraPrIDRef'));
        if (!original) throw new Error('수식 문단 스타일 참조 오류');
        const copy = original.cloneNode(true);
        copy.setAttribute('id',String(properties.children.length));
        for (const spacing of copy.getElementsByTagNameNS(HH,'lineSpacing')) {
            // HwpUnitChar switch cases store half the non-percent spacing;
            // the native parser multiplies that branch by two (header.rs).
            const inCase=spacing.parentElement.localName==='case';
            spacing.setAttribute('type','AT_LEAST');spacing.setAttribute('value',String(Math.ceil(height*(inCase?.5:1))));
        }
        p.setAttribute('paraPrIDRef',copy.getAttribute('id'));
        properties.append(copy);
        const text = [...p.children].filter(e=>e.localName==='run').flatMap(run=>[...run.children].filter(e=>e.localName==='t')).map(t=>t.textContent).join('');
        if (!text.trim()) {
            for (const margin of copy.getElementsByTagNameNS(HH,'margin')) {
                const next=[...margin.children].find(e=>e.localName==='next');
                if(next)next.setAttribute('value',String(Math.ceil(height*(margin.parentElement.localName==='case'?1:2))));
            }
        }
    }
    for(const table of [...xml.getElementsByTagNameNS(HP,'tbl')]) {
        const cells=[...table.getElementsByTagNameNS(HP,'tc')];
        if(cells.some(cell=>Number(cell.getElementsByTagNameNS(HP,'cellSpan')[0]?.getAttribute('rowSpan'))>1))continue;
        const rows=new Map();
        for(const cell of cells) {
            const size=cell.getElementsByTagNameNS(HP,'cellSz')[0],addr=cell.getElementsByTagNameNS(HP,'cellAddr')[0];
            if(!size||!addr)continue;
            let minimum=0;
            for(const p of cell.getElementsByTagNameNS(HP,'p')) {
                const heights=[...p.getElementsByTagNameNS(HP,'equation')].map(eq=>2*Number(eq.getElementsByTagNameNS(HP,'sz')[0].getAttribute('height'))+600);
                minimum+=Math.max(1600,...heights);
            }
            const row=addr.getAttribute('rowAddr');rows.set(row,Math.max(rows.get(row)||0,Number(size.getAttribute('height')),minimum+400));
        }
        for(const cell of cells) {const size=cell.getElementsByTagNameNS(HP,'cellSz')[0],addr=cell.getElementsByTagNameNS(HP,'cellAddr')[0];if(size&&addr)size.setAttribute('height',String(rows.get(addr.getAttribute('rowAddr'))));}
        const size=[...table.children].find(e=>e.localName==='sz');if(size)size.setAttribute('height',String([...rows.values()].reduce((a,b)=>a+b,0)));
    }
    properties.setAttribute('itemCnt',String(properties.children.length));
    zip.file('Contents/header.xml',new XMLSerializer().serializeToString(header));
    zip.file('Contents/section0.xml',new XMLSerializer().serializeToString(xml));
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function equationScripts(bytes) {
    const zip = await globalThis.JSZip.loadAsync(bytes);
    const scripts = [];
    for (const name of Object.keys(zip.files).filter(name => /^Contents\/section\d+\.xml$/.test(name)).sort()) {
        const xml = parse(await zip.file(name).async('string'));
        scripts.push(...[...xml.getElementsByTagNameNS(HP,'equation')].map(eq=>eq.getElementsByTagNameNS(HP,'script')[0].textContent));
    }
    return scripts;
}

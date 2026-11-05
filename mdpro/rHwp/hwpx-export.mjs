import {loadCore, serialize} from './rhwp-loader.mjs';
import {protectEquations} from './tex-equation.mjs';
import {embedEquations, equationScripts} from './equation-package.mjs';
import {waitForExportStep} from './export-task.mjs';
import {applyHeadingStyles,validateHeadingStyles} from './heading-styles.mjs';
let busy = false;
const supported = new Set(['space','heading','paragraph','text','strong','em','del','codespan','code','br','escape','link','image','list','list_item','blockquote','table','html','hr']);
function mathSource(token) {
    let raw = token.raw || '';
    const visit = tokens => { for (const child of tokens || []) { if (['code','codespan'].includes(child.type)) raw = raw.replace(child.raw, ''); else visit(child.tokens); } };
    visit(token.tokens);
    return raw;
}
export function validateTokens(tokens, parser) {
    for (const token of tokens) {
        if (!supported.has(token.type)) throw new Error(`HWPX에서 아직 보존하지 못하는 요소: ${token.type}`);
        if (token.type === 'html' && !/^(?:\s*<\/?(?:br|p|div|span|b|strong|i|em|u|s|sub|sup|table|thead|tbody|tfoot|tr|td|th|col|colgroup)\b[^>]*>\s*|[^<>]+)+$/i.test(token.raw)) throw new Error('지원하지 않는 HTML 요소입니다.');
        if (['paragraph','heading','text','escape','strong','em','del'].includes(token.type) && /\\+[([]/.test(mathSource(token))) throw new Error('TeX 구분자는 아직 한글 수식으로 변환할 수 없습니다.');
        if (token.type === 'code' && /^(mermaid|math|latex)$/i.test(token.lang || '')) throw new Error(`${token.lang} 변환은 아직 지원하지 않습니다. 저장을 중단했습니다.`);
        if (token.type === 'list_item' && token.task) throw new Error('체크 목록은 아직 지원하지 않습니다.');
        if (!['code','codespan'].includes(token.type) && typeof token.text === 'string' && !token.tokens && /\$|\\+[([]/.test(token.text)) {
            throw new Error('수식 또는 달러 기호를 포함한 본문은 아직 HWPX 변환을 지원하지 않습니다. 코드 안의 달러 기호는 보존됩니다.');
        }
        if (token.tokens) validateTokens(token.tokens, parser);
        if (token.items) validateTokens(token.items, parser);
        if (token.type === 'table') for (const cell of [...token.header, ...token.rows.flat()]) validateTokens(cell.tokens || parser.lexer.inlineTokens(cell.text), parser);
    }
}
function dataUrl(blob) { return new Promise((resolve,reject) => {const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);}); }
// TEXT is a CP949 compatibility export: e.g. • becomes literal "&#8226;".
// Compare Unicode to Unicode; decoding TEXT entities would corrupt a document
// that intentionally contains the literal characters "&#8226;".
function textOf(doc) { return JSON.parse(doc.getTextFileUnicode()).replace(/\s/g,''); }
function prepareHtml(root) {
    const headings=[];
    for (const hr of root.querySelectorAll('hr')) {const p=document.createElement('p');p.textContent='────────────────────';hr.replaceWith(p);}
    for (const element of root.querySelectorAll('*')) for (const attr of [...element.attributes]) {
        if (/^on/i.test(attr.name) || /url\s*\(|expression\s*\(|@import/i.test(attr.value)) throw new Error('안전하지 않은 HTML 속성입니다.');
    }
    for (const table of root.querySelectorAll('table')) table.style.cssText = 'border-collapse:collapse;width:100%;border:1px solid #000000';
    for (const table of root.querySelectorAll('table')) {
        const rows=[...table.rows],columns=Math.max(...rows.map(row=>row.cells.length));
        if(!rows.some(row=>[...row.cells].some(cell=>cell.colSpan>1))) {
            const weights=Array.from({length:columns},(_,col)=>Math.sqrt(Math.max(4,...rows.map(row=>(row.cells[col]?.textContent||'').replace(/MDPROEQ[a-f0-9]+X\d+END/g,'xx').length))));
            const total=weights.reduce((a,b)=>a+b,0);
            for(const row of rows)for(const [col,cell]of [...row.cells].entries())cell.style.width=(510.24*weights[col]/total).toFixed(2)+'pt';
        }
    }
    for (const cell of root.querySelectorAll('th,td')) { cell.style.border = '1px solid #000000'; if (cell.tagName === 'TH') cell.style.fontWeight = 'bold'; }
    for (const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        if(headings.length>=2000)throw new Error('제목은 한 문서당 2000개까지 지원합니다.');
        const p = document.createElement('p'), span = document.createElement('span');
        span.style.cssText = `font-size:${[24,20,17,15,13,12][Number(h.tagName[1])-1]}pt;font-weight:bold`;
        let marker='\uE010'+String.fromCharCode(0xe900+headings.length)+'\uE011';
        while(root.textContent.includes(marker))marker+='\uE012';
        headings.push({level:Number(h.tagName[1]),marker});
        span.innerHTML = h.innerHTML;span.prepend(document.createTextNode(marker));p.append(span);h.replaceWith(p);
    }
    // The engine HTML importer treats every <li> as a bullet. Preserve ordered
    // starts and nesting explicitly instead of silently changing all numbering.
    for (const list of [...root.querySelectorAll('ul,ol')].reverse()) {
        const depth = [...ancestors(list)].filter(e => /^(UL|OL)$/.test(e.tagName)).length;
        let number = Number(list.getAttribute('start') || 1);
        for (const li of [...list.children]) {
            const p = document.createElement('p');
            p.dataset.hwpListParagraph = 'true';
            p.style.marginLeft = (depth * 18) + 'pt';
            p.append(document.createTextNode(list.tagName === 'OL' ? `${number++}. ` : '• '));
            const rest = [];
            for (const child of [...li.childNodes]) {
                if (child.nodeType === 1 && child.dataset.hwpListParagraph) rest.push(child);
                else if (/^(P|DIV)$/.test(child.nodeName)) { while (child.firstChild) p.append(child.firstChild); }
                else p.append(child);
            }
            li.replaceWith(p, ...rest);
        }
        list.replaceWith(...list.childNodes);
    }
    for (const a of root.querySelectorAll('a')) {
        const text = document.createElement('span'); text.textContent = `${a.textContent} (${a.getAttribute('href')})`; a.replaceWith(text);
    }
    for (const quote of root.querySelectorAll('blockquote')) {
        const depth = 1 + [...ancestors(quote)].filter(e => e.tagName === 'BLOCKQUOTE').length;
        for (const p of quote.querySelectorAll('p')) p.style.marginLeft = (depth * 18) + 'pt';
    }
    for (const del of root.querySelectorAll('del')) {
        const span = document.createElement('span'); span.style.textDecoration = 'line-through'; span.innerHTML = del.innerHTML; del.replaceWith(span);
    }
    for (const pre of root.querySelectorAll('pre')) {
        const fragment = document.createDocumentFragment();
        for (const line of pre.textContent.replace(/\n$/, '').split('\n')) {
            const p = document.createElement('p'), span = document.createElement('span');
            span.style.fontFamily = 'Courier New'; span.textContent = line || '\u00a0'; p.append(span); fragment.append(p);
        }
        pre.replaceWith(fragment);
    }
    for (const code of root.querySelectorAll('code')) { const span = document.createElement('span'); span.style.fontFamily = 'Courier New'; span.textContent = code.textContent; code.replaceWith(span); }
    return headings;
}
function* ancestors(node) { while ((node = node.parentElement)) yield node; }
async function validatePackage(bytes, root) {
    if (!globalThis.JSZip) throw new Error('HWPX 구조 검사 모듈을 사용할 수 없습니다.');
    const zip = await globalThis.JSZip.loadAsync(bytes);
    for (const name of ['mimetype','Contents/content.hpf','Contents/header.xml','Contents/section0.xml']) {
        if (!zip.file(name)) throw new Error('HWPX 필수 항목 누락: '+name);
    }
    const xml = new DOMParser().parseFromString(await zip.file('Contents/section0.xml').async('string'), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('HWPX XML 구조 오류');
    for (const [htmlTag, nativeTag] of [['table','tbl'],['img','pic']]) {
        if (root.querySelectorAll(htmlTag).length !== xml.getElementsByTagNameNS('*', nativeTag).length) throw new Error(htmlTag+' 개체 수가 일치하지 않아 저장을 중단했습니다.');
    }
}
export async function createHwpx({content, parser = globalThis.marked, resolveImage, format = 'hwpx', signal, onProgress}) {
    if (busy) {const error=new Error('한글 문서를 내보내는 중입니다.');error.code='HWP_EXPORT_BUSY';throw error;}
    busy = true;
    const progress = label => {signal?.throwIfAborted();if(typeof onProgress==='function')onProgress(label);};
    const step = (task,label) => waitForExportStep(task,{signal,label});
    let doc, reopened, withEquations;
    try {
        if (!parser?.lexer || !parser?.parser) throw new Error('Markdown 파서를 사용할 수 없습니다.');
        if (content.length > 1024 * 1024) throw new Error('내보내기 본문은 1MB 이하만 지원합니다.');
        progress('표·수식을 준비하는 중…');
        const {text:protectedContent,equations} = await step(protectEquations(content.replace(/^\uFEFF/,'')),'표·수식 준비');
        const tokens = parser.lexer(protectedContent);
        validateTokens(tokens, parser);
        const root = document.createElement('div');
        // Detached DOM only; no generated markup is inserted into the live document.
        root.innerHTML = parser.parser(tokens);
        if (root.querySelector('script,style,iframe,object,embed,svg,math')) throw new Error('지원하지 않는 HTML 개체입니다.');
        const headings=prepareHtml(root);
        const images=[...root.querySelectorAll('img')];
        for (const [index,image] of images.entries()) {
            progress(`이미지 ${index+1}/${images.length} 읽는 중…`);
            const source = image.getAttribute('src');
            const internal = resolveImage ? await step(resolveImage(source),'내부 이미지 읽기') : null;
            let blob = internal?.blob;
            if (!blob) {
                const url = new URL(source, document.baseURI);
                if (!['data:','blob:','http:','https:'].includes(url.protocol)) throw new Error('이미지 주소를 읽을 수 없습니다: ' + source);
                const response = await step(fetch(url, {signal:AbortSignal.timeout(15000), credentials:'omit'}),'이미지 다운로드');
                if (!response.ok) throw new Error('이미지 읽기 실패: ' + source);
                blob = await step(response.blob(),'이미지 데이터 읽기');
            }
            if (!['image/png','image/jpeg','image/gif','image/bmp'].includes(blob.type) || blob.size > 16 * 1024 * 1024) throw new Error('이미지는 16MB 이하 PNG/JPEG/GIF/BMP만 지원합니다.');
            image.src = await step(dataUrl(blob),'이미지 변환');
            const decoded = new Image(); decoded.src = image.src; await step(decoded.decode(),'이미지 디코딩');
            const scale = Math.min(1, 680 / decoded.naturalWidth, 980 / decoded.naturalHeight);
            const width = Math.max(1, Math.round(decoded.naturalWidth * scale));
            image.setAttribute('width', String(width));
            image.setAttribute('height', String(Math.max(1, Math.round(decoded.naturalHeight * width / decoded.naturalWidth))));
        }
        progress('한글 문서를 만드는 중…');
        const core = await step(loadCore(),'한글 엔진 로딩');
        doc = core.HwpDocument.createEmpty();
        doc.createBlankDocument();
        const page = JSON.parse(doc.getPageDef(0));
        Object.assign(page, {width:59528,height:84189,marginLeft:4252,marginRight:4252,marginTop:4252,marginBottom:4252});
        doc.setPageDef(0, JSON.stringify(page));
        if (content.trim() && !JSON.parse(doc.pasteHtml(0, 0, 0, root.innerHTML)).ok) throw new Error('문서 가져오기에 실패했습니다.');
        const expected = root.textContent.replace(/\s/g,'');
        const actual = textOf(doc);
        // Detect importer omissions before serializer loss reporting (which only
        // diagnoses loss of objects already present in the native document).
        if (expected !== actual) throw new Error('본문 변환 중 누락 또는 중복이 감지되어 저장을 중단했습니다.');
        let hwpx = serialize(doc, 'hwpx');
        await step(validatePackage(hwpx, root),'문서 구조 검사');
        hwpx=await step(applyHeadingStyles(hwpx,headings),'제목 스타일 적용');
        if (equations.length) {
            progress(`수식 ${equations.length}개를 배치하는 중…`);
            hwpx = await step(embedEquations(hwpx,equations,core),'네이티브 수식 배치');
        }
        if(equations.length||headings.length){
            withEquations = new core.HwpDocument(hwpx);
            withEquations.reflowLinesegs();
            hwpx = serialize(withEquations,'hwpx');
            const scripts = await step(equationScripts(hwpx),'수식 보존 검사');
            if (scripts.length !== equations.length || scripts.some((script,i)=>script !== equations[i].script)) throw new Error('수식 개체 또는 순서 보존 검사 실패');
            await step(validatePackage(hwpx,root),'문서 구조 검사');
        }
        const finalDoc = withEquations || doc;
        const finalText = textOf(finalDoc);
        const expectedBody = [...equations,...headings].reduce((body,eq) => body.split(eq.marker).join(''), expected);
        if (finalText !== expectedBody) throw new Error('수식 배치 후 본문 누락 또는 중복이 감지되었습니다.');
        progress('저장 파일을 검증하는 중…');
        const bytes = format === 'hwpx' ? hwpx : serialize(finalDoc, format);
        reopened = new core.HwpDocument(bytes);
        if (!reopened.pageCount()) throw new Error('생성 파일 재열기 실패');
        if (textOf(reopened) !== finalText) throw new Error('생성 파일 재열기 내용이 일치하지 않습니다.');
        await step(validateHeadingStyles(format==='hwp'?serialize(reopened,'hwpx'):bytes,headings),'제목 스타일 보존 검사');
        if (equations.length && format === 'hwp') {
            const scripts = await step(equationScripts(serialize(reopened,'hwpx')),'HWP 수식 검사');
            if (scripts.length !== equations.length || scripts.some((script,i)=>script !== equations[i].script)) throw new Error('HWP 수식 왕복 검사 실패');
        }
        progress('다운로드 준비 완료');
        return new Blob([bytes], {type:format === 'hwp' ? 'application/x-hwp' : 'application/hwp+zip'});
    } finally {
        try {
            for(const native of [reopened,withEquations,doc]) {try {native?.free();} catch (_) { /* Continue freeing the remaining handles. */ }}
        } finally {busy=false;}
    }
}

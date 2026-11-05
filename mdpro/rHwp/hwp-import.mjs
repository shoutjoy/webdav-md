import {loadCore, checkInput, MAX_FILE_BYTES} from './rhwp-loader.mjs';

const children = (node, name) => Array.from(node.children || []).filter(n => !name || n.localName === name);
const descendants = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
const first = (node, name) => descendants(node, name)[0];
const attr = (node, name, fallback = '') => node?.getAttribute(name) || fallback;
// Native document text is literal, even inside the app's Markdown preprocessing.
// Encode punctuation in text only; attributes (including asset URLs) stay intact.
function literalHtml(html) {
    return html.replace(/(<[^>]*>)|([^<]+)/g,(all,tag,text)=>tag||text.replace(/[\\`*_~$()\[\]]/g,c=>'&#'+c.codePointAt(0)+';'));
}
function xml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('한글 문서 XML을 읽을 수 없습니다.');
    return doc;
}

// Build a fresh HTML tree; never copy XML attributes, URLs or markup into HTML.
// This is a content import, not a reproduction of fixed paper coordinates.
export async function convertHwpToHtml(file, {JSZip,storeImage,onProgress}) {
    if (file.size > MAX_FILE_BYTES) throw new Error('256MB 이하 파일만 열 수 있습니다.');
    const progress=phase=>{if(typeof onProgress==='function')onProgress(phase);};
    progress('한글 문서 구조를 읽는 중…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkInput(bytes, file.name);
    const core = await loadCore();
    const native = new core.HwpDocument(bytes);
    const warnings = new Set();
    let exported;
    try {
        let zipBytes = bytes;
        if (/\.hwp$/i.test(file.name)) {
            exported = native.exportHwpxWithReport();
            const report = JSON.parse(exported.contentLoss());
            if (report.count) warnings.add('일부 원본 개체는 엔진 변환에서 지원되지 않습니다 (' + report.count + '건)');
            zipBytes = exported.takeBytes();
            checkInput(zipBytes, 'converted.hwpx');
        }
        const zip = await JSZip.loadAsync(zipBytes);
        const read = async name => {
            const entry = zip.file(name);
            if (!entry) throw new Error('문서 구성 요소가 없습니다: ' + name);
            return xml(await entry.async('string'));
        };
        const header = await read('Contents/header.xml');
        const manifest = await read('Contents/content.hpf');
        const charStyles = new Map(descendants(header, 'charPr').map(n => [attr(n, 'id'), n]));
        const paraStyles = new Map(descendants(header, 'paraPr').map(n => [attr(n, 'id'), n]));
        const namedStyles = new Map(descendants(header,'style').map(n=>[attr(n,'id'),n]));
        const items = new Map(descendants(manifest, 'item').map(n => [attr(n, 'id'), n]));
        const body = document.implementation.createHTMLDocument('').body;
        const assets=new Map();
        async function sourceFor(key,createBlob,fallback){
            if(!assets.has(key))assets.set(key,(async()=>{
                if(!storeImage)return fallback();
                const blob=await createBlob();
                let url;
                try{url=await storeImage(blob,{name:key,mime:blob.type});}
                catch(error){const failed=new Error('한글 이미지 저장에 실패했습니다: '+(error.message||error));failed.name='HwpAssetStorageError';throw failed;}
                if(!/^internal:\/\//.test(url||'')){const error=new Error('내부 이미지 저장 결과가 올바르지 않습니다.');error.name='HwpAssetStorageError';throw error;}
                return url;
            })());
            return assets.get(key);
        }
        function reserveImageSize(img,width,height){
            if(width>0&&height>0){img.width=Math.max(1,Math.round(width));img.height=Math.max(1,Math.round(height));img.style.aspectRatio=width+' / '+height;}
        }
        const make = tag => body.ownerDocument.createElement(tag);
        const notice = text => {
            warnings.add(text);
            const span = make('span'); span.dataset.hwpImportWarning = 'true'; span.textContent = '[' + text + ']'; return span;
        };
        async function walk(node, depth = 0) {
            if (depth > 100) throw new Error('문서 중첩 깊이 제한을 넘었습니다.');
            const frag = body.ownerDocument.createDocumentFragment();
            for (const child of children(node)) {
                const name = child.localName;
                if (name === 'p') {
                    // Tables and other blocks cannot be nested in HTML paragraphs.
                    const named=namedStyles.get(attr(child,'styleIDRef'));
                    const heading=/^Outline ([1-6])$/.exec(attr(named,'engName'));
                    const div = make(heading?'h'+heading[1]:'div'); div.style.marginBottom = '.6em';
                    if(heading){div.style.fontSize='1em';div.style.fontWeight='normal';}
                    const style = paraStyles.get(attr(child, 'paraPrIDRef'));
                    const alignment = style && attr(first(style, 'align'), 'horizontal').toLowerCase();
                    if (['left','center','right','justify'].includes(alignment)) div.style.textAlign = alignment;
                    div.append(await walk(child, depth+1));
                    if (!div.hasChildNodes()) div.append(make('br'));
                    frag.append(div);
                } else if (name === 'run') {
                    const span = make('span');
                    const style = charStyles.get(attr(child, 'charPrIDRef'));
                    if (style) {
                        if (first(style, 'bold')) span.style.fontWeight = 'bold';
                        if (first(style, 'italic')) span.style.fontStyle = 'italic';
                        const size = Number(attr(style, 'height')) / 1000;
                        if (size > 0) span.style.fontSize = Math.min(3, Math.max(.7, size)) + 'em';
                        if (attr(first(style, 'underline'), 'type', 'NONE') !== 'NONE') span.style.textDecoration = 'underline';
                    }
                    span.append(await walk(child, depth+1)); frag.append(span);
                } else if (name === 't') {
                    // Mixed text and explicit line/tab nodes retain their original order.
                    for (const part of child.childNodes) {
                        if (part.nodeType === 3) frag.append(body.ownerDocument.createTextNode(part.textContent));
                        else if (part.localName === 'lineBreak') frag.append(make('br'));
                        else if (part.localName === 'tab') frag.append(body.ownerDocument.createTextNode('\t'));
                        else if (part.localName === 'nbSpace') frag.append(body.ownerDocument.createTextNode('\u00a0'));
                        else frag.append(body.ownerDocument.createTextNode(part.textContent || ''));
                    }
                } else if (name === 'tbl') {
                    const table = make('table'); table.style.width = '100%'; table.style.borderCollapse = 'collapse';
                    const tbody = make('tbody'); table.append(tbody);
                    for (const row of children(child, 'tr')) {
                        const tr = make('tr'); tbody.append(tr);
                        for (const cell of children(row, 'tc')) {
                            const td = make(attr(cell, 'header') === '1' ? 'th' : 'td');
                            const span = first(cell, 'cellSpan');
                            td.colSpan = Math.min(1000, Math.max(1, Number(attr(span, 'colSpan', '1')) || 1));
                            td.rowSpan = Math.min(1000, Math.max(1, Number(attr(span, 'rowSpan', '1')) || 1));
                            td.style.border = '1px solid #94a3b8'; td.style.padding = '.4em'; td.style.verticalAlign = 'top';
                            const list = children(cell, 'subList')[0];
                            if (list) td.append(await walk(list, depth+1));
                            tr.append(td);
                        }
                    }
                    frag.append(table);
                } else if (name === 'pic') {
                    const image = first(child, 'img');
                    const item = items.get(attr(image, 'binaryItemIDRef'));
                    const href = attr(item, 'href').replace(/^\.\//, '');
                    const entry = zip.file(href) || zip.file('Contents/' + href);
                    const mime = attr(item, 'media-type');
                    if (entry && /^image\/(png|jpeg|jpg|gif|webp|bmp)$/i.test(mime)) {
                        const img = make('img'); img.alt = first(child, 'shapeComment')?.textContent || '문서 이미지';
                        img.src = await sourceFor('picture:'+href,async()=>new Blob([await entry.async('uint8array')],{type:mime}),async()=>'data:'+mime+';base64,'+await entry.async('base64'));
                        img.style.maxWidth = '100%'; img.style.height = 'auto';
                        const size=first(child,'sz');reserveImageSize(img,Number(attr(size,'width'))*native.getDpi()/7200,Number(attr(size,'height'))*native.getDpi()/7200);
                        frag.append(img);
                    } else frag.append(notice('표시할 수 없는 원본 이미지'));
                } else if (name === 'equation') {
                    const script = first(child, 'script')?.textContent || '';
                    try {
                        const svg = native.renderEquationPreview(script, Number(attr(child, 'baseUnit', '1000')), 0);
                        if (!svg.includes('<svg')) throw new Error('empty');
                        const img = make('img'); img.alt = '한글 수식: ' + script;
                        img.src = await sourceFor('equation:'+attr(child,'baseUnit','1000')+':'+script,async()=>new Blob([svg],{type:'image/svg+xml'}),async()=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
                        img.style.cssText = 'max-width:100%;height:auto;vertical-align:middle;background:white;';
                        const svgRoot=xml(svg).documentElement;reserveImageSize(img,parseFloat(attr(svgRoot,'width')),parseFloat(attr(svgRoot,'height')));
                        frag.append(img);
                    } catch (error) {if(error.name==='HwpAssetStorageError')throw error;frag.append(notice('한글 수식: ' + script));}
                } else if (['subList','ctrl','header','footer','footNote','endNote','textBox','drawText'].includes(name)) {
                    frag.append(await walk(child, depth+1));
                } else if (['rect','ellipse','container','polygon','line','arc','curve','ole','chart','video'].includes(name)) {
                    const lists = descendants(child, 'subList').filter(n => {
                        let parent = n.parentElement;
                        while (parent && parent !== child) { if (parent.localName === 'subList') return false; parent = parent.parentElement; }
                        return true;
                    });
                    for (const list of lists) frag.append(await walk(list, depth+1));
                    frag.append(notice('원본 도형/개체 모양 미지원: ' + name));
                } else if (name === 'lineBreak') frag.append(make('br'));
                // Layout metadata is intentionally not converted to fixed page boxes.
            }
            return frag;
        }
        const sections = Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/.test(n))
            .sort((a,b) => Number(a.match(/section(\d+)/)[1]) - Number(b.match(/section(\d+)/)[1]));
        if (!sections.length) throw new Error('본문 구역이 없습니다.');
        const pages=[];
        for (const [sectionIndex,name]of sections.entries()) {
            progress(`A4 편집 내용 변환 중… (${sectionIndex+1}/${sections.length}구역)`);
            const definition=JSON.parse(native.getPageDef(sectionIndex));
            const direction=definition.landscape||definition.width>definition.height?'landscape':'portrait';
            const root=(await read(name)).documentElement;
            let page=make('div');
            const flush=()=>{if(!page.hasChildNodes())return;pages.push({direction,html:literalHtml(page.innerHTML),sectionIndex});body.append(...page.childNodes);page=make('div');};
            for(const child of children(root)){
                if(child.localName==='p'&&/^(1|true)$/i.test(attr(child,'pageBreak')))flush();
                page.append(await walk({children:[child]}));
                if(page.childNodes.length%32===0)await new Promise(resolve=>setTimeout(resolve,0));
            }
            flush();
        }
        if (!body.hasChildNodes()) body.append(make('p'));
        if(!pages.length)pages.push({direction:'portrait',html:literalHtml(body.innerHTML),sectionIndex:0});
        return {html: literalHtml(body.innerHTML),pages,originalPageCount:native.pageCount(),warnings: Array.from(warnings)};
    } finally {
        exported?.free(); native.free();
    }
}

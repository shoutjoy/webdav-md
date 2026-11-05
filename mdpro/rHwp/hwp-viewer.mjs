import {loadCore, checkInput, serialize, MAX_FILE_BYTES} from './rhwp-loader.mjs';
import {HwpReader} from './hwp-reader.mjs';
let doc, file, handle, page = 0, revision = 0, imageUrl;
let reader,pendingReader,readerPages=0,pageRevision=0;
let dirty = false, originalText = '', selected;
const hostWindow = window.parent !== window ? window.parent : window.opener;
const $ = id => document.getElementById(id);
const originalMode=new URLSearchParams(location.search).get('mode')==='original';
if(originalMode){
    $('text-editor').hidden=true;$('text-editor').style.display='none';
    document.querySelector('.notice').textContent='원본 페이지 보기 · 원래 용지 크기·방향·쪽 구분을 표시합니다. 현재 Markdown과 원본 파일은 변경하지 않습니다. 글꼴 대체·엔진 미지원 개체는 한글 원본과 다르게 보일 수 있습니다.';
}
function status(value) { $('status').textContent = value; }
function clearDoc() {reader?.close();reader=null;pendingReader?.close();pendingReader=null;readerPages=0;if (doc) doc.free(); doc = null; if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; }
function totalPages(){return reader?readerPages:doc?.pageCount()||0;}
async function render(target = page) {
    if (!doc&&!reader) return;
    const current=++pageRevision;
    target=Math.min(totalPages()-1,Math.max(0,target));
    if(reader){
        status(`${file.name} · ${target+1}쪽을 그리는 중…`);
        try{const result=await reader.page(target);if(current===pageRevision)showPage(result);}catch(error){if(current===pageRevision)status('페이지 표시 실패: '+(error.message||error));}
        return;
    }
    showPage({page:target,pages:doc.pageCount(),info:JSON.parse(doc.getPageInfo(target)),dpi:doc.getDpi(),svg:doc.renderPageSvg(target)});
}
function showPage({page:target,pages,info,dpi,svg}){
    page=target;
    // SVG is decoded as an image: scripts, event handlers and external resources
    // cannot execute or fetch as they could in inline SVG/HTML.
    if (!svg.includes('<svg')) throw new Error('페이지 SVG 생성 실패');
    const next = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
    $('sheet').src = next;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = next;
    $('sheet').style.width = $('zoom').value === 'fit' ? '100%' : `${100 * Number($('zoom').value)}%`;
    $('page').value = page + 1;
    $('count').textContent = '/ ' + pages;
    $('page').max = pages;
    const direction=info.width>info.height?'가로':'세로';
    const mm=[info.width,info.height].map(value=>Math.round(value/dpi*25.4));
    const a4=mm.slice().sort((a,b)=>a-b).every((value,index)=>Math.abs(value-[210,297][index])<=2);
    status(file.name + ' · ' + (page + 1) + '/' + pages + '쪽 · '+(a4?'A4':mm.join('×')+'mm')+' '+direction+' · '+(originalMode?'원본 페이지 보기':'본문 편집') + (dirty ? ' · 수정됨' : ''));
}
async function open(nextFile, nextHandle) {
    const rev = ++revision;
    ++pageRevision;
    pendingReader?.close();pendingReader=null;
    if(originalMode){
        const started=Date.now();let candidate,phase='문서를 준비하는 중…';
        const paint=()=>status(phase+' ('+Math.floor((Date.now()-started)/1000)+'초)');
        const timer=setInterval(paint,1000);paint();
        try{
            candidate=new HwpReader();pendingReader=candidate;
            const first=await candidate.open(nextFile,value=>{phase=value;paint();});
            if(rev!==revision)return;
            pendingReader=null;clearDoc();reader=candidate;candidate=null;readerPages=first.pages;
            file=nextFile;handle=nextHandle;dirty=false;document.title=file.name+' — 한글 원본 보기';showPage(first);
        }catch(error){if(rev===revision&&error.name!=='AbortError')status('열기 실패: '+(error.message||error));}
        finally{clearInterval(timer);if(pendingReader===candidate)pendingReader=null;candidate?.close();}
        return;
    }
    let candidate;
    try {
        status('한글 문서를 분석하는 중…');
        if (nextFile.size > MAX_FILE_BYTES) throw new Error('256MB 이하 파일만 열 수 있습니다.');
        const bytes = new Uint8Array(await nextFile.arrayBuffer());
        checkInput(bytes, nextFile.name);
        const core = await loadCore();
        if (rev !== revision) return;
        candidate = new core.HwpDocument(bytes);
        const count = candidate.pageCount();
        if (count < 1 || count > 5000) throw new Error('표시 가능한 페이지 수(1~5000)를 벗어났습니다.');
        candidate.renderPageSvg(0);
        if (rev !== revision) return;
        clearDoc(); doc = candidate; candidate = null; file = nextFile; handle = nextHandle;
        document.title = nextFile.name + ' — 한글 원본 보기';
        dirty = false;if(!originalMode)loadParagraphs();render(0);
    } catch (error) { status('열기 실패: ' + String(error.message || error) + ' (암호·DRM·손상 파일은 지원되지 않을 수 있습니다.)'); }
    finally { if (candidate) candidate.free(); }
}
$('first').onclick = () => render(0);
$('last').onclick = () => render(totalPages()-1);
$('prev').onclick = () => render(page-1);
$('next').onclick = () => render(page+1);
$('page').onchange = () => render(Number($('page').value)-1);
$('zoom').onchange = () => {$('sheet').style.width=$('zoom').value==='fit'?'100%':`${100*Number($('zoom').value)}%`;};
$('close').onclick = () => {
    if (window.parent !== window) { hostWindow.postMessage({type:'mdpro-hwp-close'}, location.origin); }
    else window.close();
};
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); $('close').click(); }
});
$('reload').onclick = async () => { if (!window.requestHwpClose()) return; if (file) { try { await open(handle ? await handle.getFile() : file, handle); } catch(e) {status('다시 읽기 실패: '+e.message);} } };
for (const format of ['hwp','hwpx']) $(format).onclick = async () => {
    if (!doc&&!reader) return;
    const rev=revision;
    try {
        if (!reader&&!applyText()) return;
        const bytes = reader?await reader.export(format):serialize(doc, format);
        if(rev!==revision)return;
        const url = URL.createObjectURL(new Blob([bytes], {type:format === 'hwpx' ? 'application/hwp+zip' : 'application/x-hwp'}));
        const link = document.createElement('a'); link.href = url; link.download = file.name.replace(/\.(hwp|hwpx)$/i,'') + (originalMode?'-사본.':'-수정본.') + format; link.click();
        status('저장 파일 다운로드 요청: ' + link.download);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch(e) { status('내보내기 실패: ' + (e.message || e)); }
};
window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== hostWindow || event.data?.type !== 'mdpro-hwp-open') return;
    open(event.data.file, event.data.handle);
});
function dispose() { ++revision;++pageRevision;clearDoc(); }
window.addEventListener('pagehide', dispose);
window.addEventListener('beforeunload', event => { if (hasChanges()) { event.preventDefault(); event.returnValue = ''; } });
hostWindow?.postMessage({type:'mdpro-hwp-ready'}, location.origin);

function hasChanges() { return dirty || $('text').value !== originalText; }
window.requestHwpClose = () => !hasChanges() || window.confirm('저장하지 않은 한글 문서 수정이 있습니다. 닫거나 다시 읽으면 사라집니다. 계속할까요?');
function loadParagraphs(keep = 0) {
    const select = $('paragraph'); select.replaceChildren();
    for (let section = 0; section < doc.getSectionCount(); section++) {
        for (let para = 0; para < doc.getParagraphCount(section); para++) {
            const text = doc.getTextRange(section, para, 0, doc.getParagraphLength(section, para));
            const controls = JSON.parse(doc.getControlTextPositions(section, para));
            // Control-bearing paragraphs keep their native object/text coordinates.
            if (controls.length || /[\x00-\x08\x0b-\x1f]/.test(text)) continue;
            const option = document.createElement('option');
            option.value = JSON.stringify([section, para]);
            option.textContent = `${section+1}구역 ${para+1}문단: ${text.slice(0,55) || '(빈 문단)'}`;
            select.append(option);
        }
    }
    select.selectedIndex = Math.min(keep, select.options.length-1);
    selectParagraph();
}
function selectParagraph() {
    selected = $('paragraph').value ? JSON.parse($('paragraph').value) : null;
    originalText = selected ? doc.getTextRange(...selected, 0, doc.getParagraphLength(...selected)) : '';
    $('text').value = originalText;
    $('text').disabled = !selected; $('apply').disabled = !selected;
    $('edit-state').textContent = selected ? (dirty ? '수정됨 · 사본 저장 필요' : '') : '편집 가능한 일반 본문 문단이 없습니다.';
}
function applyText() {
    if (!selected || $('text').value === originalText) return true;
    if (/[\r\n\x00-\x08\x0b-\x1f]/.test($('text').value)) { status('문단 안의 텍스트만 수정할 수 있습니다. 줄바꿈은 제거해주세요.'); return false; }
    try {
        const value = $('text').value;
        // Mutate a native clone first so a failed edit cannot damage the session.
        const coreBytes = serialize(doc, 'hwpx');
        const candidate = new doc.constructor(coreBytes);
        try {
            candidate.replaceText(...selected, 0, Array.from(originalText).length, value);
            if (candidate.getTextRange(...selected, 0, candidate.getParagraphLength(...selected)) !== value) throw new Error('텍스트 반영 확인 실패');
            candidate.renderPageSvg(page < candidate.pageCount() ? page : 0);
        } catch (error) { candidate.free(); throw error; }
        doc.free(); doc = candidate; dirty = true;
        const index = $('paragraph').selectedIndex;
        loadParagraphs(index); render(JSON.parse(doc.getPageOfPosition(...selected)).page); return true;
    } catch (error) { status('수정 실패: ' + (error.message || error)); return false; }
}
$('apply').onclick = applyText;
let previousParagraph = '';
$('paragraph').addEventListener('focus', () => { previousParagraph = selected ? JSON.stringify(selected) : ''; });
$('paragraph').onchange = () => {
    if ($('text').value !== originalText && !confirm('적용하지 않은 문단 수정을 버릴까요?')) { $('paragraph').value = previousParagraph; return; }
    selectParagraph(); previousParagraph = $('paragraph').value;
};
$('text').oninput = () => { $('edit-state').textContent = '적용 대기 · 저장 시 자동 적용'; };

const HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
const HH='http://www.hancom.co.kr/hwpml/2011/head';
function parse(source){const xml=new DOMParser().parseFromString(source,'application/xml');if(xml.querySelector('parsererror'))throw new Error('제목 스타일 XML 오류');return xml;}
export async function applyHeadingStyles(bytes,headings){
    if(!headings.length)return bytes;
    const zip=await JSZip.loadAsync(bytes);
    const header=parse(await zip.file('Contents/header.xml').async('string'));
    const section=parse(await zip.file('Contents/section0.xml').async('string'));
    const styles=header.getElementsByTagNameNS(HH,'styles')[0];
    const properties=header.getElementsByTagNameNS(HH,'paraProperties')[0];
    if(!styles||styles.children.length<8)throw new Error('기본 한글 개요 스타일이 없는 템플릿입니다.');
    const levels=new Map();
    for(const heading of headings){
        const texts=[...section.getElementsByTagNameNS(HP,'t')].filter(t=>t.textContent.includes(heading.marker));
        if(texts.length!==1)throw new Error('제목 위치 누락 또는 중복');
        const text=texts[0],run=text.parentElement,p=run.parentElement;
        if(p.localName!=='p')throw new Error('제목 문단 구조 오류');
        text.textContent=text.textContent.replace(heading.marker,'');
        let style=levels.get(heading.level);
        if(!style){
            const id=heading.level+1;
            style=[...styles.children].find(style=>style.getAttribute('id')===String(id));
            if(!style)throw new Error('한글 스타일 순서 참조 오류');
            const base=[...properties.children].find(pr=>pr.getAttribute('id')===p.getAttribute('paraPrIDRef'));
            if(!base)throw new Error('제목 문단 서식 참조 오류');
            const pr=base.cloneNode(true);pr.setAttribute('id',String(properties.children.length));
            const numbering=pr.getElementsByTagNameNS(HH,'heading')[0];
            if(numbering){numbering.setAttribute('type','NONE');numbering.setAttribute('level',String(heading.level-1));}
            const breaks=pr.getElementsByTagNameNS(HH,'breakSetting')[0];
            if(breaks)breaks.setAttribute('keepWithNext','1');
            properties.append(pr);
            style.setAttribute('name','개요 '+heading.level);
            style.setAttribute('engName','Outline '+heading.level);
            style.setAttribute('type','PARA');
            style.setAttribute('paraPrIDRef',pr.getAttribute('id'));
            style.setAttribute('charPrIDRef',run.getAttribute('charPrIDRef'));
            style.setAttribute('nextStyleIDRef','1');
            levels.set(heading.level,style);
        }
        p.setAttribute('styleIDRef',style.getAttribute('id'));
        p.setAttribute('paraPrIDRef',style.getAttribute('paraPrIDRef'));
        for(const child of [...p.children].filter(e=>e.localName==='run'))child.setAttribute('charPrIDRef',style.getAttribute('charPrIDRef'));
    }
    properties.setAttribute('itemCnt',String(properties.children.length));
    zip.file('Contents/header.xml',new XMLSerializer().serializeToString(header));
    zip.file('Contents/section0.xml',new XMLSerializer().serializeToString(section));
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function validateHeadingStyles(bytes,headings){
    if(!headings.length)return;
    const zip=await JSZip.loadAsync(bytes);
    const header=parse(await zip.file('Contents/header.xml').async('string'));
    const section=parse(await zip.file('Contents/section0.xml').async('string'));
    const actual=[...section.getElementsByTagNameNS(HP,'p')].map(p=>Number(p.getAttribute('styleIDRef'))).filter(id=>id>=2&&id<=7);
    if(actual.length!==headings.length||actual.some((id,index)=>id!==headings[index].level+1))throw new Error('제목 스타일 단계 또는 순서 보존 검사 실패');
    const styles=[...header.getElementsByTagNameNS(HH,'style')];
    for(const level of new Set(headings.map(h=>h.level))){
        const style=styles.find(s=>s.getAttribute('id')===String(level+1));
        if(!style||style.getAttribute('name')!=='개요 '+level)throw new Error('한글 개요 스타일 정의 보존 검사 실패');
    }
}

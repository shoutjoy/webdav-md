import {loadCore,checkInput,serialize,MAX_FILE_BYTES} from './rhwp-loader.mjs';
let doc;
let queue=Promise.resolve();
self.onmessage=event=>{queue=queue.then(()=>run(event.data)).catch(()=>{});};
async function run({id,action,file,page,format}){
    const progress=phase=>self.postMessage({id,type:'progress',phase});
    try{
        if(action==='open'){
            if(file.size>MAX_FILE_BYTES)throw new Error('한글 파일은 256MB 이하만 열 수 있습니다.');
            progress('파일을 읽는 중…');
            const bytes=new Uint8Array(await file.arrayBuffer());checkInput(bytes,file.name);
            progress('한글 엔진을 준비하는 중…');const core=await loadCore();
            progress('문서 구조와 페이지를 분석하는 중…');
            let candidate;
            try{
                candidate=new core.HwpDocument(bytes);
                if(candidate.pageCount()<1||candidate.pageCount()>50000)throw new Error('표시할 수 있는 페이지 수(1~50000)를 벗어났습니다.');
                progress('첫 페이지를 그리는 중…');
                const result=readPage(candidate,0);
                doc?.free();doc=candidate;candidate=null;
                self.postMessage({id,type:'result',result});
            }finally{candidate?.free();}
        }else if(action==='page'){
            if(!doc)throw new Error('열린 한글 문서가 없습니다.');
            self.postMessage({id,type:'result',result:readPage(doc,page)});
        }else if(action==='export'){
            if(!doc)throw new Error('열린 한글 문서가 없습니다.');
            const bytes=serialize(doc,format);
            self.postMessage({id,type:'result',result:bytes},[bytes.buffer]);
        }
    }catch(error){self.postMessage({id,type:'error',error:String(error?.message||error)});}
}
function readPage(document,page){
    page=Math.max(0,Math.min(document.pageCount()-1,Number(page)||0));
    return {page,pages:document.pageCount(),info:JSON.parse(document.getPageInfo(page)),dpi:document.getDpi(),svg:document.renderPageSvg(page)};
}

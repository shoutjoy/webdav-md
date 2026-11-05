export function chooseHwpView(file){
    return new Promise(resolve=>{
        const overlay=document.createElement('div');
        overlay.dataset.hwpOpenChoice='true';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','한글 문서 열기 방식');
        overlay.style.cssText='position:fixed;inset:0;z-index:100001;background:#0009;display:grid;place-items:center;padding:20px';
        const card=document.createElement('div');card.style.cssText='background:#0f172a;color:white;border:1px solid #64748b;border-radius:10px;padding:22px;max-width:520px';
        const title=document.createElement('h3');title.textContent='한글 문서 열기 방식';
        const desc=document.createElement('p');desc.textContent='쪽수·그림이 많은 문서는 원본 페이지 보기가 빠릅니다. 원본 보기는 원래 용지·쪽 구분을 표시합니다. A4 편집은 텍스트·표를 편집하고 수식은 표시용 그림으로 가져옵니다. 내용이 A4에 재배치되므로 원본과 쪽수가 달라질 수 있습니다.';
        card.append(title,desc);
        const previous=document.activeElement;
        function done(value){document.removeEventListener('keydown',escape);overlay.remove();previous?.focus();resolve(value);}
        function escape(event){if(event.key==='Escape'){event.preventDefault();done('cancel');}}
        for(const [value,label]of [['original','원본 페이지 보기'],['a4','A4 편집 보기'],['cancel','취소']]){
            const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.hwpOpenMode=value;
            button.style.cssText='margin:8px 8px 0 0;padding:10px;background:#334155;color:white;border:1px solid #64748b;border-radius:6px';button.onclick=()=>done(value);card.append(button);
        }
        overlay.onclick=event=>{if(event.target===overlay)done('cancel');};document.addEventListener('keydown',escape);overlay.append(card);document.body.append(overlay);card.querySelector('button').focus();
    });
}
export function openOriginalHwp(file,{localFileHandle}={}){
    document.querySelector('[data-hwp-original-host]')?.dispatchEvent(new Event('mdpro-close'));
    const previous=document.activeElement,host=document.createElement('div'),frame=document.createElement('iframe'),closeButton=document.createElement('button');
    host.dataset.hwpOriginalHost='true';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','한글 원본 페이지 보기');
    host.style.cssText='position:fixed;inset:12px;z-index:100000;display:flex;flex-direction:column;background:#0f172a;border:1px solid #64748b;box-shadow:0 0 0 12px #0009';
    frame.title='한글 원본 페이지';frame.style.cssText='width:100%;flex:1;min-height:0;border:0';
    closeButton.type='button';closeButton.textContent='원본 보기 닫기';closeButton.style.cssText='align-self:flex-end;padding:6px 12px;background:#334155;color:white';
    const url=new URL('./hwp-viewer.html?mode=original&v=20261104-large-1',import.meta.url);
    function close(){clearTimeout(timer);window.removeEventListener('message',message);document.removeEventListener('keydown',escape);try{frame.contentWindow.dispatchEvent(new Event('pagehide'));}catch(_){}host.remove();if(previous?.isConnected)previous.focus();}
    function escape(event){if(event.key==='Escape'){event.preventDefault();close();}}
    function message(event){
        if(event.origin!==url.origin||event.source!==frame.contentWindow)return;
        if(event.data?.type==='mdpro-hwp-close'){close();return;}
        if(event.data?.type!=='mdpro-hwp-ready')return;
        clearTimeout(timer);
        try{frame.contentWindow.postMessage({type:'mdpro-hwp-open',file,handle:localFileHandle||null},url.origin);}
        catch(_){frame.contentWindow.postMessage({type:'mdpro-hwp-open',file},url.origin);}
    }
    const timer=setTimeout(()=>{closeButton.textContent='문서 구성 요소를 불러오지 못했습니다 · 닫기';},30000);
    window.addEventListener('message',message);document.addEventListener('keydown',escape);host.addEventListener('mdpro-close',close);closeButton.onclick=close;
    host.append(closeButton,frame);frame.src=url.href;document.body.append(host);closeButton.focus();return true;
}

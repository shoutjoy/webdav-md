/* Cross-diagram text/callout additions, stored with custom2 without changing graph data. */
(function(root){
    'use strict';const NS='http://www.w3.org/2000/svg';
    function clean(value){
        if(!Array.isArray(value)||value.length>100)throw Error('추가 내용은 100개까지 만들 수 있습니다.');
        let total=0;const ids=new Set();return value.map(v=>{
            if(!v||typeof v.id!=='string'||!/^[\w-]{1,80}$/.test(v.id)||ids.has(v.id)||typeof v.text!=='string'||!v.text.trim()||v.text.length>4000||!['text','note','title','caption'].includes(v.kind))throw Error('추가 내용 형식을 확인하세요.');ids.add(v.id);
            if((total+=v.text.length)>20000)throw Error('추가 내용은 합계 20000자까지 입력할 수 있습니다.');
            for(const [key,min,max]of [['x',-10000,10000],['y',-10000,10000],['fontSize',4,200],['width',40,3000],['padding',0,100],['borderWidth',0,30],['opacity',0,1]])if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max)throw Error('추가 내용 범위 오류: '+key);
            for(const key of ['color','fill','border'])if(!/^#[a-f\d]{6}$/i.test(v[key]))throw Error('추가 내용 색상 오류');
            if(typeof v.bold!=='boolean'||!['start','middle','end'].includes(v.align))throw Error('글자 설정 오류');
            return Object.fromEntries(['id','text','kind','x','y','fontSize','width','padding','borderWidth','opacity','color','fill','border','bold','align'].map(k=>[k,v[k]]));
        });
    }
    function apply(svg,value){
        svg.querySelectorAll('[data-mdpro-added-content]').forEach(e=>e.remove());
        const items=clean(value||[]);if(!items.length)return 0;
        const layer=document.createElementNS(NS,'g');layer.setAttribute('data-mdpro-added-content','1');
        layer.style.pointerEvents='none';svg.append(layer);
        for(const v of items){
            const group=document.createElementNS(NS,'g');group.setAttribute('data-content-id',v.id);group.setAttribute('transform','translate('+v.x+','+v.y+')');layer.append(group);
            const text=document.createElementNS(NS,'text');text.setAttribute('text-anchor',v.align);text.style.setProperty('fill',v.color,'important');text.style.setProperty('font-size',v.fontSize+'px','important');text.style.setProperty('font-weight',v.bold?'700':'400','important');text.style.setProperty('stroke','none','important');text.style.fontFamily='sans-serif';group.append(text);
            const max=Math.max(1,Math.floor(v.width/(v.fontSize*.65))),lines=[];
            for(const row of v.text.split(/\r?\n/)){let line='';for(const char of Array.from(row)){line+=char;if(Array.from(line).length>=max){lines.push(line);line='';}}if(line||!row)lines.push(line);}
            lines.forEach((line,index)=>{const span=document.createElementNS(NS,'tspan');span.setAttribute('x','0');span.setAttribute('y',index*v.fontSize*1.35);span.style.setProperty('font-size',v.fontSize+'px','important');span.style.setProperty('fill',v.color,'important');span.style.setProperty('font-weight',v.bold?'700':'400','important');span.textContent=line||' ';text.append(span);});
            if(v.kind==='note'){const b=text.getBBox(),rect=document.createElementNS(NS,'rect');rect.setAttribute('x',b.x-v.padding);rect.setAttribute('y',b.y-v.padding);rect.setAttribute('width',b.width+2*v.padding);rect.setAttribute('height',b.height+2*v.padding);rect.setAttribute('rx','6');rect.style.setProperty('fill',v.fill,'important');rect.style.setProperty('fill-opacity',v.opacity,'important');rect.style.setProperty('stroke',v.border,'important');rect.style.setProperty('stroke-width',v.borderWidth+'px','important');group.insertBefore(rect,text);}
        }
        const b=svg.getBBox(),v=String(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);if(v.length===4&&v.every(Number.isFinite)){const x=Math.min(v[0],b.x-12),y=Math.min(v[1],b.y-12);svg.setAttribute('viewBox',[x,y,Math.max(v[0]+v[2],b.x+b.width+12)-x,Math.max(v[1]+v[3],b.y+b.height+12)-y].join(' '));}
        return items.length;
    }
    function attach(wrapper,host,current,commit){
        const section=document.createElement('section');section.className='trt-content-builder';section.style.cssText='display:grid;gap:10px;width:100%;border-bottom:1px solid #94a3b8;padding-bottom:12px';
        const info=document.createElement('p');info.textContent='모든 도표에 제목·자유 텍스트·설명·메모 상자를 추가합니다. 도표의 노드·데이터는 유지하며 코드에 적용하면 추가 내용이 저장됩니다.';
        const kind=document.createElement('select');kind.setAttribute('aria-label','추가할 내용 종류');for(const [value,label]of [['text','자유 텍스트'],['title','제목'],['caption','설명·출처'],['note','메모 상자']])kind.add(new Option(label,value));
        const draft=document.createElement('textarea');draft.rows=3;draft.maxLength=4000;draft.setAttribute('aria-label','추가할 텍스트 내용');draft.placeholder='제목, 설명, 주석 등을 여러 줄로 입력하세요.';draft.style.cssText='width:100%;box-sizing:border-box;background:#fff;color:#172033';
        const status=document.createElement('p');status.setAttribute('role','status');
        function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='trt-mermaid-btn trt-mermaid-fixed-fit';b.onclick=fn;return b;}
        const cards=document.createElement('div');cards.style.cssText='display:grid;gap:10px;width:100%';
        const add=button('텍스트·내용 추가',async()=>{try{if(!draft.value.trim())throw Error('추가할 내용을 입력하세요.');const c=current(),svg=wrapper.querySelector('svg'),box=String(svg?.getAttribute('viewBox')||'0 0 600 400').split(/[\s,]+/).map(Number);c.annotations=c.annotations||[];c.annotations.push({id:'content-'+crypto.randomUUID(),kind:kind.value,text:draft.value,x:box[0]+box[2]/2,y:kind.value==='title'?box[1]-20:box[1]+box[3]+35,fontSize:kind.value==='title'?26:18,width:Math.min(600,Math.max(120,box[2]*.8)),padding:12,borderWidth:1,opacity:1,color:kind.value==='note'?'#172033':wrapper.dataset.mermaidTheme==='dark'?'#e2e8f0':'#172033',fill:'#fff7cc',border:'#64748b',bold:kind.value==='title',align:'middle'});await commit(c);status.textContent='내용을 추가했습니다. 아래에서 위치와 모양을 조절하세요.';}catch(e){status.textContent=e.message;}});
        const aiPrompt=document.createElement('textarea');aiPrompt.rows=2;aiPrompt.maxLength=4000;aiPrompt.setAttribute('aria-label','Jena ME 내용 추가 요청');aiPrompt.placeholder='예: 기존 구조를 유지하고 검토 단계와 설명 노드를 추가해줘';aiPrompt.style.cssText='width:100%;box-sizing:border-box;background:#fff;color:#172033';
        let pendingSend=null;
        const sendME=button('Jena ME에서 코드·내용 수정',()=>{try{
            if(typeof root.openMermaidEditorModal!=='function')throw Error('Jena ME가 준비되지 않았습니다.');
            const frame=document.getElementById('mermaid-editor-frame');if(!frame)throw Error('Jena ME 창을 찾지 못했습니다.');
            if(pendingSend)frame.removeEventListener('load',pendingSend);
            const source=wrapper.dataset.mermaidOriginalSource,request=aiPrompt.value.trim()||'기존 도표의 종류와 데이터를 보존하면서 필요한 설명과 내용을 추가해 주세요.';
            const send=()=>{if(!wrapper.isConnected){frame.removeEventListener('load',send);return;}frame.contentWindow.postMessage({type:'mdv-load-document-selection',code:source,appearanceInstruction:request},location.origin);frame.removeEventListener('load',send);pendingSend=null;};
            pendingSend=send;frame.addEventListener('load',send);root.openMermaidEditorModal();
            try{if(frame.contentDocument?.getElementById('raw-code-editor'))send();}catch(_){}
            status.textContent='현재 코드를 Jena ME에 준비했습니다. 요청을 확인하고 ME에서 수정 실행 후 아래 교체 버튼을 사용하세요. AI 요청은 자동 실행하지 않습니다.';
        }catch(e){status.textContent=e.message;}});
        const replaceME=button('ME 수정 코드로 이 도표 교체',async()=>{try{const frame=document.getElementById('mermaid-editor-frame'),code=frame?.contentDocument?.getElementById('raw-code-editor')?.value;if(!code?.trim())throw Error('ME 코드 편집기의 결과를 먼저 확인하세요.');await root.MermaidAppearanceSource.replaceCode(wrapper,code);status.textContent='ME 코드를 적용했습니다.';}catch(e){status.textContent=e.message;}});
        section.append(info,kind,draft,add,cards,aiPrompt,sendME,replaceME,status);host.prepend(section);
        function refresh(){cards.replaceChildren();for(const item of current().annotations||[]){
            const card=document.createElement('section');card.className='trt-content-item';card.style.cssText='display:grid;gap:8px;border:1px solid #94a3b8;padding:10px;border-radius:6px';
            async function set(key,value){try{const c=current(),target=c.annotations?.find(v=>v.id===item.id);if(!target)throw Error('항목이 변경되었습니다.');target[key]=value;await commit(c);}catch(e){status.textContent=e.message;}}
            function field(key,label,type,min,max){const row=document.createElement('label'),input=document.createElement(type==='textarea'?'textarea':'input');input.setAttribute('aria-label',label);if(type!=='textarea')input.type=type;if(type==='number'){input.min=min;input.max=max;input.step='any';}if(type==='textarea'){input.rows=3;input.maxLength=4000;input.style.width='100%';}if(type==='checkbox')input.checked=item[key];else input.value=item[key];input.onchange=()=>{if(input.checkValidity()&&(type!=='number'||input.value!==''))set(key,type==='number'?Number(input.value):type==='checkbox'?input.checked:input.value);else status.textContent='입력 범위를 확인하세요.';};row.append(document.createTextNode(label),input);card.append(row);}
            field('text','추가 내용','textarea');field('x','내용 X 위치','number',-10000,10000);field('y','내용 Y 위치','number',-10000,10000);field('fontSize','내용 글자 크기','number',4,200);field('width','내용 줄바꿈 너비','number',40,3000);field('color','내용 글자색','color');field('bold','내용 굵게','checkbox');
            const align=document.createElement('select');align.setAttribute('aria-label','내용 글자 정렬');for(const [v,label]of [['start','왼쪽 정렬'],['middle','가운데 정렬'],['end','오른쪽 정렬']])align.add(new Option(label,v));align.value=item.align;align.onchange=()=>set('align',align.value);card.append(align);
            if(item.kind==='note'){field('fill','메모 배경색','color');field('border','메모 테두리색','color');field('borderWidth','메모 테두리 두께','number',0,30);field('opacity','메모 배경 알파','number',0,1);field('padding','메모 안쪽 여백','number',0,100);}
            card.append(button('이 내용 삭제',async()=>{try{const c=current();c.annotations=c.annotations.filter(v=>v.id!==item.id);await commit(c);}catch(e){status.textContent=e.message;}}));cards.append(card);
        }}
        return {refresh};
    }
    root.MermaidAppearanceContent={clean,apply,attach};
})(window);

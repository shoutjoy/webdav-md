/* Safe per-element rules. No user-provided selectors, CSS, or executable input. */
(function (root) {
    'use strict';
    const tags = 'rect,circle,ellipse,polygon,polyline,path,line,text,foreignObject';
    const limits = { strokeWidth: [0, 100], opacity: [0, 1], fontSize: [4, 200], radius: [.5, 150], width:[.1,10000],height:[.1,10000],x:[-10000,10000],y:[-10000,10000] };
    const labels={fill:'배경색',stroke:'테두리색',textColor:'글자색',strokeWidth:'선 두께',opacity:'불투명도',fontSize:'글자 크기',radius:'반지름·모서리',width:'개체 너비',height:'개체 높이',x:'X 위치',y:'Y 위치',dash:'선 모양'};
    const help={fill:'선택한 도형 내부의 색을 바꿉니다.',stroke:'선택한 도형의 테두리나 선 색을 바꿉니다.',textColor:'선택한 글자나 라벨의 색을 바꿉니다.',strokeWidth:'선택한 테두리·선의 두께를 SVG 단위로 조절합니다.',opacity:'0은 투명, 1은 완전 불투명입니다.',fontSize:'선택한 글자·라벨의 크기를 px 단위로 조절합니다.',radius:'원의 반지름 또는 사각형 모서리의 둥글기를 조절합니다.',width:'사각형·HTML 라벨의 너비를 조절합니다.',height:'사각형·HTML 라벨의 높이를 조절합니다.',x:'사각형·라벨·글자·원의 가로 위치입니다. 큰 값은 오른쪽으로 이동합니다.',y:'사각형·라벨·글자·원의 세로 위치입니다. 큰 값은 아래로 이동합니다.',dash:'선택한 선을 실선·파선·점선으로 바꿉니다.'};
    const actionHelp={'개체 목록 새로고침':'현재 SVG의 개체 목록을 다시 읽습니다. 기존 선택 번호는 유지합니다.','같은 종류 선택':'현재 선택한 개체와 같은 종류를 모두 선택합니다. XY 막대는 모든 막대 계열을 포함합니다.','XY 막대 전체 선택':'XY 차트의 모든 막대를 선택합니다. 축·배경·선 그래프는 제외합니다.','선택 해제':'선택 표시만 해제합니다. 적용한 스타일과 만든 도구는 유지합니다.','도표에서 선택':'도표의 도형·선·글자를 클릭해 선택합니다. Ctrl/⌘+클릭으로 여러 개를 추가하거나 해제합니다.','선택 개체에 적용':'고급 속성에서 체크한 값을 선택한 모든 개체에 적용합니다. 문서 저장은 코드에 적용 후 진행합니다.','선택 개체 초기화':'선택한 개체의 커스텀 수정값을 지웁니다. 공통 도표 스타일은 유지합니다.','커스텀 전체 초기화':'이 커스텀 도구 영역의 만든 도구와 개별 수정값을 모두 지웁니다. 커스터마이즈 2의 숫자 항목은 유지합니다.','설정 JSON 만들기':'이 도표의 커스텀 도구와 개별 수정값을 복사 가능한 JSON으로 만듭니다.','설정 JSON 불러오기':'같은 원본 도표에서 만든 커스텀 JSON을 검사한 뒤 복원합니다.'};
    function style(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('속성 형식을 확인하세요.');
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            if (['fill','stroke','textColor'].includes(key)) { if (!/^#[a-f\d]{6}$/i.test(val)) throw Error('색상 형식 오류'); out[key] = val; }
            else if (limits[key]) { const [min,max] = limits[key]; if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) throw Error('속성 범위 오류: '+key); out[key] = val; }
            else if (key === 'dash') { if (!['solid','dashed','dotted'].includes(val)) throw Error('선 모양 오류'); out[key] = val; }
            else throw Error('허용하지 않는 속성: '+key);
        }
        return out;
    }
    function targets(tool) {
        const values=tool.targets || [{index:tool.index,signature:tool.signature}];
        if(!Array.isArray(values)||!values.length||values.length>500)throw Error('대상은 1~500개까지 선택할 수 있습니다.');
        const seen=new Set();return values.map(r=>{if(!r||!Number.isInteger(r.index)||r.index<0||r.index>20000||typeof r.signature!=='string'||r.signature.length>1000||seen.has(r.index))throw Error('다중 대상 형식 오류');seen.add(r.index);return {index:r.index,signature:r.signature};});
    }
    function kind(el) {
        if(el.matches('rect')&&el.closest('[class*="bar-plot-"]'))return 'xy-bars';
        return signature(el);
    }
    function clean(value) {
        if (!value || value.version !== 1 || !/^[a-f\d]+-\d+$/.test(value.sourceKey) || !Array.isArray(value.rules) || value.rules.length > 500) throw Error('커스텀 설정 형식 오류');
        const tools=value.tools || [];if(!Array.isArray(tools)||tools.length>100)throw Error('도구는 100개까지 만들 수 있습니다.');
        const ids=new Set();
        const safeTools=tools.map(t=>{
            if(!t||typeof t.id!=='string'||!/^[\w-]{1,80}$/.test(t.id)||ids.has(t.id)||typeof t.label!=='string'||!t.label.trim()||t.label.length>80||!Object.hasOwn(labels,t.property)||!Number.isInteger(t.index)||t.index<0||t.index>20000||typeof t.signature!=='string'||t.signature.length>1000)throw Error('만든 도구 형식 오류');
            const group=targets(t);ids.add(t.id);const tool={id:t.id,label:t.label,index:group[0].index,signature:group[0].signature,property:t.property,targets:group};
            if(limits[t.property]){const [lo,hi]=limits[t.property];if(![t.min,t.max,t.step].every(Number.isFinite)||t.min<lo||t.max>hi||t.min>=t.max||t.step<=0||t.step>hi-lo)throw Error('도구 숫자 범위를 확인하세요.');Object.assign(tool,{min:t.min,max:t.max,step:t.step});}
            return tool;
        });
        return { version:1, sourceKey:value.sourceKey, tools:safeTools, rules:value.rules.map(r => {
            if (!r || !Number.isInteger(r.index) || r.index < 0 || r.index > 20000 || typeof r.signature !== 'string' || r.signature.length > 1000) throw Error('대상 형식 오류');
            return { index:r.index, signature:r.signature, style:style(r.style) };
        }) };
    }
    function sourceKey(source) {
        const text = (root.MermaidAppearanceSource?.baseSource(String(source)) || String(source)).replace(/\r\n/g,'\n').trim();
        let h = 2166136261; for (let i=0;i<text.length;i++) h = Math.imul(h ^ text.charCodeAt(i),16777619);
        return (h>>>0).toString(16)+'-'+text.length;
    }
    function elements(svg) {
        return svg ? Array.from(svg.querySelectorAll(tags)).filter(e => !e.closest('defs,marker,clipPath,mask,foreignObject *,[data-mdpro-value-labels],[data-mdpro-added-content]')) : [];
    }
    function signature(el) {
        return [el.tagName, el.getAttribute('class') || '', el.parentElement?.tagName, el.parentElement?.getAttribute('class') || ''].join('|');
    }
    function apply(svg, source, value) {
        if (!value) return;
        const c = clean(value); if (c.sourceKey !== sourceKey(source)) return;
        const all = elements(svg);
        for (const rule of c.rules) {
            const el = all[rule.index]; if (!el || signature(el) !== rule.signature) continue;
            const s = rule.style, set = (node,key,val) => { if (val != null) node.style.setProperty(key,String(val),'important'); };
            set(el,'fill',s.fill); set(el,'stroke',s.stroke); set(el,'stroke-width',s.strokeWidth);
            set(el,'opacity',s.opacity);
            if (s.dash) set(el,'stroke-dasharray',s.dash==='solid'?'none':s.dash==='dashed'?'10 6':'2 5');
            if (s.radius != null && el.matches('circle')) el.setAttribute('r',s.radius);
            if (s.radius != null && el.matches('rect')) {el.setAttribute('rx',s.radius);el.setAttribute('ry',s.radius);}
            for(const key of ['width','height','x','y'])if(s[key]!=null)el.setAttribute(el.matches('circle,ellipse')&&(key==='x'||key==='y')?'c'+key:key,s[key]);
            const labels = el.matches('foreignObject') ? el.querySelectorAll('*') : [el];
            labels.forEach(label => { set(label,'font-size',s.fontSize == null ? null : s.fontSize+'px');set(label,'color',s.textColor);if(label.matches('text,tspan'))set(label,'fill',s.textColor); });
        }
        if(c.rules.length){
            const b=svg.getBBox(),v=String(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
            if(v.length===4&&v.every(Number.isFinite)&&b.width>0&&b.height>0){const x=Math.min(v[0],b.x-12),y=Math.min(v[1],b.y-12);svg.setAttribute('viewBox',[x,y,Math.max(v[0]+v[2],b.x+b.width+12)-x,Math.max(v[1]+v[3],b.y+b.height+12)-y].join(' '));}
        }
    }
    function attach(wrapper, host, change) {
        if (!document.getElementById('mdpro-custom-object-style')) {
            const style=document.createElement('style');style.id='mdpro-custom-object-style';
            style.textContent='.trt-mermaid-canvas [data-mdpro-custom-selected]{outline:2px dashed #a855f7;outline-offset:3px}.trt-mermaid-custom{grid-column:1/-1}.trt-mermaid-custom input[type=number]{width:80px}.trt-mermaid-custom input[type=checkbox]{width:18px;height:18px;flex-shrink:0}.trt-mermaid-custom textarea{min-height:90px;color:#172033;background:#fff}';document.head.append(style);
        }
        const box = document.createElement('fieldset'); box.className='trt-mermaid-category trt-mermaid-custom';
        const legend=document.createElement('legend');legend.textContent='커스텀 도구 만들기';box.append(legend);
        const note=document.createElement('p');note.textContent='대상과 속성을 골라 기존에 없는 조절 도구를 하단에 추가하세요. 도구와 수정값은 코드에 적용해야 문서에 저장됩니다.';box.append(note);
        const select=document.createElement('select');select.setAttribute('aria-label','커스텀 대상 개체');select.multiple=true;select.size=8;select.style.cssText='width:100%;height:180px;min-height:120px';box.append(select);const hint=document.createElement('small');hint.textContent='Ctrl/⌘로 여러 개, Shift로 연속 선택 · 도표에서 Ctrl/⌘+클릭으로 선택 추가/해제';box.append(hint);
        const status=document.createElement('p');status.setAttribute('role','status');
        const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='고급: 속성 직접 편집';advanced.append(summary);box.append(advanced);
        const inputHost=document.createElement('div');inputHost.style.cssText='display:grid;gap:8px;width:100%';advanced.append(inputHost);
        const fields={};
        for (const [key,label,kind,min,max,step] of [['fill','개체 배경색','color'],['stroke','개체 테두리색','color'],['textColor','개체 글자색','color'],['strokeWidth','개체 선 두께','number',0,100,.5],['opacity','개체 불투명도','number',0,1,.05],['fontSize','개체 글자 크기','number',4,200,1],['radius','개체 반지름·모서리','number',.5,150,1]]) {
            const row=document.createElement('label'),enabled=document.createElement('input'),input=document.createElement('input');
            enabled.type='checkbox';enabled.setAttribute('aria-label',label+' 사용');input.type=kind;input.setAttribute('aria-label',label);
            if(kind==='number'){input.min=min;input.max=max;input.step='any';}input.value=kind==='color'?'#4477aa':key==='opacity'?1:key==='fontSize'?20:2;
            row.append(enabled,document.createTextNode(label),input);inputHost.append(row);fields[key]={enabled,input};
        }
        const dash=document.createElement('select');dash.setAttribute('aria-label','개체 선 모양');for(const [v,t] of [['','원래 선 모양'],['solid','실선'],['dashed','파선'],['dotted','점선']])dash.add(new Option(t,v));advanced.append(dash);
        const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px';box.append(actions);
        function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=actionHelp[text]||text;b.className='trt-mermaid-btn trt-mermaid-fixed-fit';b.onclick=fn;actions.append(b);return b;}
        let picking=false, initialized=false;
        const svg=()=>wrapper.querySelector('.trt-mermaid-canvas svg');
        const config=()=>{const value=wrapper.__mdvMermaidAppearance?.custom;return value?clean(value):{version:1,sourceKey:sourceKey(wrapper.dataset.mermaidOriginalSource),rules:[]};};
        function selectedAll(){const all=elements(svg()),list=Array.from(select.selectedOptions).map(o=>{const index=Number(o.value),el=all[index];if(!el)throw Error('개체를 다시 선택하세요.');return {el,index,signature:signature(el)};});if(!list.length)throw Error('개체를 하나 이상 선택하세요.');return list;}
        function selected(){return selectedAll()[0];}
        function show(){
            wrapper.querySelectorAll('[data-mdpro-custom-selected]').forEach(e=>e.removeAttribute('data-mdpro-custom-selected'));
            try {const selection=selectedAll(),r=selection[0];selection.forEach(v=>v.el.setAttribute('data-mdpro-custom-selected','1'));const saved=config().rules.find(v=>v.index===r.index&&v.signature===r.signature)?.style||{};
                for(const [key,{enabled,input}] of Object.entries(fields)){enabled.checked=saved[key]!=null;if(saved[key]!=null)input.value=saved[key];}dash.value=saved.dash||'';
                status.textContent='선택 '+selection.length+'개 · 개별 설정 '+config().rules.length+'개'+(selection.length>1?' · 입력값은 첫 선택 기준, 적용 시 선택 전체 변경':'');
            }catch(e){status.textContent=e.message;}
        }
        function refresh(){const previous=new Set(Array.from(select.selectedOptions,o=>o.value));select.replaceChildren();elements(svg()).forEach((el,index)=>{const text=(el.textContent||el.parentElement?.textContent||'').trim().replace(/\s+/g,' ').slice(0,35);select.add(new Option((index+1)+' · '+el.tagName+' · '+(el.getAttribute('class')||'').slice(0,30)+' '+text,String(index)));});Array.from(select.options).forEach(o=>o.selected=previous.has(o.value));if(!initialized&&select.options.length)select.options[0].selected=true;initialized=true;show();renderTools();}
        select.onchange=show;
        button('개체 목록 새로고침',refresh);
        function choose(predicate){const all=elements(svg());Array.from(select.options).forEach(o=>o.selected=predicate(all[Number(o.value)]));show();}
        button('같은 종류 선택',()=>{try{const kinds=new Set(selectedAll().map(r=>kind(r.el)));choose(el=>kinds.has(kind(el)));}catch(e){status.textContent=e.message;}});
        if(root.MermaidAppearanceTypes?.type(wrapper.dataset.mermaidOriginalSource).startsWith('xychart'))button('XY 막대 전체 선택',()=>choose(el=>kind(el)==='xy-bars'));
        button('선택 해제',()=>{Array.from(select.options).forEach(o=>o.selected=false);wrapper.querySelectorAll('[data-mdpro-custom-selected]').forEach(e=>e.removeAttribute('data-mdpro-custom-selected'));status.textContent='선택을 해제했습니다.';});
        const pick=button('도표에서 선택',()=>{picking=!picking;pick.setAttribute('aria-pressed',String(picking));status.textContent=picking?'도표의 도형·선·글자를 클릭하세요.':'선택 모드를 종료했습니다.';});
        wrapper.addEventListener('click',e=>{if(!picking)return;const all=elements(svg()),el=e.target.closest(tags),index=all.indexOf(el);if(index<0)return;e.preventDefault();e.stopPropagation();if(e.ctrlKey||e.metaKey){const o=select.options[index];o.selected=!o.selected;}else{select.value=String(index);}show();},true);
        function properties(){const s={};for(const [key,{enabled,input}]of Object.entries(fields))if(enabled.checked){if(!input.checkValidity()||input.value==='')throw Error('입력 범위를 확인하세요.');s[key]=input.type==='number'?Number(input.value):input.value;}if(dash.value)s.dash=dash.value;return style(s);}
        async function commit(c){await change({custom:c.rules.length||c.tools?.length?clean(c):null});refresh();}
        button('선택 개체에 적용',async()=>{try{const list=selectedAll(),c=config(),patch=properties();if(c.sourceKey!==sourceKey(wrapper.dataset.mermaidOriginalSource))throw Error('원본이 바뀌었습니다. 다시 선택하세요.');for(const r of list){const prior=c.rules.find(v=>v.index===r.index&&v.signature===r.signature)?.style||{};const extra=Object.fromEntries(Object.entries(prior).filter(([key])=>!fields[key]&&key!=='dash'));c.rules=c.rules.filter(v=>v.index!==r.index);c.rules.push({index:r.index,signature:r.signature,style:Object.assign(extra,patch)});}await commit(c);}catch(e){status.textContent=e.message;}});
        button('선택 개체 초기화',async()=>{try{const c=config(),indices=new Set(selectedAll().map(r=>r.index));c.rules=c.rules.filter(v=>!indices.has(v.index));await commit(c);}catch(e){status.textContent=e.message;}});
        button('커스텀 전체 초기화',async()=>{try{await change({custom:null});refresh();}catch(e){status.textContent=e.message;}});
        const jsonDetails=document.createElement('details'),jsonTitle=document.createElement('summary');jsonTitle.textContent='설정 JSON';jsonDetails.append(jsonTitle);
        const json=document.createElement('textarea');json.setAttribute('aria-label','커스텀 설정 JSON');json.rows=4;json.style.cssText='width:100%;box-sizing:border-box';jsonDetails.append(json);
        button('설정 JSON 만들기',()=>{try{json.value=JSON.stringify(config(),null,2);jsonDetails.open=true;status.textContent='이 도표용 설정입니다. 복사하거나 파일로 보관할 수 있습니다.';}catch(e){status.textContent=e.message;}});
        button('설정 JSON 불러오기',async()=>{try{if(json.value.length>200000)throw Error('설정이 너무 큽니다.');const c=clean(JSON.parse(json.value));if(c.sourceKey!==sourceKey(wrapper.dataset.mermaidOriginalSource))throw Error('다른 원본 도표의 설정입니다.');await commit(c);}catch(e){status.textContent=e.message;}});
        const builder=document.createElement('section');builder.style.cssText='display:grid;gap:8px;width:100%;border-top:1px solid #94a3b8;padding-top:12px';
        const name=document.createElement('input');name.placeholder='도구 이름 · 예: 첫 번째 막대 색';name.setAttribute('aria-label','새 도구 이름');name.maxLength=80;name.style.cssText='width:100%;min-width:0;height:34px';
        const property=document.createElement('select');property.setAttribute('aria-label','새 도구 속성');property.style.width='100%';for(const [key,label]of Object.entries(labels))property.add(new Option(label,key));
        builder.append(name,property);const numeric=document.createElement('div');numeric.style.cssText='display:flex;flex-wrap:wrap;gap:8px';builder.append(numeric);
        const bounds={};for(const [key,label]of [['min','최솟값'],['max','최댓값'],['step','증감 단위']]){const row=document.createElement('label'),input=document.createElement('input');input.type='number';input.step='any';input.style.width='85px';input.setAttribute('aria-label','새 도구 '+label);row.append(document.createTextNode(label),input);numeric.append(row);bounds[key]=input;}
        property.onchange=()=>{property.title=help[property.value];numeric.hidden=!limits[property.value];numeric.style.display=limits[property.value]?'flex':'none';const [min,max]=limits[property.value]||[0,1];bounds.min.value=min;bounds.max.value=max;bounds.step.value=property.value==='opacity'?.05:1;};property.onchange();
        const add=document.createElement('button');add.type='button';add.className='trt-mermaid-btn trt-mermaid-fixed-fit';add.textContent='하단에 도구 추가';builder.append(add);
        const toolHost=document.createElement('div');toolHost.className='trt-custom-created-tools';toolHost.style.cssText='display:grid;gap:10px;width:100%';
        add.onclick=async()=>{try{const selection=selectedAll(),r=selection[0],c=config(),key=property.value;
            for(const r of selection){
            if(['width','height'].includes(key)&&!r.el.matches('rect,foreignObject'))throw Error('너비·높이는 사각형/HTML 라벨에서 지원합니다.');
            if(['x','y'].includes(key)&&!r.el.matches('rect,foreignObject,text,circle,ellipse'))throw Error('이 위치 속성은 선택한 개체에서 지원하지 않습니다.');
            if(key==='radius'&&!r.el.matches('rect,circle'))throw Error('반지름·모서리는 사각형/원에서 지원합니다.');
            }
            const tool={targets:selection.map(({index,signature})=>({index,signature})),id:'tool-'+crypto.randomUUID(),label:name.value.trim()||labels[key],property:key,index:r.index,signature:r.signature};
            if(limits[key])for(const k of ['min','max','step'])tool[k]=Number(bounds[k].value);
            c.tools=(c.tools||[]).concat(tool);await commit(clean(c));status.textContent='하단에 '+tool.label+' 도구를 추가했습니다.';
        }catch(e){status.textContent=e.message;}};
        function renderTools(){
            if(!toolHost)return;toolHost.replaceChildren();
            let c;try{c=config();}catch(e){return;}
            for(const t of c.tools||[]){
                const card=document.createElement('section');card.className='trt-custom-created-tool';card.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:8px;border:1px solid #94a3b8;border-radius:6px;padding:10px';
                const title=document.createElement('strong');const group=targets(t);title.textContent=t.label+' · '+group.length+'개 개체';title.style.flex='1 0 100%';card.append(title);
                card.title=title.title=t.label+' · '+group.length+'개 개체에 적용: '+help[t.property];
                const current=c.rules.find(r=>r.index===t.index&&r.signature===t.signature)?.style[t.property];
                const input=document.createElement(limits[t.property]?'input':t.property==='dash'?'select':'input');input.setAttribute('aria-label',t.label+' 조절값');input.title=help[t.property]+(limits[t.property]?' 허용 범위 '+t.min+'~'+t.max+'.':'');
                if(limits[t.property]){input.type='number';input.min=t.min;input.max=t.max;input.step='any';input.value=current??Math.max(t.min,Math.min(t.max,t.property==='opacity'?1:1));}
                else if(t.property==='dash'){for(const [v,label]of [['solid','실선'],['dashed','파선'],['dotted','점선']])input.add(new Option(label,v));input.value=current||'solid';}
                else{input.type='color';input.value=current||'#4477aa';}
                async function set(value){try{const all=elements(svg());if(c.sourceKey!==sourceKey(wrapper.dataset.mermaidOriginalSource)||group.some(r=>!all[r.index]||signature(all[r.index])!==r.signature))throw Error('대상이 바뀌었습니다. 도구를 다시 만들어 주세요.');const latest=config(),patch=style({[t.property]:value});for(const r of group){let rule=latest.rules.find(v=>v.index===r.index&&v.signature===r.signature);if(!rule){rule={index:r.index,signature:r.signature,style:{}};latest.rules.push(rule);}Object.assign(rule.style,patch);}await commit(latest);}catch(e){status.textContent=e.message;}}
                if(limits[t.property])for(const [label,sign]of [['−',-1],['+',1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',t.label+(sign<0?' 줄이기':' 늘리기'));b.title=t.label+' 값을 '+t.step+'만큼 '+(sign<0?'줄입니다.':'늘립니다.')+' Shift+클릭은 10배 증감합니다.';b.className='trt-mermaid-btn';b.onclick=e=>set(Math.min(t.max,Math.max(t.min,+(Number(input.value)+sign*t.step*(e.shiftKey?10:1)).toFixed(4))));if(sign<0)card.append(b);else{card.append(input,b);}}
                else card.append(input);
                input.onchange=()=>{if(input.value!==''&&input.checkValidity())set(limits[t.property]?Number(input.value):input.value);else status.textContent='만든 도구의 숫자 범위를 확인하세요.';};
                const remove=document.createElement('button');remove.type='button';remove.textContent='도구 삭제';remove.title='조절 도구 카드만 삭제합니다. 이미 적용한 개체 스타일은 유지합니다.';remove.className='trt-mermaid-btn trt-mermaid-fixed-fit';remove.onclick=async()=>{try{const latest=config();latest.tools=latest.tools.filter(v=>v.id!==t.id);await commit(latest);}catch(e){status.textContent=e.message;}};card.append(remove);toolHost.append(card);
            }
        }
        box.append(builder,toolHost,advanced,jsonDetails,status);host.append(box);refresh();
        select.title='도표에서 수정할 개체를 고릅니다. Ctrl/⌘로 여러 개, Shift로 연속 선택합니다.';
        summary.title='체크한 속성값을 선택한 모든 개체에 한 번에 적용하는 고급 편집입니다.';
        name.title='새로 만들 조절 도구의 이름입니다. 비우면 속성 이름을 사용합니다.';
        add.title='선택한 개체와 속성으로 하단에 새 조절 도구를 만듭니다. 도표에 새 도형이나 글자를 추가하려면 커스터마이즈 2를 사용하세요.';
        json.title='같은 원본 도표에서 만든 설정 JSON을 복사하거나 붙여 넣습니다.';
        jsonTitle.title='커스텀 도구와 개별 수정값을 JSON으로 복사하거나 복원하는 영역입니다.';
        dash.title=help.dash;
        for(const [key,{enabled,input}]of Object.entries(fields)){input.title=help[key];enabled.title='체크하면 '+labels[key]+' 값을 선택 개체에 적용합니다. '+help[key];}
        for(const [key,label]of [['min','최솟값'],['max','최댓값'],['step','증감 단위']])bounds[key].title='새 숫자 도구의 '+label+'입니다. 증감 단위는 −/+ 버튼에 적용됩니다.';
        return {refresh};
    }
    root.MermaidAppearanceCustom={style,clean,sourceKey,elements,signature,targets,kind,apply,attach};
})(window);

const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../mdpro');
(async()=>{
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'})[path.extname(f)]||'application/octet-stream'});res.end(e?'':b);});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1400,height:1000}});
await page.addInitScript(()=>{localStorage.setItem('md_viewer_mermaid_display_mode','fixed');localStorage.setItem('md_viewer_indb_enabled','true');const p=Object.getOwnPropertyDescriptor(window,'onload');Object.defineProperty(window,'onload',{configurable:true,get(){return p.get.call(window)},set(fn){p.set.call(window,async function(e){try{await fn.call(this,e)}finally{window.testAppReady=true}})}});});
await page.route('**/marked/marked.min.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'vendor/marked/marked.umd.js'))}));
await page.route('**/dist/mermaid.min.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.MERMAID_TEST_SCRIPT || path.resolve(root,'../../check/pv-mermaid-proof/mermaid.min.js'))}));
const url='http://127.0.0.1:'+server.address().port;
await page.goto(url);await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceSource&&window.InDbStorage?.getDatabase());


const cases=[['xychart-beta\n x-axis [Jan, Feb, Mar]\n y-axis "Amount" 0 --> 100\n bar [20,60,40]','.bar-plot-0 rect'],['sankey-beta\n\n부모,식비,30\n부모,주거,70','.node rect'],['flowchart LR\n A[Start]-->B[End]','.node rect']];
const results=[];
for(const [code,selector]of cases){
 await page.evaluate(code=>{updateContent('```mermaid\n'+code+'\n```');if(isEditMode)toggleMode('view');},code);
 await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper svg'));
 const w=page.locator('#viewer .trt-mermaid-wrapper');await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();
 const float=w.getByRole('button',{name:'플로팅',exact:true});if(await float.count())await float.click();
 for(const fold of await page.locator('.trt-custom-section-fold').all())if(!await fold.evaluate(el=>el.open))await fold.locator('summary').first().click();
 if(code.startsWith('xychart')) {
  const font=page.getByLabel('글자 값',{exact:true});await font.fill('64');await font.dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.font===64);
  await page.locator('.trt-mermaid-appearance-panel button[title="글자 늘리기"]').click({modifiers:['Shift']});await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.font===74);
  await font.fill('20');await font.dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.font===20);
 }
 const custom=page.locator('.trt-mermaid-custom');await custom.locator('summary').filter({hasText:'고급: 속성 직접 편집'}).click();
 const target=await w.evaluate((w,selector)=>{const svg=w.querySelector('svg'),el=svg.querySelector(selector);if(!el)throw Error('missing '+selector);return MermaidAppearanceCustom.elements(svg).indexOf(el);},selector);assert.ok(target>=0);
 const beforeFills=await w.evaluate(w=>MermaidAppearanceCustom.elements(w.querySelector('svg')).map(e=>getComputedStyle(e).fill));
 await custom.getByRole('button',{name:'도표에서 선택',exact:true}).click();await w.evaluate((w,selector)=>w.querySelector(selector).dispatchEvent(new MouseEvent('click',{bubbles:true})),selector);assert.equal(await custom.getByLabel('커스텀 대상 개체',{exact:true}).inputValue(),String(target));
 await custom.getByLabel('새 도구 이름',{exact:true}).fill('내 막대 색');await custom.getByLabel('새 도구 속성',{exact:true}).selectOption('fill');await custom.getByRole('button',{name:'하단에 도구 추가',exact:true}).click();
 await page.getByLabel('내 막대 색 조절값',{exact:true}).fill('#55aa33');await page.getByLabel('내 막대 색 조절값',{exact:true}).dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom?.rules[0]?.style.fill==='#55aa33');
 await custom.getByLabel('새 도구 이름',{exact:true}).fill('내 두께');await custom.getByLabel('새 도구 속성',{exact:true}).selectOption('strokeWidth');await custom.getByLabel('새 도구 최솟값',{exact:true}).fill('0');await custom.getByLabel('새 도구 최댓값',{exact:true}).fill('100');await custom.getByLabel('새 도구 증감 단위',{exact:true}).fill('5');await custom.getByRole('button',{name:'하단에 도구 추가',exact:true}).click();
 await page.getByLabel('내 두께 조절값',{exact:true}).fill('30');await page.getByLabel('내 두께 조절값',{exact:true}).dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom?.rules[0]?.style.strokeWidth===30);
 await page.getByRole('button',{name:'내 두께 늘리기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom?.rules[0]?.style.strokeWidth===35);
 if(code.startsWith('xychart')){await custom.getByLabel('새 도구 이름',{exact:true}).fill('막대 너비 도구');await custom.getByLabel('새 도구 속성',{exact:true}).selectOption('width');await custom.getByRole('button',{name:'하단에 도구 추가',exact:true}).click();await page.getByLabel('막대 너비 도구 조절값',{exact:true}).fill('180');await page.getByLabel('막대 너비 도구 조절값',{exact:true}).dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom?.rules[0]?.style.width===180);}
 await custom.getByLabel('개체 배경색 사용',{exact:true}).check();await custom.getByLabel('개체 배경색',{exact:true}).fill('#dd2255');
 await custom.getByLabel('개체 테두리색 사용',{exact:true}).check();await custom.getByLabel('개체 테두리색',{exact:true}).fill('#1122bb');
 await custom.getByLabel('개체 선 두께 사용',{exact:true}).check();await custom.getByLabel('개체 선 두께',{exact:true}).fill('18');
 await custom.getByRole('button',{name:'선택 개체에 적용',exact:true}).click();
 await page.waitForFunction(target=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper'),e=MermaidAppearanceCustom.elements(w.querySelector('svg'))[target];return getComputedStyle(e).fill==='rgb(221, 34, 85)';},target);
 const state=await w.evaluate((w,target)=>{const es=MermaidAppearanceCustom.elements(w.querySelector('svg'));return{fill:getComputedStyle(es[target]).fill,stroke:getComputedStyle(es[target]).stroke,width:getComputedStyle(es[target]).strokeWidth,otherFills:es.filter((e,i)=>i!==target).map(e=>getComputedStyle(e).fill),rules:w.__mdvMermaidAppearance.custom.rules.length};},target);
 assert.deepEqual(state.otherFills,beforeFills.filter((v,i)=>i!==target),'other elements unchanged');assert.equal(state.width,'18px');assert.equal(state.rules,1);
 await custom.getByRole('button',{name:'설정 JSON 만들기',exact:true}).click();const json=await custom.getByLabel('커스텀 설정 JSON').inputValue();assert.equal(JSON.parse(json).rules.length,1);assert.equal(JSON.parse(json).tools.length,code.startsWith('xychart')?3:2);
 await custom.getByRole('button',{name:'커스텀 전체 초기화',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom);
 await custom.getByLabel('커스텀 설정 JSON').fill(json);await custom.getByRole('button',{name:'설정 JSON 불러오기',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom?.rules.length===1);
 const exported=await w.evaluate(async w=>({svg:(await MermaidTRT.exportWrapperImage(w,'svg')).dataUrl,png:(await MermaidTRT.exportWrapperImage(w,'png')).width}));assert.ok(exported.png>0);assert.match(decodeURIComponent(exported.svg),/221, 34, 85|dd2255/);
 const saved=await page.evaluate(async()=>{await MermaidAppearanceSource.apply(document.querySelector('#viewer .trt-mermaid-wrapper'));return editorTextarea.value;});
 assert.match(saved,/"custom"/);
 await page.reload();await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceCustom&&window.InDbStorage?.getDatabase());
 await page.evaluate(text=>{updateContent(text);if(isEditMode)toggleMode('view');},saved);
 await page.waitForFunction(target=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper'),svg=w?.querySelector('svg'),el=svg&&MermaidAppearanceCustom.elements(svg)[target];return el&&getComputedStyle(el).fill==='rgb(221, 34, 85)';},target);
 assert.equal(await page.evaluate(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom.tools.length),code.startsWith('xychart')?3:2);
 const stale=await page.evaluate(()=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper'),c=w.__mdvMermaidAppearance.custom,el=MermaidAppearanceCustom.elements(w.querySelector('svg'))[c.rules[0].index];const old=el.style.fill;MermaidAppearanceCustom.apply(w.querySelector('svg'),'unrelated source',{...c,sourceKey:c.sourceKey});return el.style.fill===old;});assert.ok(stale);
 if(code.startsWith('sankey'))assert.ok((await w.textContent()).includes('식비'));
 const panel=page.locator('.trt-mermaid-appearance-panel');await page.locator('#viewer .trt-mermaid-wrapper').getByRole('button',{name:'도표 스타일 조절',exact:true}).click();if(await panel.getByRole('button',{name:'플로팅',exact:true}).count())await panel.getByRole('button',{name:'플로팅',exact:true}).click();for(const fold of await panel.locator('.trt-custom-section-fold').all())if(!await fold.evaluate(el=>el.open))await fold.locator('summary').first().click();await page.locator('.trt-mermaid-custom').scrollIntoViewIfNeeded();const folder=path.resolve(root,'../artifacts/mermaid-custom-20261125');fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,code.split('\n')[0].split(' ')[0]+'.png')});
 results.push({code,state,sourceReload:true,export:true,json:true});console.log('Custom PASS',code.split('\n')[0]);
}
const out=path.resolve(root,'../artifacts/mermaid-custom-20261125');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));await page.screenshot({path:path.join(out,'app.png')});
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

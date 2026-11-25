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



const code='xychart-beta\n x-axis [Jan, Feb, Mar]\n y-axis "Amount" 0 --> 100\n bar [20,60,40]';
await page.evaluate(code=>{updateContent('```mermaid\n'+code+'\n```');if(isEditMode)toggleMode('view');},code);
await page.waitForFunction(()=>document.querySelector('#viewer .bar-plot-0 rect'));
const w=page.locator('#viewer .trt-mermaid-wrapper');await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();await w.getByRole('button',{name:'플로팅',exact:true}).click();const custom=page.locator('.trt-mermaid-custom');
const list=custom.getByLabel('커스텀 대상 개체',{exact:true});
const indices=await w.evaluate(w=>{const all=MermaidAppearanceCustom.elements(w.querySelector('svg'));return Array.from(w.querySelectorAll('.bar-plot-0 rect')).map(e=>all.indexOf(e));});assert.equal(indices.length,3);
const unchanged=await w.evaluate(w=>({background:getComputedStyle(w.querySelector('rect.background')).fill,text:w.querySelector('text').textContent}));
await list.selectOption(String(indices[0]));await custom.getByRole('button',{name:'같은 종류 선택',exact:true}).click();assert.equal(await list.evaluate(e=>e.selectedOptions.length),3);
await custom.getByRole('button',{name:'선택 해제',exact:true}).click();assert.equal(await list.evaluate(e=>e.selectedOptions.length),0);
await custom.getByRole('button',{name:'도표에서 선택',exact:true}).click();
for(const index of indices.slice(0,2))await w.evaluate((w,index)=>MermaidAppearanceCustom.elements(w.querySelector('svg'))[index].dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true})),index);
assert.equal(await list.evaluate(e=>e.selectedOptions.length),2);
await custom.getByRole('button',{name:'XY 막대 전체 선택',exact:true}).click();assert.equal(await list.evaluate(e=>e.selectedOptions.length),3);
await custom.getByLabel('새 도구 이름',{exact:true}).fill('전체 막대 색');await custom.getByLabel('새 도구 속성',{exact:true}).selectOption('fill');await custom.getByRole('button',{name:'하단에 도구 추가',exact:true}).click();
await page.getByLabel('전체 막대 색 조절값',{exact:true}).fill('#ee3366');await page.getByLabel('전체 막대 색 조절값',{exact:true}).dispatchEvent('change');
await page.waitForFunction(()=>Array.from(document.querySelectorAll('#viewer .bar-plot-0 rect')).every(e=>getComputedStyle(e).fill==='rgb(238, 51, 102)'));
await list.selectOption(indices.slice(0,2).map(String));await custom.getByLabel('새 도구 이름',{exact:true}).fill('두 막대 색');await custom.getByRole('button',{name:'하단에 도구 추가',exact:true}).click();await page.getByLabel('두 막대 색 조절값',{exact:true}).fill('#2255bb');await page.getByLabel('두 막대 색 조절값',{exact:true}).dispatchEvent('change');
await page.waitForFunction(()=>getComputedStyle(document.querySelector('#viewer .bar-plot-0 rect')).fill==='rgb(34, 85, 187)');
const colors=await w.locator('.bar-plot-0 rect').evaluateAll(es=>es.map(e=>getComputedStyle(e).fill));assert.deepEqual(colors,['rgb(34, 85, 187)','rgb(34, 85, 187)','rgb(238, 51, 102)']);assert.deepEqual(await w.evaluate(w=>({background:getComputedStyle(w.querySelector('rect.background')).fill,text:w.querySelector('text').textContent})),unchanged);
await custom.getByRole('button',{name:'설정 JSON 만들기',exact:true}).click();const config=JSON.parse(await custom.getByLabel('커스텀 설정 JSON').inputValue());assert.deepEqual(config.tools.map(t=>t.targets.length),[3,2]);
const saved=await page.evaluate(async()=>{await MermaidAppearanceSource.apply(document.querySelector('#viewer .trt-mermaid-wrapper'));return editorTextarea.value;});
await page.reload();await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceCustom&&window.InDbStorage?.getDatabase());await page.evaluate(text=>{updateContent(text);if(isEditMode)toggleMode('view');},saved);
await page.waitForFunction(()=>document.querySelectorAll('#viewer .bar-plot-0 rect').length===3&&getComputedStyle(document.querySelector('#viewer .bar-plot-0 rect')).fill==='rgb(34, 85, 187)');assert.deepEqual(await page.locator('#viewer .bar-plot-0 rect').evaluateAll(es=>es.map(e=>getComputedStyle(e).fill)),colors);
const restored=await page.evaluate(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom.tools.map(t=>t.targets.length));assert.deepEqual(restored,[3,2]);
await page.locator('#viewer .trt-mermaid-wrapper').getByRole('button',{name:'도표 스타일 조절',exact:true}).click();await page.locator('#viewer .trt-mermaid-wrapper').getByRole('button',{name:'플로팅',exact:true}).click();await page.locator('.trt-mermaid-custom').scrollIntoViewIfNeeded();
const out=path.resolve(root,'../artifacts/mermaid-multiselect-20261125');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'app.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({sameKind:true,allBars:true,ctrlSelection:true,groupCounts:restored,colors,backgroundUnchanged:true,reload:true},null,2));console.log('Multi-select, same-kind, all XY bars, grouped tools, other objects preserved, and reload passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

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




const cases=['flowchart LR\nA[Start]-->B[End]','mindmap\n root((Plan))\n  Child','sequenceDiagram\n A->>B: Hello','quadrantChart\n title Priorities\n A: [0.2,0.5]'];
const results=[];
for(const code of cases){
 await page.evaluate(code=>{updateContent('```mermaid\n'+code+'\n```');if(isEditMode)toggleMode('view');},code);await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper svg'));
 let w=page.locator('#viewer .trt-mermaid-wrapper');await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();let panel=page.locator('.trt-mermaid-appearance-panel');await panel.locator('.trt-mermaid-custom2 > details.trt-custom-section-fold > summary').click();
 await panel.getByLabel('추가할 내용 종류',{exact:true}).selectOption('note');await panel.getByLabel('추가할 텍스트 내용',{exact:true}).fill('연구 메모\n검토 필요 <script>plain</script>');await panel.getByRole('button',{name:'텍스트·내용 추가',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#viewer [data-mdpro-added-content] text'));
 assert.equal(await w.locator('[data-mdpro-added-content] script').count(),0);assert.ok((await w.locator('[data-mdpro-added-content]').textContent()).includes('<script>plain</script>'));
 await panel.getByLabel('내용 글자 크기',{exact:true}).fill('32');await panel.getByLabel('내용 글자 크기',{exact:true}).dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper').__mdvMermaidAppearance.custom2.annotations[0].fontSize===32);
 const exportResult=await w.evaluate(async w=>({svg:(await MermaidTRT.exportWrapperImage(w,'svg')).dataUrl,png:(await MermaidTRT.exportWrapperImage(w,'png')).width}));assert.ok(exportResult.png>0);assert.match(decodeURIComponent(exportResult.svg),/data-mdpro-added-content/);
 const saved=await page.evaluate(async()=>{await MermaidAppearanceSource.apply(document.querySelector('#viewer .trt-mermaid-wrapper'));return editorTextarea.value;});assert.ok(saved.includes(code));
 await page.reload();await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceContent&&window.InDbStorage?.getDatabase());await page.evaluate(text=>{updateContent(text);if(isEditMode)toggleMode('view');},saved);await page.waitForFunction(()=>document.querySelector('#viewer [data-mdpro-added-content] text'));
assert.ok((await page.locator('#viewer [data-mdpro-added-content]').textContent()).includes('연구 메모'));
 results.push({type:code.split('\n')[0],export:true,reload:true});console.log('Content PASS',code.split('\n')[0]);
}
const screenshotDir=path.resolve(root,'../artifacts/mermaid-content-20261125');fs.mkdirSync(screenshotDir,{recursive:true});await page.screenshot({path:path.join(screenshotDir,'content.png')});
let w=page.locator('#viewer .trt-mermaid-wrapper');await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();let panel=page.locator('.trt-mermaid-appearance-panel');await panel.locator('.trt-mermaid-custom2 > details.trt-custom-section-fold > summary').click();
await panel.getByLabel('Jena ME 내용 추가 요청',{exact:true}).fill('현재 도표에 검토 설명 추가');await panel.getByRole('button',{name:'Jena ME에서 코드·내용 수정',exact:true}).click();
const me=page.frameLocator('#mermaid-editor-frame');await me.locator('#mermaid-code-revision-prompt').waitFor();await page.waitForFunction(()=>document.getElementById('mermaid-editor-frame').contentDocument?.getElementById('mermaid-code-revision-prompt')?.value==='현재 도표에 검토 설명 추가');assert.ok((await me.locator('#mermaid-code-revision-source').inputValue()).includes('quadrantChart'));
await me.locator('#raw-code-editor').fill('flowchart LR\nA[Original]-->B[Added]');await panel.getByRole('button',{name:'ME 수정 코드로 이 도표 교체',exact:true}).click();await page.waitForFunction(()=>editorTextarea.value.includes('B[Added]'));assert.ok(await page.evaluate(()=>undoFromReplaceStack()));
const out=path.resolve(root,'../artifacts/mermaid-content-20261125');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({cases:results,mePrepared:true,explicitReplace:true,undo:true},null,2));console.log('ME source/prompt preparation, explicit replacement and undo passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

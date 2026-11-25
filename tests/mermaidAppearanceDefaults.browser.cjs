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



await page.evaluate(()=>{updateContent('```mermaid\nxychart-beta\n x-axis [Jan, Feb]\n bar [20,40]\n```');if(isEditMode)toggleMode('view');});
await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper svg'));
const w=page.locator('#viewer .trt-mermaid-wrapper'),pencil=w.getByRole('button',{name:'도표 스타일 조절',exact:true});await pencil.click();
const panel=page.locator('.trt-mermaid-appearance-panel');assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),true);assert.equal(await panel.getAttribute('role'),'dialog');
for(const name of ['.trt-mermaid-custom','.trt-mermaid-custom2']){
 const group=panel.locator(name),fold=group.locator(':scope > .trt-custom-section-fold');assert.equal(await fold.evaluate(e=>e.open),false);await fold.locator(':scope > summary').click();assert.equal(await fold.evaluate(e=>e.open),true);
}
await panel.getByLabel('새 도구 이름',{exact:true}).fill('입력 보존');
await panel.getByRole('button',{name:'도표에 붙이기',exact:true}).click();assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),false);
await panel.getByRole('button',{name:'닫기',exact:true}).click();await pencil.click();assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),true);assert.equal(await panel.getByLabel('새 도구 이름',{exact:true}).inputValue(),'입력 보존');
await page.setViewportSize({width:390,height:844});const b=await panel.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);await panel.getByRole('button',{name:'닫기',exact:true}).click();await pencil.click();assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),true);
const out=path.resolve(root,'../artifacts/mermaid-panel-defaults-20261125');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'mobile.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({defaultFloating:true,bothInitiallyCollapsed:true,expandable:true,inputsPreserved:true,reopenFloating:true,mobile:b},null,2));console.log('Default floating, both collapsed sections, expand, attach/close/reopen, input preservation and mobile passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

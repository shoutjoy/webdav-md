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

const cases=['quadrantChart\n title Priority\n A: [0.2,0.5]','mindmap\n root((Plan))\n  Task\n  Test','---\nconfig:\n  theme: dark\n---\nkanban\n Todo\n  a[Work]','journey\n title Test\n section Phase\n  Work: 4: User'];
const results=[];
for(const code of cases){
 const original='# Preserve\n\n```mermaid\n'+code+'\n```\n\nTail';
 await page.evaluate(text=>{updateContent(text);if(isEditMode)toggleMode('view');},original);
 await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper svg'));
 const saved=await page.evaluate(async()=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper');w.__mdvMermaidAppearance={font:22,fill:'#aabbcc',pointSize:8,layoutSpacing:1.5,chartWidth:1.2};await MermaidAppearanceSource.apply(w);return editorTextarea.value;});
 assert.ok(saved.startsWith('# Preserve'));assert.ok(saved.endsWith('Tail'));const reset=await page.evaluate(text=>MermaidAppearanceSource.serialize(MermaidAppearanceSource.blocks(text)[0].code,{},[],0),saved);assert.equal(reset,code);
 await page.reload();await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceTypes&&window.InDbStorage?.getDatabase());
 await page.evaluate(text=>{updateContent(text);if(isEditMode)toggleMode('view');},saved);
 await page.waitForFunction(()=>document.querySelector('#viewer .trt-mermaid-wrapper svg'));
 const reopened=await page.evaluate(()=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper');return {type:MermaidAppearanceTypes.type(w.dataset.mermaidOriginalSource),a:w.__mdvMermaidAppearance};});
 const w=page.locator('#viewer .trt-mermaid-wrapper');await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();await w.getByRole('button',{name:'플로팅',exact:true}).click();const folder=path.resolve(root,'../artifacts/mermaid-types-20261125');fs.mkdirSync(folder,{recursive:true});await page.screenshot({path:path.join(folder,reopened.type+'-app.png')});assert.equal(reopened.a.font,22);assert.equal(reopened.a.pointSize,8);results.push(reopened);console.log('Source/reload PASS',reopened.type);
}
const out=path.resolve(root,'../artifacts/mermaid-types-20261125');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-result.json'),JSON.stringify(results,null,2));await page.screenshot({path:path.join(out,'app-reopened.png')});
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

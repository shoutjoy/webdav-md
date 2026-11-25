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
const code='%%{init: {"flowchart":{"htmlLabels":true},"themeVariables":{"primaryColor":"#abcdef"}}}%%\nflowchart LR\nA[Start] --> B{Decision}\nB --> C((End))';
const initial='# Test\n\n```mermaid\n'+code+'\n```\n\nUnrelated text\n\n```mermaid\n'+code+'\n```\n\nLast sentence';
await page.evaluate(text=>{currentFileName='appearance-source-test.md';updateContent(text);replaceUndoStack.length=0;replaceRedoStack.length=0;toggleMode('view');renderMarkdown({force:true});},initial);
await page.waitForFunction(()=>document.querySelectorAll('#viewer .trt-mermaid-wrapper svg').length===2).catch(async e=>{console.log(await page.evaluate(()=>({md:currentMarkdown,editor:editorTextarea.value,html:document.getElementById('viewer').innerHTML.slice(0,3000)})));throw e;});
let w=page.locator('#viewer .trt-mermaid-wrapper').nth(1);
await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();
for(let i=0;i<4;i++){await w.locator('button[title="연결선 길이 늘리기"]').click();await page.waitForFunction(()=>!document.querySelectorAll('#viewer .trt-mermaid-appearance-panel')[1].querySelector('button').disabled);}
await w.locator('button[title="도형 테두리 두께 늘리기"]').click();
await page.waitForFunction(()=>!document.querySelectorAll('#viewer .trt-mermaid-appearance-panel')[1].querySelector('button').disabled);
await w.getByLabel('도형 테두리 색상',{exact:true}).evaluate(e=>{e.value='#11aa44';e.dispatchEvent(new Event('change'));});
await page.waitForFunction(()=>!document.querySelectorAll('#viewer .trt-mermaid-appearance-panel')[1].querySelector('button').disabled);
assert.equal(await page.evaluate(()=>editorTextarea.value),initial);
await w.evaluate(e=>{e.__mdvMermaidAppearance={...e.__mdvMermaidAppearance,font:21,stroke:3,color:'#aa2233',width:1.4,fontWeight:700,fontFamily:'Consolas',fill:'#ee7722',alpha:0.4,textColor:'#2233cc',direction:'TD'};});
await w.getByRole('button',{name:'코드에 적용',exact:true}).click();
await page.waitForFunction(()=>editorTextarea.value.includes('MDPRO appearance start'));
await page.waitForFunction(()=>document.querySelectorAll('#viewer .trt-mermaid-wrapper svg').length===2).catch(async e=>{console.log(await page.evaluate(()=>({md:currentMarkdown,editor:editorTextarea.value,html:document.getElementById('viewer').innerHTML.slice(0,3000)})));throw e;});
const applied=await page.evaluate(()=>editorTextarea.value);
assert.ok(applied.startsWith(initial.slice(0,initial.indexOf('Unrelated text'))));assert.ok(applied.endsWith('Last sentence'));
assert.equal((applied.match(/MDPRO appearance start/g)||[]).length,1);
const undo=await page.evaluate(()=>{undoFromReplaceStack();const before=editorTextarea.value;redoFromReplaceStack();return before;});assert.equal(undo,initial);
await page.waitForFunction(()=>document.querySelectorAll('#viewer .trt-mermaid-wrapper svg').length===2).catch(async e=>{console.log(await page.evaluate(()=>({md:currentMarkdown,editor:editorTextarea.value,html:document.getElementById('viewer').innerHTML.slice(0,3000)})));throw e;});
assert.match(applied, /flowchart TD/);assert.match(applied, /"rankSpacing":100/);
assert.match(applied, /style A font-size:21px,stroke-width:1.5px,stroke:#11aa44,font-family:Consolas,font-weight:700,fill:#ee7722,fill-opacity:0.4,color:#2233cc/);
let rows=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=InDbStorage.getDatabase().transaction('mermaid_refs','readonly').objectStore('mermaid_refs').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.recordType==='mermaid_style_snapshot'));r.onerror=()=>reject(r.error);}));
const appliedCode=rows[0].afterCode;
assert.equal(rows.length,1);assert.equal(rows[0].code.trim(),code);assert.equal(rows[0].blockIndex,1);
const standalone=await page.evaluate(async source=>{
 const node=document.createElement('div');document.body.append(node);node.textContent=source;
 mermaid.initialize({startOnLoad:false,theme:'base',securityLevel:'loose'});await mermaid.run({nodes:[node]});
 const shape=node.querySelector('.node > rect'),edge=node.querySelector('.flowchart-link'),label=node.querySelector('.nodeLabel');
 const result={border:getComputedStyle(shape).strokeWidth,color:getComputedStyle(shape).stroke,edge:getComputedStyle(edge).strokeWidth,font:getComputedStyle(label).fontSize,maxWidth:label.parentElement.style.maxWidth,weight:getComputedStyle(label).fontWeight,family:getComputedStyle(label).fontFamily,fill:getComputedStyle(shape).fill,alpha:getComputedStyle(shape).fillOpacity,text:getComputedStyle(label).color};node.remove();return result;
},rows[0].afterCode);
assert.deepEqual(standalone,{border:'1.5px',color:'rgb(17, 170, 68)',edge:'3px',font:'21px',maxWidth:'280px',weight:'700',family:'Consolas',fill:'rgb(238, 119, 34)',alpha:'0.4',text:'rgb(34, 51, 204)'});

const styles=await page.locator('#viewer .trt-mermaid-wrapper').nth(1).locator('.node > rect,.node > polygon,.node > circle').evaluateAll(es=>es.map(e=>({width:getComputedStyle(e).strokeWidth,color:getComputedStyle(e).stroke})));
assert.equal(await page.locator('#viewer .trt-mermaid-wrapper').nth(1).locator('.nodeLabel').first().evaluate(e=>getComputedStyle(e).fontSize),'21px');
assert.equal(await page.locator('#viewer .trt-mermaid-wrapper').nth(1).locator('.flowchart-link').first().evaluate(e=>getComputedStyle(e).strokeWidth),'3px');
assert.ok(styles.every(s=>s.width==='1.5px'&&s.color==='rgb(17, 170, 68)'),JSON.stringify(styles));
// Reopen the document after a full reload: source and IndexedDB alone must restore the style/history.
await page.reload();await page.waitForFunction(()=>window.testAppReady&&window.MermaidAppearanceSource&&window.InDbStorage?.getDatabase());
await page.evaluate(text=>{currentFileName='appearance-source-test.md';updateContent(text);replaceUndoStack.length=0;replaceRedoStack.length=0;toggleMode('view');renderMarkdown({force:true});},applied);
await page.waitForFunction(()=>document.querySelectorAll('#viewer .trt-mermaid-wrapper svg').length===2).catch(async e=>{console.log(await page.evaluate(()=>({md:currentMarkdown,editor:editorTextarea.value,html:document.getElementById('viewer').innerHTML.slice(0,3000)})));throw e;});
w=page.locator('#viewer .trt-mermaid-wrapper').nth(1);
assert.equal(await w.locator('.node > rect').first().evaluate(e=>getComputedStyle(e).stroke),'rgb(17, 170, 68)');
await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();assert.equal(await w.evaluate(e=>e.__mdvMermaidAppearance.font),21);assert.equal(await w.evaluate(e=>e.__mdvMermaidAppearance.edgeLength),2);
await w.getByRole('button',{name:'변경 기록',exact:true}).click();
await w.locator('.trt-mermaid-source-history summary').first().click();
fs.mkdirSync(path.join(root,'../artifacts/mermaid-source-20261125'),{recursive:true});
await page.screenshot({path:path.join(root,'../artifacts/mermaid-source-20261125/history.png')});
await w.getByRole('button',{name:'이 코드로 복원',exact:true}).first().click();
await page.waitForFunction(text=>editorTextarea.value===text,initial);
await page.waitForFunction(()=>document.querySelectorAll('#viewer .trt-mermaid-wrapper svg').length===2).catch(async e=>{console.log(await page.evaluate(()=>({md:currentMarkdown,editor:editorTextarea.value,html:document.getElementById('viewer').innerHTML.slice(0,3000)})));throw e;});
// A durable restore also backs up the state it replaces.
rows=await page.evaluate(()=>new Promise(resolve=>{const r=InDbStorage.getDatabase().transaction('mermaid_refs','readonly').objectStore('mermaid_refs').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.recordType==='mermaid_style_snapshot'));}));assert.equal(rows.length,2);
w=page.locator('#viewer .trt-mermaid-wrapper').nth(1);await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();await w.getByRole('button',{name:'변경 기록',exact:true}).click();
const history=w.locator('.trt-mermaid-source-history');await history.locator('summary').first().click();const remove=history.getByRole('button',{name:'삭제',exact:true}).first();
assert.ok((await remove.boundingBox()).x>(await history.getByRole('button',{name:'이 코드로 복원',exact:true}).first().boundingBox()).x);
await page.evaluate(()=>{window.testOriginalDelete=deleteFeatureRecordFromInDb;window.deleteFeatureRecordFromInDb=async()=>false;});await remove.click();assert.equal(await history.locator('details').count(),2);assert.match(await history.locator('[role=status]').textContent(),/삭제 실패/);
await page.evaluate(()=>{window.deleteFeatureRecordFromInDb=window.testOriginalDelete;});await remove.click();await history.locator('details').nth(1).waitFor({state:'detached'});assert.equal(await history.locator('details').count(),1);
assert.equal(await page.evaluate(()=>editorTextarea.value),initial);
const remaining=await page.evaluate(()=>new Promise(resolve=>{const r=InDbStorage.getDatabase().transaction('mermaid_refs','readonly').objectStore('mermaid_refs').getAll();r.onsuccess=()=>resolve(r.result.filter(x=>x.recordType==='mermaid_style_snapshot').length);}));assert.equal(remaining,1);

// Storage failure and stale asynchronous operations may never change source.
const failures=await page.evaluate(async()=>{
 const w=document.querySelectorAll('#viewer .trt-mermaid-wrapper')[1];w.__mdvMermaidAppearance={font:19};
 const save=window.saveFeatureRecordToInDb,before=editorTextarea.value;let dbError=false,stale=false;
 window.saveFeatureRecordToInDb=async()=>false;
 try{await MermaidAppearanceSource.apply(w)}catch(e){dbError=/저장/.test(e.message)}
 if(editorTextarea.value!==before)throw Error('DB failure changed source');
 window.saveFeatureRecordToInDb=async()=>{editorTextarea.value=before+'\nManual edit';currentMarkdown=editorTextarea.value;return true};
 try{await MermaidAppearanceSource.apply(w)}catch(e){stale=/변경/.test(e.message)}
 window.saveFeatureRecordToInDb=save;return {dbError,stale,manualPreserved:editorTextarea.value===before+'\nManual edit'};
});assert.deepEqual(failures,{dbError:true,stale:true,manualPreserved:true});
const out=path.join(root,'../artifacts/mermaid-source-20261125');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'applied.mmd'),appliedCode);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({sourceApplied:true,duplicateSecondOnly:true,styles,standalone,undoRedo:true,persistentHistoryAfterReload:true,restoreBackedUp:true,deleteOneRecord:true,deleteFailurePreserved:true,failures},null,2));
console.log('Source apply, duplicate targeting, fresh reload rendering, durable restore, storage failure and stale edits passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

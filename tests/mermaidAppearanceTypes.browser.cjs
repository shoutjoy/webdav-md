const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../mdpro');
(async()=>{const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/dist/mermaid.min.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.MERMAID_TEST_SCRIPT || path.resolve(root,'../../check/pv-mermaid-proof/mermaid.min.js'))}));await page.goto('http://127.0.0.1:'+server.address().port+'/tests/fixtures/empty.html');await page.setContent('<textarea id="background" aria-label="배경 문서" style="width:200px;height:80px"></textarea><div id="main-workspace" style="display:flex;height:850px;position:relative"><main id="viewer" class="order-2" style="flex:1;min-width:0;overflow:auto"></main></div>');await page.evaluate(()=>localStorage.setItem('md_viewer_mermaid_display_mode','fixed'));
for(const f of ['js/mermaid/mermaid-editor/image-export.js','js/mermaid/appearance-custom.js','js/mermaid/appearance-types.js','js/mermaid/appearance-panel.js','js/mermaid/appearance-source.js','js/mermaid/mermaid_render.js'])await page.addScriptTag({url:'/'+f});

const sampleFile=fs.readFileSync(path.join(root,'js/mermaid/mermaid-editor/app.js'),'utf8');
const results=[];
for(const key of ['quadrant','mindmap','kanban','journey','sequence','pie','timeline','xychart','er','class']) {
 const match=sampleFile.match(new RegExp('(?:^|\\n)  '+key+':\\s*`([\\s\\S]*?)`','m'));
 if(!match)continue;
 const code=match[1];
 await page.evaluate(async code=>{const v=document.querySelector('#viewer');v.replaceChildren();const pre=document.createElement('pre'),c=document.createElement('code');c.className='language-mermaid';c.textContent=code;pre.append(c);v.append(pre);await MermaidTRT.renderIn(v);},code);
 const w=page.locator('.trt-mermaid-wrapper'),panel=page.locator('.trt-mermaid-appearance-panel');
 await w.getByRole('button',{name:'도표 스타일 조절',exact:true}).click();
 await panel.locator('button[title="글자 늘리기"]').click();
 await page.waitForFunction(()=>!document.querySelector('.trt-mermaid-category button').disabled);
 const beforeControl=await w.locator('svg').getAttribute('viewBox');
 if(['quadrant','xychart'].includes(key)) {await panel.locator('button[title="차트 너비 늘리기"]').click();}
 else if(['mindmap','kanban','journey','sequence','timeline'].includes(key)) {await panel.locator('button[title="'+(key==='kanban'?'열 배치 배율':key==='timeline'?'도표 여백':'배치 간격')+' 늘리기"]').click();}
 if(['quadrant','xychart','mindmap','kanban','journey','sequence','timeline'].includes(key)) {
  await page.waitForFunction(()=>!document.querySelector('.trt-mermaid-category button').disabled);
  assert.notEqual(await w.locator('svg').getAttribute('viewBox'),beforeControl,key+' control did not change layout');
 }
 const state=await w.evaluate(async w=>{
  const source=w.getAttribute('data-mermaid-original-source'),beforeBox=w.querySelector('svg').getAttribute('viewBox'),beforeEye=Array.from(w.querySelectorAll('circle')).filter(e=>!e.getAttribute('class')).map(e=>e.getAttribute('r')),a={font:20,fontWeight:700,textColor:'#112233',fill:'#eedd99',nodeColor:'#aa2233',nodeStroke:3,stroke:4,color:'#2255aa',alpha:.6,pointSize:9,chartWidth:1.3,chartHeight:1.2,width:1.3,layoutSpacing:2};
  w.__mdvMermaidAppearance=a;await MermaidTRT.setTheme('light',w);
  const saved=MermaidAppearanceSource.serialize(source,a,[],0);await MermaidTRT.validateSource(saved);
  const clean=MermaidAppearanceSource.serialize(saved,{},[],0);
  if(clean!==source.replace(/\r?\n$/,''))throw Error('reset altered '+source.slice(0,20));
  const svg=w.querySelector('svg');const shape=Array.from(svg.querySelectorAll('rect,circle,path')).find(e=>!e.closest('defs,marker,clipPath'));
  return {type:MermaidAppearanceTypes.type(source),saved,appearance:MermaidAppearanceSource.readAppearance(saved),shape:shape?{fill:getComputedStyle(shape).fill,stroke:getComputedStyle(shape).stroke,opacity:getComputedStyle(shape).fillOpacity}:null,text:svg.querySelector('text,.nodeLabel,foreignObject div')?getComputedStyle(svg.querySelector('text,.nodeLabel,foreignObject div')).fontSize:null,beforeBox,afterBox:svg.getAttribute('viewBox'),eyeRadii:Array.from(w.querySelectorAll('circle')).filter(e=>!e.getAttribute('class')).map(e=>e.getAttribute('r')),beforeEye,pointRadii:Array.from(svg.querySelectorAll('.data-point circle')).map(e=>e.getAttribute('r')),styledShapes:Array.from(svg.querySelectorAll('rect,circle,ellipse,polygon,path')).filter(e=>getComputedStyle(e).fill==='rgb(238, 221, 153)' && !e.closest('defs,marker,clipPath')).length,svg:svg.outerHTML.slice(0,200)};
 });
 assert.equal(state.appearance.pointSize,9);assert.ok(state.styledShapes>0,key+' shape styles');if(key==='quadrant')assert.ok(state.pointRadii.length&&state.pointRadii.every(r=>r==='9'));const exported=await w.evaluate(async w=>{const r=await MermaidTRT.exportWrapperImage(w,'png');return r.width>0&&r.height>0;});assert.ok(exported,key+' PNG');assert.equal(state.text,'20px',key);if(['quadrant','xychart','kanban','journey','sequence','mindmap'].includes(key))assert.notEqual(state.beforeBox,state.afterBox,key+' layout unchanged');if(key==='journey')assert.deepEqual(state.eyeRadii,state.beforeEye,'face anatomy must remain unchanged');assert.ok(state.shape,key);results.push({key,...state});
 console.log('PASS',key,state.text,state.shape);
}
const out=path.resolve(root,'../artifacts/mermaid-types-20261125');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));await page.screenshot({path:path.join(out,'last.png')});assert.ok(results.length>=8);
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});

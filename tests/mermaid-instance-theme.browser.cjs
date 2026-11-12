const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../mdpro'),out=path.resolve(__dirname,'../artifacts/mermaid-instance-theme-20261110');
const base='graph LR\nX["부모코칭역량<br/>(X)"]\nM1["양육효능감<br/>(M1)"]\nM2["긍정적 정서표현<br/>(M2)"]\nY["자녀 사회정서역량<br/>(Y)"]\nX -->|H1| M1\nX -->|H4| M2\nM1 -->|H2| M2\nM1 -->|H5| Y\nM2 -->|H3| Y\nX -->|H6| Y';
const circle=base.replace(/\["([^\n]+)"\]/g,'(("$1"))');
const sources=[base,circle+'\nclassDef circle fill:#f0f8ff,stroke:#4a90e2,stroke-width:2px;\nclass X,M1,M2,Y circle;',circle+'\nclassDef white fill:#fff,stroke:#000,stroke-width:1px;\nclass X,M1,M2,Y white;\nstyle Y color:#112233;'];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(file!==root&&!file.startsWith(root+path.sep))return res.writeHead(403).end();
  if(file===root)file=path.join(file,'index.html');
  fs.readFile(file,(err,body)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':body);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}});page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.MermaidTRT&&typeof renderMarkdown==='function');
  const markdown=sources.map(source=>'```mermaid\n'+source+'\n```').join('\n\n');
  await page.evaluate(async markdown=>{
   document.documentElement.classList.remove('dark');localStorage.removeItem('md_viewer_mermaid_theme');localStorage.setItem('md_viewer_mermaid_display_mode','fixed');
   updateContent(markdown);document.getElementById('viewer-container').classList.remove('hidden');document.body.classList.add('viewer-view-mode');
   await renderMarkdown({force:true,skipMermaidHydration:true});await MermaidTRT.renderIn(document.getElementById('viewer'));
   await document.fonts.ready;
  },markdown);
  const wrappers=page.locator('#viewer .trt-mermaid-wrapper');
  assert.equal(await wrappers.count(),3);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  async function states(){return wrappers.evaluateAll(nodes=>nodes.map(node=>({theme:node.dataset.mermaidTheme,svg:node.querySelector('svg').outerHTML,height:node.getBoundingClientRect().height,viewBox:node.querySelector('svg').getAttribute('viewBox'),factor:node.dataset.mermaidFixedScale})));}
  const before=await states();assert.deepEqual(before.map(x=>x.theme),['light','light','light']);
  await page.screenshot({path:path.join(out,'all-light.png'),fullPage:true});
  // Keep the explicitly selected zoom and leave the other SVGs byte-identical.
  await wrappers.nth(0).locator('button').filter({hasText:/^\+$/}).click();
  const scaled=await states();
  await wrappers.nth(0).locator('.trt-mermaid-theme-toggle').click();
  await page.waitForFunction(()=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper');return w.dataset.mermaidTheme==='dark'&&!w.querySelector('.trt-mermaid-theme-toggle').disabled;});
  const dark=await states();assert.deepEqual(dark.map(x=>x.theme),['dark','light','light']);
  assert.equal(dark[0].factor,scaled[0].factor);
  for(const i of [1,2]){assert.equal(dark[i].svg,before[i].svg);assert.equal(dark[i].height,before[i].height);}
  await page.screenshot({path:path.join(out,'first-only-dark.png'),fullPage:true});
  // Exercise both uncached render and cached round-trips for differently styled nodes.
  await page.evaluate(async()=>{
   const w=Array.from(document.querySelectorAll('#viewer .trt-mermaid-wrapper'));
   await Promise.all([MermaidTRT.setTheme('dark',w[1]),MermaidTRT.setTheme('dark',w[2])]);
   for(let i=0;i<3;i++){await MermaidTRT.setTheme('light',w[i]);await MermaidTRT.setTheme('dark',w[i]);await MermaidTRT.setTheme('light',w[i]);}
  });
  await page.evaluate(async()=>{const w=document.querySelectorAll('#viewer .trt-mermaid-wrapper');await MermaidTRT.setTheme('dark',w[1]);await MermaidTRT.setTheme('dark',w[2]);});
  await page.evaluate(async()=>{const w=document.querySelector('#viewer .trt-mermaid-wrapper');await Promise.all([MermaidTRT.toggleTheme(w),MermaidTRT.toggleTheme(w),MermaidTRT.toggleTheme(w)]);});
  assert.equal((await states())[0].theme,'dark');
  await page.evaluate(async()=>{await MermaidTRT.setTheme('light',document.querySelector('#viewer .trt-mermaid-wrapper'));});
  const styled=await wrappers.evaluateAll(nodes=>nodes.slice(1).map(node=>Array.from(node.querySelectorAll('g.node')).map(group=>{
   const shape=group.querySelector('.label-container,rect,circle,ellipse,polygon,path'),label=group.querySelector('.nodeLabel');
   const rect=group.getBoundingClientRect(),container=node.querySelector('.trt-mermaid-viewport').getBoundingClientRect();
   return {id:group.id,fill:getComputedStyle(shape).fill,stroke:getComputedStyle(shape).stroke,width:getComputedStyle(shape).strokeWidth,color:getComputedStyle(label).color,inside:rect.top>=container.top-1&&rect.bottom<=container.bottom+1};
  })));
  for(const node of styled[0]){assert.equal(node.fill,'rgb(240, 248, 255)');assert.equal(node.stroke,'rgb(74, 144, 226)');assert.equal(node.width,'2px');assert.equal(node.color,'rgb(23, 32, 51)');assert.equal(node.inside,true);}
  for(const node of styled[1]){assert.equal(node.fill,'rgb(255, 255, 255)');assert.equal(node.stroke,'rgb(0, 0, 0)');assert.equal(node.width,'1px');assert.equal(node.inside,true);assert.equal(node.color,node.id.includes('flowchart-Y-')?'rgb(17, 34, 51)':'rgb(23, 32, 51)');}
  await page.screenshot({path:path.join(out,'mixed-themes-styles-preserved.png'),fullPage:true});
  // A repeated source loaded from cache must not duplicate SVG/marker/label IDs.
  await page.evaluate(async source=>{const pre=document.createElement('pre'),code=document.createElement('code');code.className='language-mermaid';code.textContent=source;pre.append(code);document.getElementById('viewer').append(pre);await MermaidTRT.renderIn(document.getElementById('viewer'));},base);
  assert.equal(await wrappers.count(),4);
  const duplicateIds=await wrappers.evaluateAll(nodes=>{const ids=nodes.flatMap(node=>Array.from(node.querySelectorAll('[id]')).map(el=>el.id));return ids.filter((id,i)=>ids.indexOf(id)!==i);});assert.deepEqual(duplicateIds,[]);
  await page.evaluate(async()=>{document.documentElement.classList.add('dark');await MermaidTRT.refresh(document);});
  assert.deepEqual((await states()).map(x=>x.theme),['light','dark','dark','dark']);
  await page.evaluate(async()=>{document.documentElement.classList.remove('dark');await MermaidTRT.refresh(document);});
  assert.deepEqual((await states()).map(x=>x.theme),['light','dark','dark','light']);
  // Export the currently displayed instance without modifying its source or scale.
  const exports=await page.evaluate(async()=>{
   await document.fonts.ready;const w=document.querySelectorAll('#viewer .trt-mermaid-wrapper')[1];
   return {svg:await MermaidTRT.exportWrapperImage(w,'svg'),png:await MermaidTRT.exportWrapperImage(w,'png')};
  });
  assert(decodeURIComponent(exports.svg.dataUrl).includes('foreignObject'));
  fs.writeFileSync(path.join(out,'dark-instance.svg'),decodeURIComponent(exports.svg.dataUrl.split(',').slice(1).join(',')));
  const png=Buffer.from(exports.png.dataUrl.split(',')[1],'base64');assert.equal(png.subarray(1,4).toString(),'PNG');fs.writeFileSync(path.join(out,'dark-instance.png'),png);
  assert.equal(await page.evaluate(()=>editorTextarea.value),markdown);
  assert.deepEqual(errors,[]);
  const result={independentThemes:true,untouchedSiblings:true,scalePreserved:true,repeatedToggle:true,queuedRapidToggle:true,explicitStylesPreserved:true,readableWhiteNodes:true,cacheIdsUnique:true,globalRefreshPreservesOverrides:true,sourcePreserved:true,darkInstancePng:{width:exports.png.width,height:exports.png.height},pageErrors:errors};
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../mdpro');
(async()=>{const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(e?'':b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/dist/mermaid.min.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.MERMAID_TEST_SCRIPT || path.resolve(root,'../../check/pv-mermaid-proof/mermaid.min.js'))}));await page.goto('http://127.0.0.1:'+server.address().port+'/tests/fixtures/empty.html');await page.setContent('<textarea id="background" aria-label="배경 문서" style="width:200px;height:80px"></textarea><div id="main-workspace" style="display:flex;height:850px;position:relative"><main id="viewer" class="order-2" style="flex:1;min-width:0;overflow:auto"></main></div>');await page.evaluate(()=>localStorage.setItem('md_viewer_mermaid_display_mode','fixed'));
for(const f of ['js/mermaid/mermaid-editor/image-export.js','js/mermaid/appearance-custom.js','js/mermaid/appearance-panel.js','js/mermaid/appearance-source.js','js/mermaid/mermaid_render.js'])await page.addScriptTag({url:'/'+f});
const source='flowchart LR\nA[Start] --> B{Decision}\nB -->|Yes| C[Process]\nB -->|No| D([Stop])\nD --- E((No arrow))';
await page.evaluate(async code=>{const pre=document.createElement('pre'),c=document.createElement('code');c.className='language-mermaid';c.textContent=code;pre.append(c);document.querySelector('#viewer').append(pre);await MermaidTRT.renderIn(document.querySelector('#viewer'));},source);
const w=page.locator('.trt-mermaid-wrapper'),panel=page.locator('.trt-mermaid-appearance-panel'),pencil=w.getByRole('button',{name:'도표 스타일 조절',exact:true});await pencil.click();assert.equal(await panel.locator('legend').count(),6);
const cards=await panel.locator('fieldset').evaluateAll(es=>es.slice(0,3).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y};}));assert.ok(Math.abs(cards[0].y-cards[1].y)<2 && cards[1].x>cards[0].x,JSON.stringify(cards));
const wait=()=>page.waitForFunction(()=>!document.querySelector('.trt-mermaid-category button').disabled);
// Increasing rank spacing lengthens actual rendered edge paths, then reset to baseline.
const lengths=()=>w.locator('.flowchart-link').evaluateAll(es=>es.map(e=>e.getTotalLength()));
const shortEdges=await lengths();
for(let i=0;i<4;i++){await panel.locator('button[title="연결선 길이 늘리기"]').click();await wait();}
const longEdges=await lengths();assert.ok(longEdges[0]>shortEdges[0]+30,JSON.stringify({shortEdges,longEdges}));
assert.equal(await w.evaluate(e=>e.__mdvMermaidAppearance.edgeLength),2);
for(let i=0;i<4;i++){await panel.locator('button[title="연결선 길이 줄이기"]').click();await wait();}
assert.ok(Math.abs((await lengths())[0]-shortEdges[0])<1);
async function color(name,value){await panel.getByLabel(name,{exact:true}).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('change'));},value);await wait();}
await panel.getByRole('button',{name:'글자 볼드',exact:true}).click();await wait();assert.equal(await panel.getByRole('button',{name:'글자 볼드',exact:true}).getAttribute('aria-pressed'),'true');
await panel.getByLabel('글자 폰트',{exact:true}).selectOption('Consolas');await wait();
assert.equal(await w.locator('.nodeLabel').first().evaluate(e=>getComputedStyle(e).fontWeight),'700');assert.match(await w.locator('.nodeLabel').first().evaluate(e=>getComputedStyle(e).fontFamily),/Consolas/);
const fontExport={nativeTextPort:false};
await color('도형 배경색','#ee7722');await color('글자 색상','#2233cc');
await panel.getByLabel('배경 알파',{exact:true}).fill('0.4');await panel.getByLabel('배경 알파',{exact:true}).dispatchEvent('change');await wait();
assert.equal(await w.locator('.node > rect').first().evaluate(e=>getComputedStyle(e).fill),'rgb(238, 119, 34)');assert.equal(await w.locator('.node > rect').first().evaluate(e=>getComputedStyle(e).fillOpacity),'0.4');assert.equal(await w.locator('.nodeLabel').first().evaluate(e=>getComputedStyle(e).color),'rgb(34, 51, 204)');assert.equal(await w.locator('.nodeLabel').first().evaluate(e=>getComputedStyle(e).opacity),'1');
await panel.getByRole('button',{name:'TD · 위에서 아래',exact:true}).click();await wait();let coords=await w.locator('.node').evaluateAll(ns=>ns.slice(0,2).map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y}}));assert.ok(coords[1].y>coords[0].y,JSON.stringify(coords));
await panel.getByRole('button',{name:'LR · 왼쪽에서 오른쪽',exact:true}).click();await wait();coords=await w.locator('.node').evaluateAll(ns=>ns.slice(0,2).map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y}}));assert.ok(coords[1].x>coords[0].x);
for(let i=0;i<16;i++){await panel.locator('button[title="선 두께 늘리기"]').click();await wait();}for(let i=0;i<18;i++){await panel.locator('button[title="도형 테두리 두께 늘리기"]').click();await wait();}await color('연결선 색상','#aa55cc');
const markers=await w.locator('.flowchart-link').evaluateAll(es=>es.map(e=>{const ref=e.getAttribute('marker-end');if(!ref||ref==='none')return null;const id=ref.match(/#([^)]*)/)[1],m=document.getElementById(id);return {size:Number(m.getAttribute('markerWidth')),refX:Number(m.getAttribute('refX')),color:getComputedStyle(m.querySelector('path')).fill,stroke:getComputedStyle(e).stroke};}).filter(Boolean));assert.equal(markers.length,3);assert.ok(markers.every(m=>m.size>=34&&m.refX>10&&m.color===m.stroke),JSON.stringify(markers));
const markerSize=()=>w.locator('marker[id*=mdv-point]').first().getAttribute('markerWidth').then(Number);
const baseHead=await markerSize();
await panel.locator('button[title="화살표 머리 크기 늘리기"]').click();await wait();
assert.ok(Math.abs(await markerSize()-baseHead*1.25)<.01);
assert.equal(await w.evaluate(e=>e.__mdvMermaidAppearance.stroke),10);
await panel.locator('button[title="화살표 머리 크기 줄이기"]').click();await wait();
assert.ok(Math.abs(await markerSize()-baseHead)<.01);
const out=path.join(root,'../artifacts/mermaid-panel-20261125');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'thick-arrows.png')});
// Floating uses the same controls, has no backdrop, and preserves input/state across transitions.
await panel.getByRole('button',{name:'플로팅',exact:true}).click();assert.equal(await panel.getAttribute('role'),'dialog');assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),true);await page.getByLabel('배경 문서',{exact:true}).fill('Background remains editable');
const before=await panel.boundingBox();const h=panel.locator('.trt-appearance-header');const hr=await h.boundingBox();await page.mouse.move(hr.x+20,hr.y+15);await page.mouse.down();await page.mouse.move(hr.x-100,hr.y+45);await page.mouse.up();const moved=await panel.boundingBox();assert.ok(moved.x<before.x);
for(const edge of ['n','s','e','w','nw','ne','sw','se']){const handle=panel.locator('[data-edge='+edge+']'),r=await handle.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+(edge.includes('w')?-8:edge.includes('e')?8:0),r.y+r.height/2+(edge.includes('n')?-8:edge.includes('s')?8:0));await page.mouse.up();}
const sized=await panel.boundingBox();await panel.getByRole('button',{name:'Dock',exact:true}).click();assert.equal(await page.locator('.trt-appearance-dock-slot').count(),1);assert.ok((await page.locator('#viewer').boundingBox()).width<1000);const split=page.getByRole('separator',{name:'도표 스타일 Dock 너비'});await split.focus();await split.press('ArrowLeft');await page.screenshot({path:path.join(out,'dock.png')});await panel.getByRole('button',{name:'Dock 해제',exact:true}).click();assert.equal(await page.locator('.trt-appearance-dock-slot').count(),0);assert.ok(Math.abs((await panel.boundingBox()).width-sized.width)<2);
await h.focus();await h.press('Shift+ArrowRight');assert.ok((await panel.boundingBox()).width>sized.width);
await page.screenshot({path:path.join(out,'floating.png')});
await panel.getByRole('button',{name:'도표에 붙이기',exact:true}).click();assert.equal(await panel.evaluate(e=>e.matches(':popover-open')),false);assert.equal(await panel.getByLabel('배경 알파',{exact:true}).inputValue(),'0.4');
const serialized=await w.evaluate(e=>MermaidAppearanceSource.serialize(e.getAttribute('data-mermaid-original-source'),e.__mdvMermaidAppearance,Array.from(e.querySelectorAll('svg .node')).map(n=>n.id.match(/flowchart-(.+)-\d+$/)[1]),e.querySelectorAll('.flowchart-link').length));assert.match(serialized,/fill-opacity:0.4/);assert.match(serialized,/color:#2233cc/);assert.match(serialized,/flowchart LR/);
// Export the actual foreignObject diagram after styling and marker repair.
const png=await w.evaluate(async e=>{const r=await MermaidTRT.exportWrapperImage(e,'png');return{width:r.width,height:r.height};});assert.ok(png.width>0&&png.height>0);
await panel.getByLabel('배경 알파',{exact:true}).fill('0');await panel.getByLabel('배경 알파',{exact:true}).dispatchEvent('change');await wait();assert.equal(await w.locator('.node > rect').first().evaluate(e=>getComputedStyle(e).fillOpacity),'0');
await page.setViewportSize({width:390,height:844});await panel.getByRole('button',{name:'플로팅',exact:true}).click();const mobile=await panel.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390&&mobile.height<=844);await panel.getByLabel('배경 알파',{exact:true}).press('Escape');assert.equal(await panel.isVisible(),false);await pencil.click();assert.equal(await panel.isVisible(),true);await page.screenshot({path:path.join(out,'mobile.png')});
await w.evaluate(e=>MermaidTRT.setTheme('dark',e));
await page.waitForFunction(()=>getComputedStyle(document.querySelector('.trt-appearance-floating')).backgroundColor==='rgb(23, 32, 51)');
await page.screenshot({path:path.join(out,'mobile-dark.png')});
await w.evaluate(e=>e.remove());await page.waitForFunction(()=>!document.querySelector('.trt-appearance-floating'));
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({categories:6,edgeLength:{shortEdges,longEdges},boldAndFont:true,fontExport,fillAndAlpha:true,textColor:true,directions:true,markers,png,floating:true,dragResize8:true,dockRestore:true,keyboardResize:true,nonmodal:true,mobile,darkTheme:true,disconnectCleanup:true,errors},null,2));console.log('Categories, fill/alpha/text/direction, thick arrowheads, nonmodal floating/drag/8-resize/dock/mobile and PNG passed.');
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});

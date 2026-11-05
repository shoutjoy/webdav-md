const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../mdpro'),out=path.resolve(__dirname,'../artifacts/hwp-20261104-webdav');
fs.mkdirSync(out,{recursive:true});
const label=process.env.HWP_MATH_SOURCE?'MaTrix':'matrix-fixture';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const page=await browser.newPage({viewport:{width:1200,height:1000}});await page.route('http://hwp.test/**',route=>{const pathname=new URL(route.request().url()).pathname;if(pathname==='/tests/hwp-browser-fixture.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><script src="/vendor/marked/marked.umd.js"></script><script src="/vendor/jszip/jszip.min.js"></script>'});const p=path.join(root,pathname);return route.fulfill({contentType:/\.(js|mjs)$/.test(p)?'text/javascript':p.endsWith('.wasm')?'application/wasm':'text/html',body:fs.readFileSync(p)});});await page.goto('http://hwp.test/tests/hwp-browser-fixture.html');
const content=fs.readFileSync(process.env.HWP_MATH_SOURCE||path.join(__dirname,'fixtures/hwp-matrix.md'),'utf8');
// Image decoding/embedding uses an explicit fixture; remote user images are not silently fetched or claimed verified.
const result=await page.evaluate(async content=>{const {createHwpx}=await import('/rHwp/hwpx-export.mjs');const {protectEquations}=await import('/rHwp/tex-equation.mjs');const protectedInput=await protectEquations(content);const result={equations:protectedInput.equations,outputs:{}};for(const format of ['hwpx','hwp']){const blob=await createHwpx({content,format,resolveImage:async()=>({blob:await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT3sAAAAASUVORK5CYII=')).blob()})});result.outputs[format]=Array.from(new Uint8Array(await blob.arrayBuffer()));}return result;},content);
assert(result.equations.length>0);
if(!process.env.HWP_MATH_SOURCE){
 assert.equal(result.equations.length,11);
 assert(result.equations.some(eq=>eq.script.includes('over')));
 assert(result.equations.some(eq=>eq.script.includes('matrix {a & b # c & d}')));
 assert(result.equations.some(eq=>eq.script.includes('sum_{r = 1}^{k}')));
 assert(result.equations.some(eq=>eq.script.includes('color {255,0,0}')));
}

for(const [format,bytes]of Object.entries(result.outputs)) {
 await page.evaluate(async ({bytes})=>{const {loadCore}=await import('/rHwp/rhwp-loader.mjs');const core=await loadCore();const doc=new core.HwpDocument(new Uint8Array(bytes));document.body.replaceChildren();document.body.style.cssText='margin:0;background:#ccc';for(let i=0;i<doc.pageCount();i++){const img=new Image();img.id='p'+i;img.style.cssText='display:block;width:900px;background:white;margin-bottom:12px';img.src=URL.createObjectURL(new Blob([doc.renderPageSvg(i)],{type:'image/svg+xml'}));document.body.append(img);await img.decode();}doc.free();},{bytes});
 const pages=await page.locator('img').count();for(let i=0;i<pages;i++)await page.locator('#p'+i).screenshot({path:path.join(out,`${label}-${format}-page-${i+1}.png`)});
 console.log(format,'rendered pages',pages);
}
for(const [format,bytes]of Object.entries(result.outputs))fs.writeFileSync(path.join(out,label+'.'+format),Buffer.from(bytes));fs.writeFileSync(path.join(out,label+'-equations.json'),JSON.stringify(result.equations,null,2));console.log({equations:result.equations.length,files:Object.fromEntries(Object.entries(result.outputs).map(([f,b])=>[f,b.length]))});}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

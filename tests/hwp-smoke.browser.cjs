const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../mdpro');
const artifacts = path.resolve(__dirname, '../artifacts/hwp-20261104-webdav');
fs.mkdirSync(artifacts, {recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context = await browser.newContext({viewport:{width:1100,height:850},acceptDownloads:true});
  await context.route('http://hwp.test/**', route => {
   const pathname = new URL(route.request().url()).pathname;
   if (pathname === '/tests/hwp-browser-fixture.html') return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><base href="/"><script src="/vendor/marked/marked.umd.js"></script><script src="/vendor/jszip/jszip.min.js"></script><main id="drop-zone" style="height:95vh"></main>'});
   const p = path.join(root, pathname);
   if (!fs.existsSync(p)) return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:/\.(mjs|js)$/.test(p)?'text/javascript':p.endsWith('.wasm')?'application/wasm':p.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(p)});
  });
  const page = await context.newPage();
  await page.goto('http://hwp.test/tests/hwp-browser-fixture.html');
  const result = await page.evaluate(async () => {
   const {createHwpx} = await import('/rHwp/hwpx-export.mjs');
   const {loadCore,checkInput} = await import('/rHwp/rhwp-loader.mjs');
   const core = await loadCore();
   const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT3sAAAAASUVORK5CYII=';
   const content = '* **개인 수준:** 직무 만족도 © 😀\n* **집단 수준:** 팀 역학\n  * **세부 항목:** 의사소통 → 행동\n\n`&#8226;`\n\n# 한글 제목\n\n본문 **굵게** *기울임*\n\n3. 셋째\n4. 넷째\n\n|가|나|\n|--|--|\n|다|라|\n\n![그림]('+image+')\n\n`result$points`\n\n'+Array.from({length:80},(_,i)=>`문단 ${i} 가나다 본문을 확인합니다.\n\n`).join('');
   const outputs = {};
   for (const format of ['hwp','hwpx']) {
    const blob = await createHwpx({content,format});
    const bytes = new Uint8Array(await blob.arrayBuffer()); checkInput(bytes,'sample.'+format);
    const doc = new core.HwpDocument(bytes);
    outputs[format]={bytes:Array.from(bytes),pages:doc.pageCount(),text:JSON.parse(doc.getTextFileUnicode())}; doc.free();
   }
   const rejected = [];
   for (const content of ['$\\unsupportedcommand{x}$','```mermaid\ngraph TD; A-->B\n```','<iframe src="bad"></iframe>','- [x] 완료']) {
    try {await createHwpx({content});rejected.push(false);} catch {rejected.push(true);}
   }
   const lossDetected=[];
   const originalText=core.HwpDocument.prototype.getTextFileUnicode;
   for(const corrupt of [text=>text.replace('검증',''),text=>text+'중복']) {
    try {
     core.HwpDocument.prototype.getTextFileUnicode=function(){return JSON.stringify(corrupt(JSON.parse(originalText.call(this))));};
     try {await createHwpx({content:'본문 보존 검증'});lossDetected.push(false);} catch(e) {lossDetected.push(e.message.includes('누락 또는 중복'));}
    } finally {core.HwpDocument.prototype.getTextFileUnicode=originalText;}
   }
   return {outputs,rejected,lossDetected};
  });
  assert(result.rejected.every(Boolean));
  assert(result.lossDetected.every(Boolean),'actual omissions and duplication must remain blocked');
  for (const format of ['hwp','hwpx']) {
   assert(result.outputs[format].pages > 1);
   assert.match(result.outputs[format].text,/3\. 셋째/);
   assert.match(result.outputs[format].text,/result\$points/);
   assert.match(result.outputs[format].text,/• 개인 수준: 직무 만족도 © 😀/);
   assert.match(result.outputs[format].text,/&#8226;/,'literal numeric entity text must not be decoded');
   fs.writeFileSync(path.join(artifacts,'roundtrip.'+format),Buffer.from(result.outputs[format].bytes));
  }
  const app = fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  // Cross-origin classic scripts have an opaque import base without CORS.
  // This reproduces the real app's about:blank dynamic-import failure.
  await context.route('http://scripts.test/app.js', route => route.fulfill({contentType:'text/javascript',body:app.slice(app.indexOf('async function exportCurrentDocumentByChoice('),app.indexOf('async function readFile('))}));
  await page.addScriptTag({url:'http://scripts.test/app.js'});
  const exports = await page.evaluate(async()=>{
   Object.assign(window,{currentMarkdown:'# 제목\n\n본문',syncCurrentMarkdownFromEditor:()=>{},getSaveCandidateFileName:()=> '검사.md',resolveDocxExportImage:async()=>null,downloads:[],toasts:[],showToast:message=>window.toasts.push(message),downloadBlobFile:(blob,name)=>window.downloads.push({name,size:blob.size}),markPersistedState:()=>{throw new Error('dirty state must stay intact');}});
   const success=await exportCurrentDocumentByChoice('hwpx');
   const hwpSuccess=await exportCurrentDocumentByChoice('hwp');
   window.currentMarkdown='$\\unsupportedcommand{x}$';const blocked=await exportCurrentDocumentByChoice('hwpx');
   return {success,hwpSuccess,blocked,downloads:window.downloads,toasts:window.toasts};
  });
  assert(exports.success,JSON.stringify(exports.toasts));assert.equal(exports.blocked,false);assert(exports.hwpSuccess,JSON.stringify(exports.toasts));assert.equal(exports.downloads.length,2);assert.equal(exports.downloads[0].name,'검사.hwpx');assert.equal(exports.downloads[1].name,'검사.hwp');
  const evidence=[];
  for (const format of ['hwp','hwpx']) {
   const resultImport=await page.evaluate(async ({format,bytes})=>{
    const {convertHwpToHtml}=await import('/rHwp/hwp-import.mjs');
    const imported=await convertHwpToHtml(new File([new Uint8Array(bytes)],'sample.'+format),{JSZip});
    const body=new DOMParser().parseFromString(imported.html,'text/html').body;
    return {text:body.textContent,tables:body.querySelectorAll('table').length,images:body.querySelectorAll('img').length,warnings:imported.warnings};
   },{format,bytes:result.outputs[format].bytes});
   assert.match(resultImport.text,/문단 79/);assert.equal(resultImport.tables,1);assert(resultImport.images>=1);
   evidence.push({format,...resultImport});
  }
  fs.writeFileSync(path.join(artifacts,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({rejected:result.rejected,evidence},null,2));
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

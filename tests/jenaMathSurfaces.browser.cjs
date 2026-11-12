const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const output=path.resolve('artifacts/jena-port-20261112');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{port:5199,host:'127.0.0.1'},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto('http://127.0.0.1:5199/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
  const content=String.raw`일반 인라인: \(\beta = .792\)

이중 이스케이프: \\(\\beta = .792\\)

괄호 안 수식: (\(\beta = .792\))

통계 유의성: \(*p<.05, **p<.01, ***p<.001\)

합계: \(\sum \beta_i^2\)

분수: \(\text{AVE}=\frac{2.7069}{4}=0.677\)

코드와 수식: INLINE_CODE 다음 값은 $x_i$이다.

일반 문장: (Self-Efficacy), (A/B testing), (→ 동기 부여)

$$
\begin{aligned}
a &= b \\
c &= d
\end{aligned}
$$`.replace('INLINE_CODE',String.fromCharCode(96)+'result$points'+String.fromCharCode(96));
  await page.evaluate(content=>{updateContent(content);if(isEditMode)toggleMode('view');},content);
  await page.waitForFunction(()=>document.querySelectorAll('#viewer mjx-container').length>=7);
  const main=await page.locator('#viewer').evaluate(n=>({count:n.querySelectorAll('mjx-container').length,errors:n.querySelectorAll('[data-mjx-error],mjx-merror').length,tokens:n.textContent.includes('@@MATHSEG_'),code:n.textContent.includes('result$points')}));
  const event=page.waitForEvent('popup');await page.evaluate(()=>openPreviewPopupWindow());const pv=await event;
  await pv.waitForFunction(()=>document.querySelectorAll('#pv-content mjx-container,#pv-pages mjx-container').length>=7,{},{timeout:30000});
  const preview=await pv.evaluate(()=>({count:document.querySelectorAll('mjx-container').length,errors:document.querySelectorAll('[data-mjx-error],mjx-merror').length,tokens:document.body.textContent.includes('@@MATHSEG_')}));
  assert.equal(main.errors,0);assert.equal(preview.errors,0);assert.equal(main.tokens,false);assert.equal(preview.tokens,false);assert.equal(main.code,true);assert.equal(preview.count,main.count);assert.deepEqual(errors,[]);
  await page.screenshot({path:output+'/math-main.png'});await pv.screenshot({path:output+'/math-pv.png'});
  fs.writeFileSync(output+'/math-surfaces-results.json',JSON.stringify({main,preview,errors},null,2));console.log(JSON.stringify({main,preview,errors},null,2));
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

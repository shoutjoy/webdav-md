const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{port:5199,host:'127.0.0.1'},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{
  for(const width of [390,800]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:5199/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
   await page.evaluate(()=>{openImg2MathPopup();});
   const math=await page.locator('#img2math-popup .img2math-dialog').boundingBox();assert(math.x>=-1&&math.x+math.width<=width+1,'Math viewport '+width);
   await page.locator('#img2math-generate').scrollIntoViewIfNeeded();assert(await page.locator('#img2math-generate').isVisible());
   await page.evaluate(()=>{closeImg2MathPopup();setWebdavMacroJenaEnabled(true);TRTMacro.openJenaEditor();});
   const macro=await page.locator('#macro-jena').boundingBox();assert(macro.x>=-1&&macro.x+macro.width<=width+1,'Macro viewport '+width);
   await page.locator('#mj-send').scrollIntoViewIfNeeded();assert(await page.locator('#mj-send').isVisible());
   await page.screenshot({path:'artifacts/jena-port-20261112/mobile-macro-'+width+'.png'});
   await page.evaluate(()=>{MacroJena.disable();openHtml2pptPanel();toggleHtml2pptPanelFullscreen();});
   const slide=page.frameLocator('#html2ppt-frame');await slide.locator('#btnJenaSlide').waitFor();await slide.locator('#btnJenaSlide').click();
   await slide.locator('.jsl-workspace').waitFor({state:'visible'});await slide.locator('#jsl-source').waitFor({state:'visible'});await slide.locator('#jsl-generate-text').scrollIntoViewIfNeeded();assert(await slide.locator('#jsl-generate-text').isVisible());
   await page.screenshot({path:'artifacts/jena-port-20261112/mobile-slide-'+width+'.png'});
   assert.deepEqual(errors,[]);results.push({width,mathFits:true,macroFits:true,macroSendReachable:true,slideGenerateReachable:true,pageErrors:errors});await page.close();
  }
  fs.writeFileSync('artifacts/jena-port-20261112/layout-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

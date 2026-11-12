const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{host:'127.0.0.1',port:5199},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 fs.mkdirSync('artifacts/image-dock-20261112',{recursive:true});
 try{for(const width of [1440,800,390]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
 await page.evaluate(()=>{toggleMode('edit');openImageInsertModal();});
 const inventory=await page.locator('#image-insert-panel button').allTextContents();
 await page.locator('#img-insert-url').fill('https://example.com/dock.png');
 await page.locator('#image-insert-dock-button').click();
 assert(await page.locator('#image-insert-dock').isVisible());
 assert.equal(await page.locator('#image-insert-dock-button').textContent(),'Popup');
 assert.equal(await page.locator('#img-insert-url').inputValue(),'https://example.com/dock.png');
 const editor=await page.locator('#main-workspace > .order-2').boundingBox();const dock=await page.locator('#image-insert-dock').boundingBox();
 if(width>760){assert(editor.x+editor.width<=dock.x+2);const handle=page.locator('#image-insert-dock [role=separator]');await handle.focus();await page.keyboard.press('ArrowLeft');
 const before=await page.locator('#image-insert-dock').boundingBox();const box=await handle.boundingBox();await page.mouse.move(box.x+4,box.y+50);await page.mouse.down();await page.mouse.move(box.x-25,box.y+50);await page.mouse.up();const after=await page.locator('#image-insert-dock').boundingBox();assert(after.width>=before.width);
 }else assert(editor.y+editor.height<=dock.y+2);
 for(const dark of [false,true]){await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);await page.screenshot({path:`artifacts/image-dock-20261112/dock-${width}-${dark?'dark':'light'}.png`});}
 assert.equal(await page.locator('#image-insert-panel button').count(),inventory.length);
 await page.locator('#image-insert-panel button').filter({hasText:/^Markdown 삽입$/}).click();
 assert((await page.locator('#viewer-edit-ta').inputValue()).includes('https://example.com/dock.png'));assert(await page.locator('#image-insert-dock').isVisible());
 await page.locator('#image-insert-dock-button').click();assert.equal(await page.locator('#image-insert-dock').count(),0);assert(await page.locator('#image-insert-panel').isVisible());
 await page.locator('#image-insert-dock-button').click();await page.evaluate(()=>closeImageInsertModal());assert.equal(await page.locator('#image-insert-dock').count(),0);
 await page.evaluate(()=>openImageInsertModal());assert(await page.locator('#image-insert-dock').isVisible());
 await page.locator('#image-insert-dock-button').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#image-insert-dock').count(),0);
 assert.deepEqual(errors,[]);results.push({width,controls:inventory.length,insert:true,resize:width>760,returnCloseReopenEscape:true,errors});await page.close();
 }fs.writeFileSync('artifacts/image-dock-20261112/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

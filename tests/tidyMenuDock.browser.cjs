const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');
(async () => {
 const {createServer} = await import('vite');
 const server = await createServer({server:{host:'127.0.0.1',port:5198},logLevel:'error'}); await server.listen();
 const browser = await chromium.launch({channel:'chrome',headless:true});
 fs.mkdirSync('artifacts/tidy-dock-20261112',{recursive:true});
 const results=[];
 try {
  for (const width of [1440,800,390]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5198/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
   await page.evaluate(()=>{toggleMode('edit');toggleTidyQuickMenu(true);});
   const inventory=await page.locator('#tidy-quick-panel button').allTextContents();
   await page.locator('#tidy-dock-btn').click();
   await page.locator('#tidy-menu-dock').waitFor();
   assert.equal(await page.locator('#tidy-quick-panel').evaluate(p=>p.parentElement.id),'tidy-menu-dock');
   await page.evaluate(()=>{closeTidyQuickMenu();document.getElementById('viewer-edit-ta').click();window.dispatchEvent(new Event('resize'));});
   assert(await page.locator('#tidy-quick-panel').isVisible());
   await page.evaluate(()=>toggleTidyQuickMenu());
   assert(await page.locator('#tidy-quick-panel').isVisible());
   assert.equal(await page.locator('#tidy-quick-panel button').count(),inventory.length);
   // Run a real editor transform and preserve the dock.
   await page.evaluate(()=>{const ta=document.getElementById('viewer-edit-ta');ta.value='<!-- note-cover {"title":"Dock test"} -->';ta.setSelectionRange(0,0);});
   await page.locator('#tidy-quick-panel button').filter({hasText:/^noteCover$/}).click();
   assert((await page.locator('#viewer-edit-ta').inputValue()).includes('\n'));
   assert(await page.locator('#tidy-quick-panel').isVisible());
   if(width>760){
    const handle=page.locator('#tidy-menu-dock [role=separator]');
    const before=await page.locator('#tidy-menu-dock').boundingBox();
    await handle.focus();await page.keyboard.press('ArrowLeft');
    const after=await page.locator('#tidy-menu-dock').boundingBox();assert(after.width>=before.width);
    const rail=await page.locator('#scroll-jump-rail').boundingBox();
    assert(rail.x+rail.width<=after.x,'scroll controls stay beside document');
    const rect=await handle.boundingBox();await page.mouse.move(rect.x+4,rect.y+30);await page.mouse.down();await page.mouse.move(rect.x-30,rect.y+30);await page.mouse.up();
    assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('tidy-dock-resizing')),false);
   }
   for(const dark of [false,true]){
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
    await page.locator('#tidy-dock-btn').scrollIntoViewIfNeeded();
    const box=await page.locator('#tidy-menu-dock').boundingBox();assert(box.x>=-1&&box.x+box.width<=width+1);assert(box.y+box.height<=901);
    await page.screenshot({path:`artifacts/tidy-dock-20261112/dock-${width}-${dark?'dark':'light'}.png`});
   }
   await page.locator('.tidy-dock-heading button').first().click();
   assert.equal(await page.locator('#tidy-menu-dock').count(),0);assert(await page.locator('#tidy-quick-panel').isVisible());
   await page.locator('#tidy-dock-btn').click();await page.locator('.tidy-dock-heading button').last().click();
   assert.equal(await page.locator('#tidy-menu-dock').count(),0);assert(!(await page.locator('#tidy-quick-panel').isVisible()));
   await page.evaluate(()=>toggleTidyQuickMenu(true));await page.locator('#tidy-dock-btn').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#tidy-menu-dock').count(),0);
   assert.deepEqual(errors,[]);results.push({width,controls:inventory.length,transform:true,returnCloseEscape:true,pageErrors:errors});await page.close();
  }
  fs.writeFileSync('artifacts/tidy-dock-20261112/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

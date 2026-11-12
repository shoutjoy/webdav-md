const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{port:5201,host:'127.0.0.1'},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 const out='artifacts/table-menu-20261112';fs.mkdirSync(out,{recursive:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5201/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
   await page.evaluate(()=>{if(!isEditMode)toggleMode();});
   // Use a real click: the deferred shared toolbar handler also runs here.
   if(width>760) await page.locator('#btn-table-insert-picker').click();
   else await page.evaluate(()=>toggleTableInsertPicker());
   await page.waitForTimeout(100);
   const anchored = await page.evaluate(()=>({button:document.getElementById('btn-table-insert-picker').getBoundingClientRect().toJSON(),panel:document.getElementById('table-insert-picker').getBoundingClientRect().toJSON()}));
   assert(Math.abs(anchored.panel.top - (anchored.button.bottom + 6)) < 2);
   assert(anchored.panel.left >= 0 && anchored.panel.right <= width + 1);
   assert.equal(await page.locator('#table-menu-heading > button').first().getAttribute('id'),'btn-jena-table');
   assert.equal(await page.locator('#table-menu-body [onclick^="editMarkdownTableStructure"]').count(),8);
   await page.locator('#table-menu-dock-btn').click();await page.locator('#table-menu-dock').waitFor();
   const boxes=await page.evaluate(()=>({dock:document.getElementById('table-menu-dock').getBoundingClientRect().toJSON(),workspace:document.getElementById('main-workspace').getBoundingClientRect().toJSON(),editor:document.querySelector('#main-workspace > .order-2').getBoundingClientRect().toJSON()}));
   assert(boxes.dock.x>=-1&&boxes.dock.right<=width+1);
   if(width>760){assert(Math.abs(boxes.dock.right-boxes.workspace.right)<2);assert(boxes.editor.right<=boxes.dock.left+1);const rail=await page.locator('#scroll-jump-rail').boundingBox();assert(rail.x+rail.width<boxes.dock.left);}
   await page.evaluate(()=>editorTextarea.click());assert(await page.locator('#table-menu-dock').isVisible());
   const before='| A | B |\n| --- | --- |\n| x | y |\n| z | w |';
   await page.evaluate(text=>{editorTextarea.value=text;editorTextarea.setSelectionRange(text.indexOf('x'),text.indexOf('x'));},before);
   await page.locator('[onclick="editMarkdownTableStructure(\'merge-row-down\')"]').click();
   assert.equal(await page.evaluate(()=>editorTextarea.value),'| A | B |\n| --- | --- |\n| x<br>z | y<br>w |');
   assert(await page.locator('#table-menu-dock').isVisible());
   await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>editorTextarea.value),before);
   await page.locator('[onclick="editMarkdownTableStructure(\'merge-column-right\')"]').click();
   assert((await page.evaluate(()=>editorTextarea.value)).includes('| x y |'));
   await page.locator('#table-menu-body > button[onclick="toggleCaptionInsertPanel(\'table\')"]').click();
   await page.locator('#table-caption-text-input').scrollIntoViewIfNeeded();assert(await page.locator('#table-caption-text-input').isVisible());
   await page.locator('#table-menu-heading').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/docked-'+width+'.png'});
   await page.locator('#btn-jena-table').click();await page.locator('#jena-table-popup').waitFor({state:'visible'});
   await page.evaluate(()=>closeJenaTablePopup());
   await page.locator('#table-menu-dock-btn').click();assert.equal(await page.locator('#table-menu-dock').count(),0);
   const floating=await page.locator('#table-insert-picker').boundingBox();assert(floating.x>=0&&floating.x+floating.width<=width+1);
   await page.screenshot({path:out+'/floating-'+width+'.png'});
   await page.locator('[aria-label="표 메뉴 닫기"]').click();assert(await page.locator('#table-insert-picker').isHidden());
   await page.evaluate(()=>toggleTableInsertPicker());await page.keyboard.press('Escape');assert(await page.locator('#table-insert-picker').isHidden());
   assert.deepEqual(errors,[]);results.push({width,rightDock:width>760,mobileBottomDock:width<=760,mergeAndUndo:true,captionAndJenaReachable:true,undockAndClose:true,pageErrors:errors});await page.close();
  }
  fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

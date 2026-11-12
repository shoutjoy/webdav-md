const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve('artifacts/vite-buttons-20261110');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import('vite');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try {for(const base of ['/','/nested/']) {
  const server=await createServer({base,server:{port:5198,host:'127.0.0.1'},logLevel:'error'});await server.listen();
  try {
   const url=server.resolvedUrls.local[0];
   const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>typeof openSettingsModal==='function'&&typeof openMermaidEditorModal==='function');
   const script=await page.locator('script[src*="./js/app.js?"]').getAttribute('src');
   const response=await page.request.get(new URL(script,url+'mdpro/').href);
   assert.equal(await response.text(),fs.readFileSync('mdpro/js/app.js','utf8'));
   assert.equal(response.headers()['cache-control'],'no-store');
   await page.locator('button[onclick="openSettingsModal()"]').click();
   await page.locator('#settings-modal').waitFor({state:'visible'});
   await page.evaluate(()=>closeSettingsModal());
   await page.locator('#btn-view').click();
   assert.equal(await page.evaluate(()=>isEditMode),false);
   await page.locator('#btn-edit').click();
   assert.equal(await page.evaluate(()=>isEditMode),true);
   await page.locator('#btn-mermaid-quick').click();
   await page.locator('button[onclick="openMermaidEditorModal(); closeMermaidQuickMenu()"]').click();
   await page.locator('#mermaid-editor-modal').waitFor({state:'visible'});
   const frame=page.frameLocator('#mermaid-editor-frame');
   await frame.locator('#render svg').waitFor();
   await frame.locator('#raw-code-editor').fill('graph LR\nA["실행 확인"] --> B["완료"]');
   await frame.locator('#render').filter({hasText:'실행 확인'}).waitFor();
   await frame.locator('#ui-theme-toggle-btn').click();
   assert.equal(await frame.locator('body').evaluate(n=>n.classList.contains('ui-dark')),true);
   await page.screenshot({path:path.join(output,base==='/'?'root-buttons.png':'nested-buttons.png')});
   await page.evaluate(()=>closeMermaidEditorModal());
   // Exercise the original dynamic import in the classic app, then cancel.
   await page.evaluate(()=>{window.hwpChoiceCheck=openHwpInEditor(new File(['fixture'],'test.hwpx'));});
   await page.locator('[data-hwp-open-choice]').waitFor({state:'visible'});
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>window.hwpChoiceCheck),false);
   assert.deepEqual(errors,[]);
   results.push({base,rawScript:true,settingsClick:true,viewEditClick:true,mermaidClickRender:true,mermaidThemeClick:true,hwpDynamicImport:true,pageErrors:errors});
   await page.close();
   // Also exercise the React host and its real MDpro iframe on the root route.
   if(base==='/') {
    const host=await browser.newPage({viewport:{width:1600,height:1000}}),hostErrors=[];
    host.on('pageerror',e=>hostErrors.push(e.message));
    await host.route('https://fixture-webdav.test/**',route=>route.request().method()==='PROPFIND'
     ? route.fulfill({status:207,contentType:'application/xml',body:'<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:displayname>fixture</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'})
     : route.fulfill({status:404,body:''}));
    await host.addInitScript(()=>sessionStorage.setItem('webdav-viewer-active-session',JSON.stringify({url:'https://fixture-webdav.test',username:'fixture',password:'fixture-only'})));
    await host.goto(url,{waitUntil:'networkidle'});
    const embedded=host.frameLocator('iframe[title="MDPRO 문서 편집기"]');
    await embedded.locator('button[onclick="openSettingsModal()"]').click();
    await embedded.locator('#settings-modal').waitFor({state:'visible'});
    assert.deepEqual(hostErrors,[]);
    await host.screenshot({path:path.join(output,'host-settings.png')});
    results.push({reactHostIframe:true,settingsClick:true,pageErrors:hostErrors});
    await host.close();
   }
  } finally {await server.close();}
 }} finally {await browser.close();}
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(results,null,2));console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1});

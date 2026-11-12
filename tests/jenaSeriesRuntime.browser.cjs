const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=path.resolve('artifacts/jena-port-20261112');
(async()=>{
 const {createServer}=await import('vite');
 const base=process.env.JENA_TEST_BASE || '/';
 const server=await createServer({base,server:{port:5198,host:'127.0.0.1'},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try {
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   try { localStorage.getItem('fixture-check'); } catch (_) { return; }
   localStorage.setItem('ss_ai_chat_provider','lemonade');localStorage.setItem('ss_ai_chat_lemonade_model','fixture-vision');
   for(const key of ['mdv_ai_tool_img2math','mdv_ai_tool_jena-table','mdv_ai_tool_tidy','mdv_mermaid_ai_selection_v1','mdpro_macro_jena_model_v1','mdpro_jena_slide_model_v1','mdpro_scholar_jena_selection_v1'])localStorage.setItem(key,JSON.stringify({provider:'lemonade',model:'fixture-vision',openAICompatibleProvider:'lemonade'}));
  });
  await page.goto('http://127.0.0.1:5198'+base+'mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>typeof openJenaTablePopup==='function');
  await page.evaluate(()=>{
   window.fixtureRequests=[];window.fixtureSlow=false;
   window.AIChatBridge=Object.freeze({...window.AIChatBridge,
    getCachedLemonadeModels:()=>['fixture-vision'],refreshLemonadeModels:async()=>['fixture-vision'],getTaskModelRuntime:async()=>({loadedModels:['fixture-vision'],vision:true,residencyKnown:true}),
    complete:async request=>{
     fixtureRequests.push({provider:request.provider,model:request.model,profile:request.openAICompatibleProvider,task:request.task,messages:request.messages});
     let text='완료';
     if(request.task==='table-ocr')text=fixtureSlow?'| 늦은 결과 | 값 |\n| --- | --- |\n| 바뀌면 오류 | -999 |':'| 항목 | 값 |\n| --- | --- |\n| 음수 | -0.5 |';
     else if(request.task==='math-ocr')text='a=-\\frac{1}{2}\n=-0.5';
     else if(request.task==='tidy-javascript')text='```javascript\nfunction transform(source) { return source.toUpperCase(); }\n```';
     else if(request.task==='jena-slide')text='테스트 제목\n슬라이드 내용';
     else if(request.task==='jena-slide-javascript')text='slide.table({headers:["항목","값"],rows:[["검증","12"]],x:80,y:120,width:1000,fontSize:28});';
     else if(request.task==='macro-javascript')text='```javascript\nmdpro.replaceSelection("실행 완료");\n```';
     else if(request.task==='mermaid-code-revision'||/Mermaid/.test(request.systemInstruction||''))text='flowchart LR\nA["처음"] --> B["완료"]';
     if(request.onStreamEvent)request.onStreamEvent({type:'message.delta',content:text.slice(0,Math.ceil(text.length/2))});
     if(fixtureSlow)await new Promise(resolve=>setTimeout(resolve,400));else await new Promise(resolve=>setTimeout(resolve,20));
     if(request.onStreamEvent)request.onStreamEvent({type:'message.delta',content:text.slice(Math.ceil(text.length/2))});
     return {text,provider:request.provider,model:request.model,usage:{completion_tokens:16}};
    }
   });
  });
  await page.evaluate(()=>{openJenaTablePopup();});
  await page.locator('#jena-table-source-text').fill('항목, 값\n음수, -0.5');
  await page.waitForFunction(()=>AIToolProviders.read('jena-table').model==='fixture-vision');
  await page.locator('#jena-table-generate').click();
  await page.waitForFunction(()=>document.getElementById('jena-table-result').value.includes('| 음수 | -0.5 |')&&!document.getElementById('jena-table-generate').disabled);
  assert.equal(await page.locator('#jena-table-render table').count(),1);
  results.push({tool:'Table',textInput:true,stream:true,preview:true});
  const old=await page.locator('#jena-table-result').inputValue();
  await page.evaluate(()=>{fixtureSlow=true;});await page.locator('#jena-table-generate').click();
  await page.locator('#jena-table-task-status [data-stop]').click();
  await page.waitForFunction(()=>!document.getElementById('jena-table-generate').disabled);
  assert.match(await page.locator('#jena-table-status').innerText(),/중지/);
  assert.equal(await page.locator('#jena-table-result').inputValue(),old);
  await page.waitForTimeout(500);assert.equal(await page.locator('#jena-table-result').inputValue(),old);
  results.push({tool:'Table',cancelRestores:true,lateResponseIgnored:true});
  await page.evaluate(()=>{fixtureSlow=false;});
  await page.locator('#jena-table-popup select[aria-label="AI 공급자"]').selectOption('');
  assert.equal(await page.evaluate(()=>AIToolProviders.read('jena-table').provider),'');
  await page.locator('#jena-table-generate').click();await page.waitForFunction(()=>!document.getElementById('jena-table-generate').disabled);
  assert.equal(await page.locator('#jena-table-result').inputValue(),old);results.push({tool:'Table',inheritCurrentJena:true});
  await page.evaluate(()=>{fixtureSlow=false;closeJenaTablePopup();openImg2MathPopup();});
  await page.locator('#img2math-source-text').fill('a=-1/2\n=-0.5');await page.locator('#img2math-generate').click();
  await page.waitForFunction(()=>!document.getElementById('img2math-generate').disabled&&document.getElementById('img2math-result').value.includes('aligned')).catch(async error=>{console.log('Math state',await page.evaluate(()=>({value:document.getElementById('img2math-result').value,status:document.getElementById('img2math-status').textContent,requests:fixtureRequests})));throw error;});
  assert.match(await page.locator('#img2math-result').inputValue(),/-\\frac/);
  await page.locator('#img2math-render mjx-container').first().waitFor();results.push({tool:'Math',textInputRetained:true,multiline:true,mathJax:true,mathNodes:await page.locator('#img2math-render mjx-container').count()});
  await page.evaluate(()=>{closeImg2MathPopup();openMermaidEditorModal();});
  const me=page.frameLocator('#mermaid-editor-frame');await me.locator('#render svg').waitFor();
  if(await me.locator('#image-to-mermaid').evaluate(n=>n.classList.contains('ai-collapsed')))await me.locator('#mermaid-ai-collapse-btn').click();
  await me.locator('#mermaid-reference-text').evaluate(n=>n.value='참고 자료');
  await me.locator('#mermaid-code-revision').evaluate(n=>n.open=true);
  await me.locator('#mermaid-code-revision-source').fill('flowchart LR\nA-->B');
  await me.locator('#mermaid-code-revision-prompt').fill('한글 라벨 추가');
  const beforeCode=await me.locator('#raw-code-editor').inputValue();
  await me.locator('#mermaid-code-revision-run').click();
  await me.locator('#mermaid-code-revision-apply').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('mermaid-editor-frame').contentWindow.document.getElementById('mermaid-code-revision-apply').disabled===false);
  assert.equal(await me.locator('#raw-code-editor').inputValue(),beforeCode);
  const meRequest=await page.evaluate(()=>fixtureRequests.find(r=>r.task==='mermaid-code-revision'));
  assert.equal(meRequest.messages[0].attachments.length,0);assert(!meRequest.messages[0].content.includes('참고 텍스트'));
  await me.locator('#mermaid-code-revision-apply').click();await me.locator('#render').filter({hasText:'처음'}).waitFor();
  results.push({tool:'ME',isolatedRevision:true,explicitApply:true,realSvg:true});
  await page.evaluate(()=>{closeMermaidEditorModal();TidyScriptManager.openManager();});
  const tidy=page.frameLocator('#tidy-manager-dialog iframe');await tidy.locator('[data-mode="jena"]').click();
  await tidy.locator('#jena-prompt').fill('대문자 변환 함수를 만들어줘');await tidy.locator('#jena-send').click();
  await page.waitForFunction(()=>document.getElementById('tidy-manager-dialog').querySelector('iframe').contentWindow.document.getElementById('code').value.includes('toUpperCase'));
  results.push({tool:'Tidy',sharedPicker:true,generation:true});
  const workerCheck=await page.evaluate(async()=>{
   const saved=await TidyScriptManagerBridge.save({name:'범위 고정 fixture',code:'async function transform(source) { await new Promise(resolve => setTimeout(resolve, 80)); return source.toUpperCase(); }',enabled:true});
   editorTextarea.value='AA target BB';currentMarkdown=editorTextarea.value;editorTextarea.setSelectionRange(3,9);
   const operation=TidyScriptManager.applyScript(saved.record.id);editorTextarea.setSelectionRange(0,0);await operation;
   const fixed=editorTextarea.value;
   editorTextarea.value='AA target BB';editorTextarea.setSelectionRange(3,9);
   const switched=TidyScriptManager.applyScript(saved.record.id);currentDocumentDisplayRequest++;await switched;
   return {fixed,switched:editorTextarea.value};
  });
  assert.equal(workerCheck.fixed,'AA TARGET BB');assert.equal(workerCheck.switched,'AA target BB');results.push({tool:'Tidy',realWorker:true,fixedSelection:true,documentSwitchProtected:true});
  await page.evaluate(()=>{TidyScriptManager.closeManager();setWebdavMacroJenaEnabled(true);editorTextarea.value='원본 문서';currentMarkdown=editorTextarea.value;editorTextarea.setSelectionRange(0,4);TRTMacro.openJenaEditor();});
  await page.locator('#mj-prompt').fill('선택 영역을 실행 완료로 바꾸는 매크로');await page.locator('#mj-send').click();
  await page.waitForFunction(()=>document.getElementById('mj-code').value.includes('실행 완료')&&!document.getElementById('mj-send').disabled);
  assert.equal(await page.evaluate(()=>editorTextarea.value),'원본 문서');
  await page.locator('#mj-register').click();assert.equal(await page.evaluate(()=>editorTextarea.value),'원본 문서');
  await page.locator('#mj-run').click();assert.equal(await page.evaluate(()=>editorTextarea.value),'실행 완료서');
  await page.screenshot({path:path.join(output,'macro-generation.png')});results.push({tool:'Macro',generateDoesNotExecute:true,registerDoesNotExecute:true,explicitRun:true});
  await page.evaluate(()=>{MacroJena.disable();openHtml2pptPanel();});
  const slide=page.frameLocator('#html2ppt-frame');await slide.locator('#btnJenaSlide').waitFor();
  await slide.locator('#btnJenaSlide').click();await slide.locator('.jsl-workspace').waitFor({state:'visible'});await slide.locator('#jsl-source').fill('첫 번째 내용\n\n---\n\n두 번째 내용');
  await slide.locator('#jsl-split').click();
  assert.equal(await page.evaluate(()=>document.getElementById('html2ppt-frame').contentWindow.JenaSlide.snapshot().pages.length),2);
  await slide.locator('#jsl-generate-text').click();
  await page.waitForFunction(()=>document.getElementById('html2ppt-frame').contentWindow.JenaSlide.snapshot().pages.some(p=>p.html));
  await page.waitForFunction(()=>document.getElementById('html2ppt-frame').contentWindow.document.getElementById('jsl-stop').disabled);
  await slide.locator('.jsl-visual-tools').evaluate(n=>n.open=true);await slide.locator('#jsv-prompt').fill('항목과 값 두 열의 표를 만들어줘');await slide.locator('#jsv-generate').click();
  await page.waitForFunction(()=>!document.getElementById('html2ppt-frame').contentWindow.document.getElementById('jsv-insert').disabled);
  const mpp=await page.evaluate(async()=>{
   const target=document.getElementById('html2ppt-frame').contentWindow,payload=await target.buildGenSlideMppPayload();
   const id=await target.saveSlidesToInDb('Jena fixture');
   target.JenaSlide.restore({...payload.jenaSlide,pages:[]});await target.loadSlidesFromInDbById(id);
   const inDbDrafts=target.JenaSlide.snapshot().pages.length;
   target.JenaSlide.restore({...payload.jenaSlide,pages:[]});await target.importMpp(new target.File([JSON.stringify(payload)],'fixture.mpp',{type:'application/json'}));
   return {drafts:payload.jenaSlide.pages.length,version:payload.version,inDbDrafts,mppDrafts:target.JenaSlide.snapshot().pages.length};
  });
  assert(mpp.drafts>=2);assert.equal(mpp.version,2);assert.equal(mpp.inDbDrafts,mpp.drafts);assert.equal(mpp.mppDrafts,mpp.drafts);results.push({tool:'Slide',isolatedJsVisualRenderer:true,mppDraftRoundTrip:true,inDbDraftRoundTrip:true});
  await page.screenshot({path:path.join(output,'slide-generation.png')});results.push({tool:'Slide',initialization:true,pageSplit:true,generation:true,existingScholarControl:await slide.locator('#btnScholarAI').count()===1});
  const documentBeforeReturn=await page.evaluate(()=>editorTextarea.value);
  await page.evaluate(()=>openMermaidEditorForGenSlide(document.getElementById('html2ppt-frame').contentWindow,'도표 참고 자료'));
  await me.locator('#render svg').waitFor();await me.locator('[onclick="sendRenderedPngToImageInsert()"]').click();
  await page.waitForFunction(()=>document.getElementById('mermaid-editor-modal').classList.contains('hidden'));
  await page.waitForFunction(()=>document.getElementById('html2ppt-frame').contentWindow.document.getElementById('jsv-code').value.includes('flowchart'));
  assert.equal(await page.evaluate(()=>editorTextarea.value),documentBeforeReturn);results.push({tool:'Slide/ME',realPngReturn:true,documentUnchanged:true});
  await page.evaluate(()=>{closeHtml2pptPanel();ensureSidebarAILoaded();});
  await page.waitForFunction(()=>typeof toggleViewerSSP==='function');await page.evaluate(()=>toggleViewerSSP());
  await page.locator('#ssp-provider').waitFor({state:'attached'});await page.locator('#ssp-model-settings').waitFor({state:'attached'});
  assert.equal(await page.locator('#ssp-model').count(),1);assert.equal(await page.locator('#ssp-provider').count(),1);
  results.push({tool:'SSP',singleProviderUi:true,modelFold:true});
  await page.evaluate(()=>toggleScholarAI());await page.locator('#scholar-ai-jena-picker').waitFor({state:'attached'});
  const scholar=await page.evaluate(()=>completeWebdavScholar('fixture','답변 작성',false,undefined,{mode:'quick',maxOutputTokens:512}));assert.equal(scholar.text,'완료');
  results.push({tool:'Scholar',commonPicker:true,independentRequest:true});
  const requests=await page.evaluate(()=>fixtureRequests);
  for(const task of ['table-ocr','math-ocr','tidy-javascript','macro-javascript','jena-slide','jena-slide-javascript','mermaid-code-revision','scholar-ai']){
   const request=requests.find(item=>item.task===task);assert(request,task);assert.equal(request.provider,'openai-compatible',task);assert.equal(request.profile,'lemonade',task);assert.equal(request.model,'fixture-vision',task);
  }
  assert.deepEqual(errors,[]);results.push({pageErrors:errors});
  fs.writeFileSync(path.join(output,base==='/'?'browser-root-results.json':'browser-nested-results.json'),JSON.stringify({base,results},null,2));console.log(JSON.stringify(results,null,2));
 } finally {await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

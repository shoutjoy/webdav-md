const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({plugins:[{name:'jena-test-shell',configureServer(s){s.middlewares.use('/jena-test-shell',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<iframe id="fixture" src="/mdpro/index.html?webdav=1" style="width:1200px;height:900px"></iframe>');});}}],server:{host:'127.0.0.1',port:5217},logLevel:'error'});await server.listen();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jena-cdp-'));
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  for(let n=0;n<100&&!fs.existsSync(path.join(dir,'DevToolsActivePort'));n++)await delay(100);
  const port=fs.readFileSync(path.join(dir,'DevToolsActivePort'),'utf8').split('\n')[0];
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  let evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:5217/jena-test-shell'});await delay(500);
  const parentEvaluate=evaluate; evaluate=expression=>parentEvaluate('document.getElementById("fixture").contentWindow.eval('+JSON.stringify(expression)+')');
  for(let n=0;n<100;n++){if(await evaluate('typeof openAiJenaFromMenu === "function"'))break;await delay(100);}
  await evaluate('openAiJenaFromMenu()');await delay(500);
  const results=[];
  for(const key of [2,1,2,3,2,4,2]){
   await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',code:'Digit${key}',altKey:true,bubbles:true}))`);await delay(250);
   const result=await evaluate(`(()=>{const p=document.getElementById('ai-chat-panel')||parent.document.getElementById('ai-chat-panel'),s=document.getElementById('ai-chat-dock-slot');return {layout:p.className,visible:p.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),dock:p.classList.contains('layout-dock'),popover:p.hasAttribute('popover'),slotOpen:s.matches(':popover-open'),header:!!p.querySelector('#ai-chat-close'),input:!!p.querySelector('#ai-chat-input')}})()`);
   assert(result.visible&&result.header&&result.input,JSON.stringify(result));assert.equal(result.popover,!result.dock);if(result.dock)assert(result.slotOpen);results.push(result);
  }
  await evaluate('AIChat.close()');await delay(100);assert.equal(await evaluate('document.getElementById("ai-chat-panel").checkVisibility()'),false);
  await evaluate('AIChat.open()');await delay(300);assert.equal(await evaluate('document.getElementById("ai-chat-panel").checkVisibility({checkOpacity:true})'),true);
  await evaluate(`window.loadCalls=[];window.AIChatBridge=Object.assign({},AIChatBridge,{getCachedLMStudioModels:()=>({models:['fixture-lm']}),refreshLMStudioModels:async()=>({model:'',models:['fixture-lm']}),getCachedOllamaModels:()=>['fixture-ollama'],refreshOllamaModels:async()=>['fixture-ollama'],getCachedLemonadeModels:()=>['fixture-lemonade'],refreshLemonadeModels:async()=>['fixture-lemonade'],loadLMStudioModel:async m=>{loadCalls.push('lmstudio');await new Promise(r=>setTimeout(r,300));return {model:m}},loadOllamaModel:async m=>{loadCalls.push('ollama');await new Promise(r=>setTimeout(r,300));return {model:m}},loadLemonadeModel:async(m,o)=>{loadCalls.push('lemonade');o.onProgress('서버 작업 실행 중');await new Promise(r=>setTimeout(r,300));return {model:m,loaded:true}}});`);
  for(const width of [1200,390]){
   await parentEvaluate(`document.getElementById('fixture').style.width='${width}px'`);
   for(const provider of ['lmstudio','lemonade','ollama']){
    await evaluate(`localStorage.setItem('ss_ai_chat_provider','${provider}');AIChat.syncSettings();AIChat.setEnabled(true);AIChat.open();const sel=document.getElementById('ai-chat-model');sel.innerHTML='<option value="fixture-${provider}">fixture-${provider}</option>';sel.dispatchEvent(new Event('change'));if(document.getElementById('ai-chat-provider-toggle').getAttribute('aria-expanded')!=='true')document.getElementById('ai-chat-provider-toggle').click();`);
    await delay(200);const fits=await evaluate(`(()=>{const b=document.getElementById('ai-chat-local-model-load'),r=b.getBoundingClientRect();return b.checkVisibility()&&r.width>50&&r.left>=0&&r.right<=innerWidth+1})()`);if(!fits)console.log(await evaluate("(()=>{const b=document.getElementById('ai-chat-local-model-load');return {hidden:b.hidden,rect:b.getBoundingClientRect().toJSON(),visible:b.checkVisibility(),display:getComputedStyle(b).display,controls:document.getElementById('ai-chat-provider-controls').className,html:b.outerHTML}})()"));assert(fits,provider+' '+width+' load button reachable');
    await evaluate(`document.getElementById('ai-chat-local-model-load').click()`);assert(await evaluate(`document.getElementById('ai-chat-send').disabled&&document.getElementById('ai-chat-model').disabled`));
    await delay(600);assert(await evaluate(`!document.getElementById('ai-chat-local-model-load').disabled&&document.getElementById('ai-chat-status').textContent.includes('모델 로드 완료')`),provider+' load completion');
   }
  }
  assert.equal(await evaluate('loadCalls.length'),6);
  console.log('PASS: LM Studio/Lemonade/Ollama model load controls, locking and completion at 1200/390 iframe widths');
 }finally{if(ws)ws.close();chrome.kill();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

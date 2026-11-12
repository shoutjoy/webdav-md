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
  await evaluate(`window.resumeRequests=[];window.AIChatBridge=Object.assign({},window.AIChatBridge,{complete:async function(r){resumeRequests.push(r);if(resumeRequests.length===1){r.onStreamEvent({type:'message.delta',content:'앞부분을 보존하고 다음 기법을'});throw new DOMException('중지','AbortError');}return {text:' 이어서 설명합니다.',provider:'lemonade',model:'fixture'};}});document.getElementById('ai-chat-input').value='기법을 자세히 설명해줘';document.getElementById('ai-chat-send').click();`);
  for(let n=0;n<100;n++){if(await evaluate('!!document.querySelector(".ai-chat-resume-answer:not(:disabled)")'))break;await delay(100);}
  assert(await evaluate('document.getElementById("ai-chat-messages").textContent.includes("앞부분을 보존")'));
  await evaluate('document.querySelector(".ai-chat-resume-answer").click()');
  for(let n=0;n<100;n++){if(await evaluate('document.getElementById("ai-chat-messages").textContent.includes("이어서 설명합니다")'))break;await delay(100);}
  assert(await evaluate('document.getElementById("ai-chat-messages").textContent.includes("앞부분을 보존") && document.getElementById("ai-chat-messages").textContent.includes("이어서 설명합니다")'));
  assert.equal(await evaluate('resumeRequests.length'),2);assert.equal(await evaluate('resumeRequests[1].continuation'),true);
  console.log('PASS: actual iframe interrupted stream preserved and resume button continues via bridge');
 }finally{if(ws)ws.close();chrome.kill();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

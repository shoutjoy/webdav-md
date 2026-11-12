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
  const timing=await evaluate(`(async()=>{const health=await(await fetch('/api/lemonade/v1/health')).json();const loaded=(health.all_models_loaded||[]).find(x=>x.type==='llm'&&x.backend_alive!==false);if(!loaded)throw new Error('Warm model required');const start=performance.now();let firstTextMs=null;const result=await AIChatBridge.complete({provider:'lemonade',model:loaded.model_name,mode:'quick',disableThinking:true,continuation:true,maxOutputTokens:256,messages:[{role:'user',content:'바이브 코딩에서 이미지 생성 앱의 일관성을 유지하는 방법을 한국어로 설명해줘.'},{role:'assistant',content:'기준 이미지를 등록하고 인물의 얼굴과 스타일을 고정한다. 모델 선택과 프롬프트를 일관되게 유지하고'},{role:'user',content:'마지막 문장 다음부터 구체적인 방법을 바로 이어서 작성해줘. 이전 문장을 반복하지 마.'}],onStreamEvent:e=>{if(e.type==='message.delta'&&e.content&&firstTextMs===null)firstTextMs=performance.now()-start}});return {model:loaded.model_name,firstTextMs,totalMs:performance.now()-start,characters:result.text.length}})()`);console.log(JSON.stringify(timing));assert(timing.firstTextMs!==null&&timing.firstTextMs<10000,'warm first text must arrive within 10 seconds');
 }finally{if(ws)ws.close();chrome.kill();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

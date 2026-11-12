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
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate(`window.resumeCalls=[];window.docStarts=[];window.docFinishes=[];window.badAnchor=false;window.AIChatBridge=Object.assign({},AIChatBridge,{startRealtimeDocStream:o=>{docStarts.push(o);if(badAnchor&&o.continuationText)throw new Error('원문 위치 없음');return {isReplacing:false}},writeRealtimeDocStreamChunk:()=>{},finishRealtimeDocStream:t=>docFinishes.push(t),cancelRealtimeDocStream:()=>{},complete:async r=>{resumeCalls.push(r);r.onStreamEvent?.({type:'message.delta',content:'추가 본문'});return {text:resumeCalls.length===1?'아직 완료되지 않은 본문': ' 이어서 작성된 완성 문장입니다.',finishReason:resumeCalls.length<=2?'length':'stop',provider:'lemonade',model:'fixture'};}});document.getElementById('ai-chat-realtime-doc-toggle').click();document.getElementById('ai-chat-input').value='자세히 작성해줘';document.getElementById('ai-chat-send').click();`);
  await delay(400);assert(await evaluate('!!document.querySelector(".ai-chat-auto-continue input")'));
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await delay(50);const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),f=parent.document.getElementById('fixture').getBoundingClientRect();return{x:f.x+r.x+r.width/2,y:f.y+r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});};
  await click('.ai-chat-continuation button:not(.secondary)');await delay(300);assert.equal(await evaluate('resumeCalls.length'),2);
  await click('.ai-chat-auto-continue input');await delay(700);
  assert.equal(await evaluate('resumeCalls.length'),3);assert.equal(await evaluate('resumeCalls[1].continuation'),true);assert.equal(await evaluate('docStarts.filter(x=>x.continuationText).length'),2);assert.equal(await evaluate('document.querySelector(".ai-chat-auto-continue input")?.disabled||false'),false);
  await evaluate(`badAnchor=true;document.querySelector('.ai-chat-resume-answer').click()`);await delay(500);assert.equal(await evaluate('resumeCalls.length'),4);assert(await evaluate('document.getElementById("ai-chat-messages").textContent.includes("이어서 작성된 완성 문장")'));
  console.log('PASS: native checkbox click starts auto continuation; document session begins once; missing anchor continues in chat');
 }finally{if(ws)ws.close();chrome.kill();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

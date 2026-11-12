const fs=require('fs');
const {chromium}=require('C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core');
(async()=>{
 const {createServer}=await import('vite');const server=await createServer({server:{port:5198,host:'127.0.0.1'},logLevel:'error'});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  await page.addInitScript(()=>{try{localStorage.setItem('ss_ai_chat_provider','lemonade');localStorage.setItem('ss_ai_chat_lemonade_model','Gemma-4-E4B-it-GGUF');}catch(_){}});
  await page.goto('http://127.0.0.1:5198/mdpro/index.html?webdav=1',{waitUntil:'networkidle'});
  const results=await page.evaluate(async()=>{
   await openAiJenaChat(false);
   const rows=[];
   async function run(label,request){let first=null;const started=performance.now();try{const response=await AIChat.completeTask({...request,provider:'lemonade',model:'Gemma-4-E4B-it-GGUF',maxOutputTokens:256,onStreamEvent:event=>{if(first===null&&event.type==='message.delta'&&event.content)first=performance.now()-started;}});rows.push({label,ok:true,provider:response.provider,model:response.model,text:response.text,elapsedMs:Math.round(performance.now()-started),firstDeltaMs:first===null?null:Math.round(first),usage:response.usage});}catch(error){rows.push({label,ok:false,error:error.message,elapsedMs:Math.round(performance.now()-started)});}}
   await run('text-connection',{task:'connectivity',prompt:'Reply with READY only.',systemInstruction:'Return the requested short text only.'});
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=220;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,640,220);context.fillStyle='black';context.font='64px Arial';context.fillText('x = -1 / 2',60,130);
   await run('math-image',{task:'math-ocr',prompt:'Transcribe the equation exactly to LaTeX. Preserve the minus sign. Return only LaTeX.',attachments:[{kind:'image',name:'synthetic-math.png',type:'image/png',dataUrl:canvas.toDataURL('image/png')}],systemInstruction:'You are a mathematical OCR engine. Transcribe exactly, do not solve, correct or omit any sign.'});
   await run('table-text',{task:'table-ocr',prompt:'Make exactly one Markdown table from: Item, Value; A, 12; B, -3. Return only the table.',systemInstruction:'Preserve all supplied values. Do not add prose.'});
   try{const ps=await requestLocalAIJson(normalizeOllamaBaseUrl(getOllamaSettings().baseUrl)+'/api/ps',{method:'GET',headers:{Accept:'application/json'}});rows.push({label:'ollama-residency',models:(ps.models||[]).map(model=>model.name||model.model)});}catch(error){rows.push({label:'ollama-residency',error:error.message});}
   return rows;
  });
  fs.writeFileSync(__dirname+'/real-provider-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

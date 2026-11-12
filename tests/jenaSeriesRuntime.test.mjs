import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';

const app=fs.readFileSync('mdpro/js/app.js','utf8');
const chat=fs.readFileSync('mdpro/AI_App/aiChat/ai-chat.js','utf8');
function declaration(text,name) {
 const node=parse(text,{ecmaVersion:'latest'}).body.find(n=>n.type==='FunctionDeclaration' && n.id.name===name);
 assert(node,name);return text.slice(node.start,node.end);
}
function method(text,name) {
 let node;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Property' && n.key.name===name)node=n;for(const value of Object.values(n)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}
 walk(parse(text,{ecmaVersion:'latest'}));assert(node,name);return text.slice(node.start,node.end);
}
function taskHarness(complete,initialize=async()=>{}) {
 const context=vm.createContext({AbortController,setTimeout,clearTimeout,state:{provider:'ollama'},storageGet:()=> 'orcarouter',activeProviderModel:()=> 'inherited-model',ensureInitialized:initialize,getBridge:()=>({complete})});
 vm.runInContext('api=({'+method(chat,'completeTask')+'})',context);return context.api;
}
for(const [provider,profile,expected] of [['ollama',undefined,'ollama'],['litertlm',undefined,'litertlm'],['lmstudio',undefined,'lmstudio'],['lemonade','lemonade','openai-compatible'],['lemonade-flm','lemonade-flm','openai-compatible'],['openai-compatible','orcarouter','openai-compatible'],['aistudio',undefined,'aistudio']]) {
 test('independent task keeps '+provider+' and its chosen model',async()=>{
  let request;const api=taskHarness(async value=>{request=value;return {text:'ok'};});
  const result=await api.completeTask({provider,model:'selected-id',openAICompatibleProvider:profile,prompt:'fixture'});
  assert.equal(request.provider,expected);assert.equal(request.model,'selected-id');
  if(profile)assert.equal(request.openAICompatibleProvider,profile);
  assert.equal(request.independent,true);assert.equal(request.disableThinking,true);assert.equal(request.fastMode,true);
  assert.equal(request.maxOutputTokens,8192);assert.equal(result.text,'ok');
 });
}
test('task cancellation also bounds initialization, without contacting another provider',async()=>{
 let called=false;const controller=new AbortController();
 const api=taskHarness(async()=>{called=true;},()=>new Promise(()=>{}));
 const operation=api.completeTask({provider:'ollama',model:'chosen',signal:controller.signal});controller.abort();
 await assert.rejects(operation,/중지|초과/);assert.equal(called,false);
});
test('stopping one task suppresses late stream events and leaves another task alive',async()=>{
 let cancelledRequest,resolveLate;const events=[];
 const api=taskHarness(value=>{if(value.model==='second')return Promise.resolve({text:'second alive'});cancelledRequest=value;return new Promise(resolve=>{resolveLate=resolve;});});
 const controller=new AbortController();const first=api.completeTask({provider:'ollama',model:'first',signal:controller.signal,onStreamEvent:e=>events.push(e)});
 await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(first,/중지|초과/);
 cancelledRequest.onStreamEvent({type:'message.delta',content:'late'});resolveLate({text:'late'});
 assert.equal(events.length,0);assert.equal((await api.completeTask({provider:'ollama',model:'second'})).text,'second alive');
});
test('AI Studio quick tools skip metadata round trips and pass an explicit output budget',async()=>{
 let body,metadataCalls=0;
 const context=vm.createContext({
  getAIStudioKeyForChat:async()=> 'fixture-key',aiChatGeminiModelLimits:{},
  normalizeAIChatMessages:messages=>messages.map(m=>({...m,attachments:m.attachments||[]})),
  isAIChatGeminiTtsModel:()=>false,isAIChatGeminiImageModel:()=>false,
  getAIChatGeminiModelLimits:async()=>{metadataCalls++;throw new Error('unnecessary metadata');},
  estimateAIChatTokens:text=>Math.ceil(String(text||'').length/4),
  fetch:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'answer'}]}}],usageMetadata:{candidatesTokenCount:2}})};}
 });
 vm.runInContext(declaration(app,'callAIStudioChat'),context);
 const result=await context.callAIStudioChat([{role:'user',content:'fixture'}],'system','gemini-3.5-flash-lite',undefined,'quick',false,undefined,undefined,false,{disableThinking:true,maxOutputTokens:512});
 assert.equal(result.text,'answer');assert.equal(metadataCalls,0);assert.equal(body.generationConfig.maxOutputTokens,512);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
});
test('math OCR preserves multiline equations, signs, matrices and code boundaries',()=>{
 const context=vm.createContext({});vm.runInContext(declaration(app,'cleanImg2MathLatex'),context);
 const result=context.cleanImg2MathLatex('```latex\n$a=-\\frac{1}{2}$\n$= -0.5$\n```');
 assert.match(result,/begin\{aligned\}/);assert.match(result,/-\\frac\{1\}\{2\}/);assert.match(result,/\\\\\n/);
 const matrix='\\begin{matrix}\n1 & -2 \\\\\n3 & 4\n\\end{matrix}';
 assert.equal(context.cleanImg2MathLatex(matrix),matrix);
});
test('SSP fast preset is Klein 4B only and never changes stored quality',()=>{
 const quality={width:1024,height:1024,steps:20,cfgScale:4,seed:42};let mode='fast';
 const context=vm.createContext({getLemonadeImageSettings:()=>({...quality}),localStorage:{getItem:()=>mode}});
 vm.runInContext(declaration(app,'getSspLemonadeGenerationSettings'),context);
 const fast=context.getSspLemonadeGenerationSettings('Flux-2-Klein-4B','16:9');assert.equal(fast.width,768);assert.equal(fast.height,448);assert.equal(fast.steps,4);assert.equal(fast.cfgScale,1);
 mode='quality';assert.equal(context.getSspLemonadeGenerationSettings('Flux-2-Klein-4B','1:1').steps,20);
 mode='fast';assert.equal(context.getSspLemonadeGenerationSettings('Flux-2-Klein-9B','1:1').width,1024);assert.equal(context.getSspLemonadeGenerationSettings('Flux-2-Klein-4B-Base','1:1').steps,20);
 assert.deepEqual(quality,{width:1024,height:1024,steps:20,cfgScale:4,seed:42});
});
test('SSP residency badge requires the selected model, not just any loaded model',async()=>{
 let data={all_models_loaded:[{model_name:'llm',backend_alive:true,status:'ready'}]};
 const context=vm.createContext({AbortController,setTimeout,clearTimeout,getStoredLemonadeConnection:()=>({}),openAICompatibleRequestUrl:()=> '/api/lemonade/v1/health',fetch:async()=>({ok:true,json:async()=>data})});
 vm.runInContext(declaration(app,'getWebdavSspRuntime'),context);
 assert.equal((await context.getWebdavSspRuntime('Flux-2-Klein-4B')).loaded,false);
 data.all_models_loaded.push({model_name:'Flux-2-Klein-4B',backend_alive:true,status:'ready',device:'gpu'});
 assert.equal((await context.getWebdavSspRuntime('Flux-2-Klein-4B')).loaded,true);
 data.all_models_loaded[1].backend_alive=false;assert.equal((await context.getWebdavSspRuntime('Flux-2-Klein-4B')).loaded,false);
  data.all_models_loaded[1].backend_alive=true;data.all_models_loaded[1].backend_health='error';assert.equal((await context.getWebdavSspRuntime('Flux-2-Klein-4B')).loaded,false);
});
test('a delayed stream repaint cannot replace the normalized final result',async()=>{
 let tick;
 const output={value:'previous',readOnly:false};
 const window={setInterval:fn=>{tick=fn;return 1;},clearInterval(){},setTimeout:()=>1,clearTimeout(){},openAiJenaChat:async()=>{},AIChat:{completeTask:async request=>{request.onStreamEvent({type:'message.delta',content:'raw stream'});return {text:'raw stream'};}}};
 const context=vm.createContext({window,document:{getElementById:()=>null,querySelectorAll:()=>[]},performance:{now:()=>1000},AbortController,DOMException});
 vm.runInContext(fs.readFileSync('mdpro/js/jena-tool-runtime.js','utf8'),context);
 const job=window.JenaToolRuntime.start('fixture',{output});await job.complete({});job.commit('normalized final');tick();
 assert.equal(output.value,'normalized final');job.finish(true);assert.equal(output.readOnly,false);
 const cancelled=window.JenaToolRuntime.start('fixture',{output});cancelled.abort();cancelled.finish(false);assert.equal(output.value,'normalized final');
});
test('default model policy preserves an explicit server ID and prefers an advertised Gemma only for a new choice',()=>{
 const picker=fs.readFileSync('mdpro/AI_App/aiChat/task-provider-picker.js','utf8');const window={};
 vm.runInContext(picker,vm.createContext({window}));
 assert.equal(window.AIJenaTaskPolicy.defaultModel('ollama',['gemma4:e4b','another'],'manual-server-id'),'manual-server-id');
 assert.equal(window.AIJenaTaskPolicy.defaultModel('ollama',['another','gemma4:e4b'],''),'gemma4:e4b');
});
test('a reused task panel stops the current run instead of its previous controller',()=>{
 const stop={},metrics={},panel={querySelector:selector=>selector==='[data-stop]'?stop:metrics};
 const window={setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}};
 const context=vm.createContext({window,document:{getElementById:id=>id==='fixture-task-status'?panel:null,querySelectorAll:()=>[]},performance:{now:()=>1000},AbortController,DOMException});
 vm.runInContext(fs.readFileSync('mdpro/js/jena-tool-runtime.js','utf8'),context);
 const first=window.JenaToolRuntime.start('fixture',{});first.finish(true);
 const second=window.JenaToolRuntime.start('fixture',{});stop.onclick();
 assert.equal(second.signal.aborted,true);assert.equal(first.signal.aborted,false);second.finish(false);
});
test('estimated generation includes reasoning without copying reasoning into the result editor',async()=>{
 const stop={},metrics={},panel={querySelector:selector=>selector==='[data-stop]'?stop:metrics},output={value:'',readOnly:false};
 const window={setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},openAiJenaChat:async()=>{},AIChat:{completeTask:async request=>{request.onStreamEvent({type:'reasoning.delta',content:'abcd'});request.onStreamEvent({type:'message.delta',content:'efgh'});return {text:'efgh'};}}};
 const context=vm.createContext({window,document:{getElementById:id=>id==='fixture-task-status'?panel:null,querySelectorAll:()=>[]},performance:{now:()=>1000},AbortController,DOMException});
 vm.runInContext(fs.readFileSync('mdpro/js/jena-tool-runtime.js','utf8'),context);
 const job=window.JenaToolRuntime.start('fixture',{output});await job.complete({});assert.equal(output.value,'efgh');assert.match(metrics.textContent,/생성 2 tok/);job.finish(true);
});

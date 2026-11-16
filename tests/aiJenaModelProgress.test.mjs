import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('  async function loadSelectedLocalModel()'),src.indexOf('  function storedOpenAICompatibleModel()'));
for(const provider of ['lemonade','lmstudio','ollama','aistudio','ollama-npu','litertlm','deepseek','openai','openai-compatible']) {
 test(provider+' progress completes only after successful provider response',async()=>{
  const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{value:'model',style:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;}});return els.get(id)};
  let finish;const pending=new Promise(r=>finish=r);let tick;let cleared=false;
  const bridge={loadLemonadeModel:()=>pending,loadLMStudioModel:()=>pending,loadOllamaModel:()=>pending,loadOpenAICompatibleTaskModel:()=>pending,loadLiteRTLMModel:()=>pending,refreshDeepseekModels:()=>pending,refreshOpenAIModels:()=>pending,refreshOpenAICompatibleModels:()=>pending,refreshGeminiModels:()=>pending};
  const ctx=vm.createContext({state:{provider,running:false},localModelLoading:false,AbortController,document:{getElementById:el},Date,setInterval:f=>(tick=f,1),clearInterval:()=>{cleared=true},setRunning(){},setStatus(){},getBridge:()=>bridge,refreshModels:async()=>{},saveHistory(){},updateHeaderModel(){}});
  vm.runInContext(code,ctx);const run=ctx.loadSelectedLocalModel();tick();assert(el('ai-chat-lemonade-load-progress-percent').textContent.includes('(예상)'));assert(Number(el('ai-chat-lemonade-load-progress')['aria-valuenow'])<100);
  finish(/^(aistudio|deepseek|openai|openai-compatible)$/.test(provider)?['model']:{model:'model'});await run;assert.equal(el('ai-chat-lemonade-load-progress-percent').textContent,'100%');assert.equal(ctx.localModelLoading,false);assert(cleared);
 });
}
test('failed cloud verification never reaches 100%',async()=>{
 const els={};let status;let cleared=false;const ctx=vm.createContext({state:{provider:'aistudio',running:false},localModelLoading:false,AbortController,Date,document:{getElementById:id=>els[id]??=( {value:'missing',style:{},classList:{toggle(){}},setAttribute(){}})},setInterval:()=>1,clearInterval:()=>{cleared=true},setRunning(){},setStatus:s=>status=s,getBridge:()=>({refreshGeminiModels:async()=>[]})});vm.runInContext(code,ctx);await ctx.loadSelectedLocalModel();assert.match(status,/실패/);assert.notEqual(els['ai-chat-lemonade-load-progress-percent'].textContent,'100%');assert.equal(ctx.localModelLoading,false);assert(cleared);
});

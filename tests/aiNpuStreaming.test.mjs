import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../mdpro/js/app.js',import.meta.url),'utf8');
const chat=readFileSync(new URL('../mdpro/AI_App/aiChat/ai-chat.js',import.meta.url),'utf8');
test('normal send and continuation pass NPU live events',()=>{
 const handlers=chat.split('\n').filter(line=>line.includes('? handleStreamEvent : undefined'));
 assert.equal(handlers.length,2);
 for(const line of handlers) assert(line.includes("state.provider === 'ollama-npu'"));
});
for(const mode of ['quick','reasoning']) test(`NPU ${mode} streams before completion and sets thinking explicitly`,async()=>{
 let finish,body;
 const events=[];
 const scope=vm.createContext({listNPUModels:async()=>['fixture-FLM'],localStorage:{getItem:()=> '[]'},
 getScholarAIProviderRuntime:()=>({getLMStudioConfig:()=>({quickMaxTokens:128,reasoningMaxTokens:256})}),
 normalizeAIChatMessages:rows=>rows,getNPUBaseUrl:()=> 'http://localhost',
 streamNPUChat:async(b,_settings,_signal,sink)=>{body=b;sink({type:'message.delta',content:'첫 토큰'});await new Promise(r=>finish=r);return {text:'첫 토큰'};},
 requestLocalAIJson:()=>{throw Error('must stream');}});
 vm.runInContext(app.slice(app.indexOf('async function callNPUChat('),app.indexOf('async function streamNPUChat(')),scope);
 const result=scope.callNPUChat({model:'fixture-FLM',mode,messages:[{role:'user',content:'안녕'}],onStreamEvent:e=>events.push(e)});
 await new Promise(r=>setImmediate(r));
 assert.equal(events[0].content,'첫 토큰');
 assert.equal(body.thinking,mode==='reasoning');assert.equal(body.chat_template_kwargs.enable_thinking,mode==='reasoning');
 finish();assert.equal((await result).text,'첫 토큰');
});

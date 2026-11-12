const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('mdpro/js/app.js','utf8');
const start = source.indexOf('    complete: async function (request) {',source.indexOf('window.AIChatBridge ='));
const end = source.indexOf('    abort: function ()',start);
function setup() {
  const calls=[];
  const context={applyLocalAIChatResponseStyle:r=>r,AbortController,DOMException,setTimeout,clearTimeout,aiChatAbortController:null,
    callAIStudioChat:async (...args)=>{
      const signal=args[3]; calls.push(signal);
      return await new Promise((resolve,reject)=>{
        signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
        calls[calls.length-1].finish=()=>resolve({text:'ok'});
        if(signal.aborted) reject(signal.reason);
      });
    }};
  vm.createContext(context);
  vm.runInContext('bridge = ({'+source.slice(start,end)+'});',context);
  return {context,calls,bridge:context.bridge};
}
test('ME cancellation leaves the active Jena request alive',async()=>{
  const {calls,bridge}=setup();
  const chat=bridge.complete({provider:'aistudio'});
  const controller=new AbortController();
  const me=bridge.complete({provider:'aistudio',independent:true,signal:controller.signal});
  controller.abort();
  await assert.rejects(me,{name:'AbortError'});
  assert.equal(calls[0].aborted,false);
  calls[0].finish();
  assert.equal((await chat).text,'ok');
});
test('ME has a bounded timeout and restores the bridge after failure',async()=>{
  const {bridge,calls}=setup();
  await assert.rejects(bridge.complete({provider:'aistudio',independent:true,timeoutMs:1000}),{name:'TimeoutError'});
  const retry=bridge.complete({provider:'aistudio',independent:true});
  calls[1].finish();
  assert.equal((await retry).text,'ok');
});

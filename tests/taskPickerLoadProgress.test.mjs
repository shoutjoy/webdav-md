import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('ME model-load progress follows real stages, completes at 100 and cleans its clock on failure', async () => {
  const nodes = [], intervals = new Set();
  function element(tag) {
    const node = { tag, style:{cssText:''}, dataset:{}, children:[], value:'',
      append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
      add(item) { this.children.push(item); }, replaceChildren(...items) { this.children = items; },
      setAttribute() {}, closest() { return null; }, after(item) { this.next = item; }
    };
    nodes.push(node); return node;
  }
  const root = { setInterval(fn) { intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); } };
  root.parent = root;
  const context = { window:root, document:{createElement:element}, localStorage:{getItem:()=>null,setItem(){}},
    Option:class { constructor(text,value) { this.text=text; this.value=value; } }, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(readFileSync('mdpro/AI_App/aiChat/task-provider-picker.js','utf8'), context);
  let progress, finish;
  const container = element('div');
  root.mountAITaskPicker(container, 'fixture', null, {
    initialSelection:{provider:'lemonade-flm',model:'gemma-FLM'}, showLoadProgress:true,
    getModels:async()=>({provider:'lemonade-flm',model:'gemma-FLM',models:['gemma-FLM']}),
    loadModel:async(_p,_m,_v,notify)=> { progress=notify; return new Promise((resolve,reject)=>{finish={resolve,reject};}); }
  });
  await new Promise(resolve=>setTimeout(resolve,0));
  const load = nodes.find(node=>node.textContent==='모델 로드');
  const bar = nodes.find(node=>node.tag==='progress');
  const badge = nodes.find(node=>node.className==='ai-task-connection');
  const pending = load.onclick();
  assert.equal(bar.value,0); assert.equal(intervals.size,1);
  progress('현재 로드 상태 확인 중'); assert.equal(bar.value,5);
  progress('서버에 모델 로드 요청 중'); assert.equal(bar.value,15);
  progress('모델 로딩 작업 · running'); assert.equal(bar.value,50);
  progress('서버의 모델 적재 완료 확인 중'); assert.equal(bar.value,90);
  finish.resolve({model:'gemma-FLM'}); await pending;
  assert.equal(bar.value,100); assert.equal(badge.dataset.state,'connected'); assert.equal(intervals.size,0);
  const failed = load.onclick(); progress('모델 로딩 작업 · running');
  finish.reject(new Error('out of memory')); await failed;
  assert.equal(bar.value,50); assert.equal(badge.dataset.state,'failed'); assert.equal(intervals.size,0);
});

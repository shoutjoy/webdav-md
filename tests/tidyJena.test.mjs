import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../mdpro/js/Tidy/tidy-script-manager.js', import.meta.url), 'utf8');
function setup() {
  let settings = {};
  const window = { crypto: { randomUUID: () => 'test' } };
  const context = vm.createContext({ window, document: { currentScript: null, getElementById: () => null }, TextEncoder, TextDecoder, URL, console });
  vm.runInContext(source, context);
  return { window, configure: () => window.TidyScriptManager.configure({ getSettings: async () => settings, setSettings: async value => { settings = value; } }) };
}
test('generated transform saves and reloads through the TIDY bridge', async () => {
  const { window, configure } = setup();
  await configure();
  const code = 'function transform(source, context) { return source.toUpperCase(); }';
  const result = await window.TidyScriptManagerBridge.save({ name: '대문자', code, enabled: true });
  assert.equal(result.record.code, code);
  const records = await window.TidyScriptManagerBridge.list();
  assert.equal(records.length, 1);
  assert.equal(window.TidyScriptManagerBridge.validate(records[0].code)('abc', {}), 'ABC');
});
test('invalid AI code is rejected before saving', async () => {
  const { window, configure } = setup();
  await configure();
  await assert.rejects(window.TidyScriptManagerBridge.save({ name: '잘못된 코드', code: 'function transform( {' }));
  assert.equal((await window.TidyScriptManagerBridge.list()).length, 0);
});
test('test execution refuses an environment without terminable workers', async () => {
  const { window } = setup();
  await assert.rejects(window.TidyScriptManagerBridge.test('function transform(s) { return s; }', 'text'), /Worker/);
});

test('JENA selects cached models and applies generated code with the older bridge', async () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value:'', checked:true, disabled:false, dataset:{}, children:[], classList:{toggle(){}}, closest(){return {after(){}};}, appendChild(child){this.children.push(child);}, replaceChildren(...children){this.children=children;}, addEventListener(){}, dispatchEvent(){}, scrollIntoView(){} });
    return elements.get(id);
  }
  const code = 'function transform(source) { return source.toUpperCase(); }';
  const document = { getElementById:element, createElement:()=>({ ...element(Symbol()) }), head:{appendChild(){}}, body:{classList:{toggle(){}}}, addEventListener(){} };
  const window = { opener:{TidyScriptManagerBridge:{}, TidyScriptManager:{compileTransformer(value){assert.equal(value,code);}}, AIChatBridge:{getCachedGeminiModels:()=>['model-a','model-b'], complete:async request=>{assert.equal(request.model,'model-b');return {text:'설명\n```javascript\n'+code+'\n```',reasoning:'수정 요약'};}}}, addEventListener(){} };
  const storage = new Map([['ss_ai_chat_provider','aistudio'],['ss_ai_chat_gemini_model','model-a']]);
  const dataRecords = [];
  window.opener.AIChatBridge.saveAIDataRecord = async record => { dataRecords.push(record); return true; };
  let registered = false;
  window.TidyManagerUI = { getId:()=> registered ? 'saved-script' : '', addToTidy:async()=>{registered=true;return {record:{name:'대문자'}};}, restoreDraft:item=>{element('code').value=item.code;} };
  const context=vm.createContext({window,document,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}, Option:function(text,value){this.text=text;this.value=value;},Event:function(){},console});
  vm.runInContext(fs.readFileSync(new URL('../mdpro/js/Tidy/tidy-jena.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(element('jena-model').children.map(item=>item.value),['','model-a','model-b']);
  element('jena-model').value='model-b';
  element('jena-prompt').value='대문자로 수정';
  element('code').value='function transform(s) { return s; }';
  await element('jena-send').onclick();
  assert.equal(element('code').value,code);
  assert.equal(element('jena-reasoning').textContent,'수정 요약');
  assert.ok(!element('jena-chat').children.some(item=>String(item.textContent).includes('```')));
  let sessions=JSON.parse(storage.get('mdviewer.tidy.jena.conversations.v1'));
  assert.equal(sessions.length,1);
  assert.equal(sessions[0].history[0].content,'대문자로 수정');
  assert.ok(sessions[0].history[1].content.includes(code));
  assert.equal(sessions[0].code,code);
  await element('jena-register').onclick();
  sessions=JSON.parse(storage.get('mdviewer.tidy.jena.conversations.v1'));
  assert.equal(registered,true);
  assert.equal(sessions[0].scriptId,'saved-script');
  element('jena-prompt').value='다음 요청 초안';
  element('jena-save-chat').onclick();
  assert.equal(JSON.parse(storage.get('mdviewer.tidy.jena.conversations.v1'))[0].prompt,'다음 요청 초안');
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(dataRecords.length >= 3);
  assert.equal(new Set(dataRecords.map(record=>record.id)).size,1);
  assert.equal(dataRecords[0].messages.length,1);
  const latest=dataRecords.at(-1);
  assert.equal(latest.recordType,'conversation');
  assert.equal(latest.source,'tidy-js-jena');
  assert.equal(latest.scriptId,'saved-script');
  assert.equal(latest.code,code);
  assert.equal(latest.draftPrompt,'다음 요청 초안');
  assert.equal(latest.model,'model-b');
  assert.equal(latest.messages.length,2);
  window.opener.AIChatBridge.saveAIDataRecord = async () => false;
  element('jena-save-chat').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(element('jena-data-status').textContent.includes('기록 실패'));
  assert.equal(JSON.parse(storage.get('mdviewer.tidy.jena.conversations.v1'))[0].code,code);
});

test('manager reuses an internal dialog without opening another browser window', () => {
  const nodes = new Map();
  const document = { currentScript:null, getElementById:id=>nodes.get(id), createElement:tag=>({tag,style:{},setAttribute(){},appendChild(child){this.child=child;},showModal(){this.open=true;},close(){this.open=false;}}), body:{appendChild(node){nodes.set(node.id,node);}} };
  const window = {open(){throw new Error('External popup must not be used');}};
  vm.runInContext(source,vm.createContext({window,document,URL,TextEncoder,TextDecoder,console}));
  assert.equal(window.TidyScriptManager.openManager(),true);
  const dialog=nodes.get('tidy-manager-dialog');
  assert.equal(dialog.child.tag,'iframe');
  assert.equal(dialog.open,true);
  window.TidyScriptManager.closeManager();
  assert.equal(dialog.open,false);
  window.TidyScriptManager.openManager();
  assert.equal(nodes.get('tidy-manager-dialog'),dialog);
});

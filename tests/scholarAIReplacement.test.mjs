import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('mdpro/sidebarAI/insert.js','utf8');
function setup(raw='before source after',storage=new Map()) {
 const frames=[];
 const classes=()=>({toggle(){},remove(){},contains(){return true},add(){}});
 const editor={value:raw,isConnected:true,scrollTop:123,scrollLeft:45,selectionStart:7,selectionEnd:13,style:{},classList:classes(),dispatchEvent(){this.scrollTop=999;this.scrollLeft=888},focus(opts){assert.equal(opts.preventScroll,true)},setSelectionRange(){}};
 const selected={value:'source'}, checkbox={checked:true}, button={}, items=[0,1,2,3,4,6].map(mode=>({dataset:{insertMode:String(mode)},classList:{toggle(k,v){this.active=v}},setAttribute(){}}));
 const viewport={scrollTop:73,scrollLeft:19,classList:classes()};
 const elements={'viewer-edit-ta':editor,'scholar-ai-selected':selected,'scholar-ai-live-replace':checkbox,'content-viewport':viewport,'scholar-ai-insert-mode-button':button,'scholar-ai-insert-menu':{classList:classes(),querySelectorAll(){return items}}};
 const window={scrollX:3,scrollY:7,scrollTo(){},requestAnimationFrame(fn){frames.push(fn)},SidebarAIInsertDeps:{getInsertResultText:()=> 'answer',getSelectionState:()=>({cursorPos:7}),isTextSelectionControl:()=>true,setSelectionState(){}}};
 const context={window,document:{readyState:'complete',getElementById:id=>elements[id],querySelector:()=>null},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},Event:class {},alert(msg){throw new Error(msg)},setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 return {window,api:window.ScholarAIReplacement,editor,selected,viewport,button,items,storage,flush(){while(frames.length)frames.shift()()}};
}
test('live replacement streams only supplied answer and commits in same range',()=>{const t=setup();const tx=t.api.begin();assert.equal(t.editor.value,'before  after');t.api.update(tx,'번');t.api.update(tx,'번역');t.api.finish(tx,'번역');assert.equal(t.editor.value,'before 번역 after');t.flush();assert.equal(t.editor.scrollTop,123);assert.equal(t.editor.scrollLeft,45);assert.equal(t.viewport.scrollTop,73)});
for(const reason of ['stop','error','empty']) test(`${reason} restores original and ignores late chunks`,()=>{const t=setup();const tx=t.api.begin();t.api.update(tx,'partial');if(reason==='empty')t.api.finish(tx,'');else t.api.cancel();t.api.update(tx,'late');t.api.finish(tx,'late');assert.equal(t.editor.value,'before source after')});
test('pasted passage requires exactly one match including overlapping matches',()=>{for(const raw of ['missing','source source','aaa']){const t=setup(raw);if(raw==='aaa')t.selected.value='aa';assert.throws(()=>t.api.begin(),/다시 선택/);assert.equal(t.editor.value,raw)}});
test('captured selection permits duplicate text but rejects source edits',()=>{const t=setup('source source');t.api.capture(t.editor,7,13,'source');const tx=t.api.begin();t.api.finish(tx,'answer');assert.equal(t.editor.value,'source answer');const u=setup();u.api.capture(u.editor,7,13,'source');u.editor.value='before edited after';assert.throws(()=>u.api.begin(),/변경/)});
test('document changes abort replacement and preserve unrelated edits on rollback',()=>{const t=setup();const tx=t.api.begin();t.api.update(tx,'partial');t.editor.value+=' user edit';assert.throws(()=>t.api.update(tx,'next'),/변경/);assert.equal(t.editor.value,'before source after user edit')});
test('menu selection persists without inserting and arrow executes saved action',()=>{const t=setup();t.window.scholarAISelectInsertMode(2);assert.equal(t.editor.value,'before source after');assert.equal(t.button.textContent,'선택 내용 대체');assert.ok(t.items[2].classList.active);const u=setup(undefined,t.storage);assert.equal(u.button.textContent,'선택 내용 대체');u.window.handleScholarAIInsertClick();assert.equal(u.editor.value,'before answer after')});
test('cursor insertion restores both scroll axes after input and height updates',()=>{const t=setup();t.window.scholarAIInsertDoc(0);t.flush();assert.equal(t.editor.value,'before answersource after');assert.equal(t.editor.scrollTop,123);assert.equal(t.editor.scrollLeft,45)});

function loadFunction(file,name,extras='') {
 const source=readFileSync(file,'utf8');const start=source.indexOf('  function '+name+'(');let level=0,end=start;
 const body=source.indexOf('{',start);for(end=body;end<source.length;end++){if(source[end]==='{')level++;if(source[end]==='}'&&!--level)break;}
 return vm.runInNewContext(extras+'\n'+source.slice(start,end+1)+'\n'+name);
}
test('general execution parses answer markers and excludes explanation and hidden reasoning',()=>{
 const normalize=loadFunction('mdpro/sidebarAI/sidebar-ai.js','scholarAINormalizeResultText').toString();
 const parse=loadFunction('mdpro/sidebarAI/sidebar-ai.js','scholarAIParseExplanationResult',normalize);
 assert.equal(parse('[EXPLANATION]설명\n[RESULT]본문\n[REASONING]추론').result,'본문');
 assert.equal(parse('<think>추론</think>[ANSWER]번역').result,'번역');
 assert.equal(parse('[REASONING]추론').result,'');
});
test('academic translation envelope excludes terminology and reasoning',()=>{
 const normalize=loadFunction('mdpro/sidebarAI/scholar-ai-upgrades.js','normalizeCodeFence').toString();
 const parse=loadFunction('mdpro/sidebarAI/scholar-ai-upgrades.js','parseEnvelope',normalize);
 assert.equal(parse('[ANSWER]번역 본문\n[REASONING]용어 풀이',true).answer,'번역 본문');
 assert.equal(parse('<think>추론</think>[ANSWER]번역',true).answer,'번역');
});
test('all static and dynamic ScholarAI templates expose live checkbox and six saved modes',()=>{
 for(const file of ['mdpro/index.html','mdpro/sidebarAI/sidebar-ai.html','mdpro/sidebarAI/sidebar-ai.js']){
  const s=readFileSync(file,'utf8');assert.match(s,/id="scholar-ai-live-replace"/);assert.match(s,/id="scholar-ai-insert-mode-button"/);
  for(const mode of [0,1,2,3,4,6])assert.ok(s.includes(`scholarAISelectInsertMode(${mode})`));
  assert.ok(!/scholarAIInsertDoc\(\d\); closeScholarAIInsertMenu/.test(s));
 }
});
test('stream transport buffers split events, excludes reasoning, and propagates errors',async()=>{
 const app=readFileSync('mdpro/js/app.js','utf8');const start=app.indexOf('async function readScholarTextStream('),end=app.indexOf('\nasync function callDeepseekChatText(',start);
 const read=vm.runInNewContext(app.slice(start,end)+'\nreadScholarTextStream',{TextDecoder,Uint8Array,Error});
 const chunks=['data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\ndata: {"choices":', '[{"delta":{"content":"본문"}}]}\n\ndata: [DONE]\n'];let i=0,cancelled=false,output='';
 const response={body:{getReader:()=>({read:async()=>i<chunks.length?{value:new TextEncoder().encode(chunks[i++]),done:false}:{done:true},cancel:async()=>{cancelled=true}})}};
 const result=await read(response,d=>d.choices?.[0]?.delta?.content||'',delta=>{output+=delta});assert.equal(result.text,'본문');assert.equal(output,'본문');assert.ok(cancelled);
 i=0;chunks.splice(0,chunks.length,'data: {"error":{"message":"failed"}}\n');await assert.rejects(read(response,()=>'',()=>{}),/failed/);
});
test('general execution updates result and document before the AI request resolves',async()=>{
 const source=readFileSync('mdpro/sidebarAI/sidebar-ai.js','utf8');
 const start=source.indexOf('  async function scholarAIRun() {'),end=source.indexOf('  function scholarAICopyResult()',start);
 const elements={'scholar-ai-selected':{value:'source'},'scholar-ai-prompt':{value:'rewrite'},'scholar-ai-result':{value:''},'scholar-ai-result-insert':{value:''}};
 let finish,options,documentText='source';const pending=new Promise(resolve=>{finish=resolve});
 const context={document:{getElementById:id=>elements[id]},window:{ScholarAIReplacement:{begin:()=>({}),update:(tx,text)=>{documentText=text},finish:(tx,text)=>{documentText=text},cancel(){}}},getCallback:()=>((p,s,search,model,opts)=>{options=opts;assert.match(s,/FIRST/);return pending}),invokeSync:()=>'',scholarAIIsSlideMakerActive:()=>false,scholarAIGetTonePreset:()=>'',scholarAIGetToneInstruction:()=>'',scholarAISetRunningState(){},scholarAIApplyResultText(raw){const result=raw.startsWith('[RESULT]')?raw.slice(8):'';elements['scholar-ai-result-insert'].value=result;return {result}},scholarAIParseExplanationResult:raw=>({result:raw.slice(8)}),scholarAIHistoryAdd(){},scholarAIHistoryRender(){},scholarAIStopProgress(){},alert:assert.fail};
 vm.createContext(context);vm.runInContext('var scholarAIRunEpoch=0;\n'+source.slice(start,end),context);
 const task=context.scholarAIRun();options.onText('[RES');assert.equal(documentText,'');options.onText('ULT]실시간');assert.equal(documentText,'실시간');assert.equal(elements['scholar-ai-result-insert'].value,'실시간');
 finish({text:'[RESULT]실시간 완료'});await task;assert.equal(documentText,'실시간 완료');
});
test('streaming result remains available with document replacement unchecked',async()=>{
 const source=readFileSync('mdpro/sidebarAI/sidebar-ai.js','utf8'),start=source.indexOf('  async function scholarAIRun() {'),end=source.indexOf('  function scholarAICopyResult()',start);
 let options,finish,preview='';const pending=new Promise(resolve=>finish=resolve);
 const context={document:{getElementById:()=>({value:'source'})},window:{ScholarAIReplacement:{begin:()=>null}},getCallback:()=>((p,s,search,model,opts)=>{options=opts;return pending}),invokeSync:()=>'',scholarAIIsSlideMakerActive:()=>false,scholarAIGetTonePreset:()=>'',scholarAIGetToneInstruction:()=>'',scholarAISetRunningState(){},scholarAIApplyResultText(raw){preview=raw;return {result:raw}},scholarAIHistoryAdd(){},scholarAIHistoryRender(){},scholarAIStopProgress(){},alert:assert.fail};
 vm.createContext(context);vm.runInContext('var scholarAIRunEpoch=0;\n'+source.slice(start,end),context);const task=context.scholarAIRun();options.onText('[RESULT]첫 조각');assert.equal(preview,'[RESULT]첫 조각');finish({text:'[RESULT]완료'});await task;
});

test('plain general replies remain writable while explanation-only replies stay excluded',()=>{
 const normalize=loadFunction('mdpro/sidebarAI/sidebar-ai.js','scholarAINormalizeResultText').toString();
 const parse=loadFunction('mdpro/sidebarAI/sidebar-ai.js','scholarAIParseExplanationResult',normalize);
 assert.equal(parse('일반 요청의 답변').result,'일반 요청의 답변');
 assert.equal(parse('<think>비공개 추론</think>최종 본문').result,'최종 본문');
 assert.equal(parse('[EXPLANATION]설명만').result,'');
});

test('special requests replace selection regardless of presentation',async()=>{
 const s=readFileSync('mdpro/sidebarAI/scholar-ai-upgrades.js','utf8');
 const start=s.indexOf('  async function runSpecial('),end=s.indexOf('  function protectedRanges(',start);
 for(const presentation of ['default','translation','slides']){
  let output='source',opts;
  const context={el:id=>id==='scholar-ai-selected'?{value:'source'}:null,window:{ScholarAIReplacement:{begin(){output='';return {}},update(tx,text){output=text},finish(tx,text){output=text},cancel(){output='source'}}},getCallback:name=>name==='callScholarAI'?async(p,sys,search,model,o)=>{opts=o;o.onText('streamed');assert.equal(output,'streamed');return {text:'complete'}}:null,setRunning(){},setPresentation(){},applyResult:raw=>({answer:raw}),alert:assert.fail};
  vm.createContext(context);vm.runInContext('var specialRunEpoch=0;\n'+s.slice(start,end),context);
  await context.runSpecial({presentation,system:'write',prompt:'rewrite'});
  assert.equal(output,'complete');assert.equal(typeof opts.onText,'function');
 }
});

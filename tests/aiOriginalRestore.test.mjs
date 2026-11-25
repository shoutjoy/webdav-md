import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../mdpro/js/app.js',import.meta.url),'utf8');
function runtime(storage=new Map()) {
 const editor={value:'대체 결과',dispatchEvent(){}};
 const ctx=vm.createContext({editorTextarea:editor,activeRealtimeDocStream:null,isEditMode:true,currentMarkdown:'',activeSidebarTab:'',
 getTocDocumentKey:()=>ctx.doc,doc:'a',Event:class {},pushReplaceUndoSnapshot(){},performAutoSave(){},
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
 vm.runInContext(src.slice(src.indexOf('function aiOriginalBackupKey('),src.indexOf('function insertAIChatTextIntoDocument(')),ctx);
 return {ctx,editor,storage};
}
test('durable original survives runtime restart and is restored once',()=>{
 const first=runtime();first.ctx.saveAIOriginalBackup('원문','대체 결과');
 const next=runtime(first.storage);assert(next.ctx.restoreAIOriginalDocument());assert.equal(next.editor.value,'원문');
 assert.throws(()=>next.ctx.restoreAIOriginalDocument(),/저장된 원문이 없습니다/);
});
test('later edits and different documents cannot be overwritten',()=>{
 const {ctx,editor}=runtime();ctx.saveAIOriginalBackup('원문','대체 결과');editor.value='추가 편집';
 assert.throws(()=>ctx.restoreAIOriginalDocument(),/문서가 변경/);assert.equal(editor.value,'추가 편집');
 ctx.doc='b';assert.throws(()=>ctx.restoreAIOriginalDocument(),/저장된 원문이 없습니다/);
});
test('backup failure blocks replacement and active stream blocks restore',()=>{
 const {ctx}=runtime();ctx.localStorage.setItem=()=>{throw Error('quota');};
 assert.throws(()=>ctx.saveAIOriginalBackup('원문','결과'),/백업을 저장하지 못/);
 ctx.activeRealtimeDocStream={};assert.throws(()=>ctx.restoreAIOriginalDocument(),/중지/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../mdpro/js/app.js',import.meta.url),'utf8');
function runtime(){
 const editor={value:'앞 원문 뒤',selectionStart:2,selectionEnd:4};
 const c=vm.createContext({editorTextarea:editor,isEditMode:true,saveAIOriginalBackup:(before,after)=>({before,after}),pushReplaceUndoSnapshot(){},applyRealtimeDocText(){}});
 vm.runInContext(source.slice(source.indexOf('let activeRealtimeDocStream = null;'),source.indexOf("document.addEventListener('selectionchange'",source.indexOf('let activeRealtimeDocStream = null;'))),c);
 vm.runInContext(source.slice(source.indexOf('function startRealtimeDocStream('),source.indexOf('let realtimeDocFollowFrame')),c);
 return {c,editor};
}
test('import retains replacement range after editor selection collapses',()=>{
 const {c,editor}=runtime();c.rememberImportedDocumentSelection('원문');
 editor.selectionStart=editor.selectionEnd=0;c.rememberEditorSelection();
 const result=c.startRealtimeDocStream({target:'cursor'});
 assert.equal(result.isReplacing,true);
 assert.equal(vm.runInContext('activeRealtimeDocStream.before',c),'앞 ');
 assert.equal(vm.runInContext('activeRealtimeDocStream.after',c),' 뒤');
 assert.equal(vm.runInContext('importedEditorSelection',c),null);
});
test('changed imported source fails before deleting content',()=>{
 const {c,editor}=runtime();c.rememberImportedDocumentSelection('원문');editor.value='앞 수정 뒤';
 assert.throws(()=>c.startRealtimeDocStream({target:'cursor'}),/원문이 변경/);
 assert.equal(editor.value,'앞 수정 뒤');
});
test('explicit document end target still appends',()=>{
 const {c}=runtime();c.rememberImportedDocumentSelection('원문');
 assert.equal(c.startRealtimeDocStream({target:'document-end'}).isReplacing,false);
 assert.equal(vm.runInContext('activeRealtimeDocStream.anchorStart',c),6);
});

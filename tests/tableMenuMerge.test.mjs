import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
const source=fs.readFileSync('mdpro/js/app.js','utf8');
const ast=parse(source,{ecmaVersion:'latest'});
const names=['splitJenaTableRow','isJenaTableDivider','getMarkdownTableStructureAtCursor','serializeMarkdownTableRow','editMarkdownTableStructure'];
const functions=names.map(name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);}).join('\n');
const original='before\n| A | B |\n| :--- | ---: |\n| x | y |\n| z | w |\nafter';
function run(action,{text=original,at='x',delimiter,readOnly=false}={}){
 const editor={value:text,selectionStart:text.indexOf(at),readOnly};
 const state={editorTextarea:editor,isEditMode:true,activeSidebarTab:'none',document:{getElementById:()=>delimiter===undefined?null:{value:delimiter}},showToast(){},renderMarkdown(){},performAutoSave(){},closeTableInsertPicker(){},replaceTextareaContentWithUndo(value,start,end){state.undoBefore=editor.value;editor.value=value;editor.selectionStart=start;editor.selectionEnd=end;}};
 vm.createContext(state);vm.runInContext(functions,state);state.editMarkdownTableStructure(action);return {...state,text:editor.value};
}
test('row down/up merge data with default br and preserve surrounding text',()=>{
 const expected='before\n| A | B |\n| :--- | ---: |\n| x<br>z | y<br>w |\nafter';
 assert.equal(run('merge-row-down').text,expected);
 assert.equal(run('merge-row-up',{at:'z'}).text,expected);
});
test('column right/left merge the whole table and preserve divider alignment',()=>{
 const expected='before\n| A B |\n| :--- |\n| x y |\n| z w |\nafter';
 assert.equal(run('merge-column-right').text,expected);
 assert.equal(run('merge-column-left',{at:'y'}).text,expected);
});
test('boundaries and header rows cannot accidentally merge data',()=>{
 for(const [action,at] of [['merge-row-up','x'],['merge-row-down','z'],['merge-row-down','A'],['merge-column-left','x'],['merge-column-right','y']])assert.equal(run(action,{at}).text,original);
});
test('delimiter pipes stay cell content and CRLF survives',()=>{
 const result=run('merge-column-right',{text:original.replaceAll('\n','\r\n'),delimiter:'|\n'});
 assert(result.text.includes('| x&#124; y |\r\n'));assert(!/(?<!\r)\n/.test(result.text));
});
test('empty delimiter and empty cells do not add placeholder content',()=>{
 assert(run('merge-row-down',{delimiter:''}).text.includes('| xz | yw |'));
 const text=original.replace('| x | y |','| x | |');
 assert(run('merge-row-down',{text}).text.includes('| x<br>z | w |'));
});
test('readonly is protected and successful merge uses target undo path',()=>{
 assert.equal(run('merge-row-down',{readOnly:true}).text,original);
 assert.equal(run('merge-row-down').undoBefore,original);
});

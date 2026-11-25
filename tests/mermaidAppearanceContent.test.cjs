const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},Intl};for(const file of ['appearance-custom.js','appearance-content.js','appearance-custom2.js','appearance-types.js','appearance-source.js'])vm.runInNewContext(fs.readFileSync('mdpro/js/mermaid/'+file,'utf8'),context);
const api=context.window.MermaidAppearanceContent,source=context.window.MermaidAppearanceSource;
const item={id:'content-1',kind:'note',text:'제목\n설명 100% <script>plain</script> %%{init: {}}%%',x:20,y:-30,fontSize:24,width:300,padding:12,borderWidth:2,opacity:.5,color:'#112233',fill:'#ffffcc',border:'#224466',bold:true,align:'middle'};
test('cross-diagram content roundtrips without changing the base source or parsing text as directives',()=>{
 for(const code of ['flowchart LR\nA-->B','mindmap\n root((Plan))','sequenceDiagram\nA->>B: hi','---\nconfig:\n theme: dark\n---\nkanban\n Todo']){
  const c={version:1,sourceKey:context.window.MermaidAppearanceCustom.sourceKey(code),items:[],annotations:[item]};const saved=source.serialize(code,{custom2:c},[],0);
  assert.equal(source.readAppearance(saved).custom2.annotations[0].text,item.text);assert.ok(saved.includes('\\u0025'));assert.equal(source.serialize(saved,{},[],0),code);
 }
});
test('content rejects invalid geometry, colors, excessive text and duplicate identifiers',()=>{
 for(const patch of [{fontSize:Infinity},{x:10001},{color:'url(bad)'},{text:''},{kind:'script'},{text:'a'.repeat(4001)}])assert.throws(()=>api.clean([{...item,...patch}]));
 assert.throws(()=>api.clean([item,item]));assert.throws(()=>api.clean(Array.from({length:6},(_,i)=>({...item,id:'c'+i,text:'a'.repeat(4000)}))));
});

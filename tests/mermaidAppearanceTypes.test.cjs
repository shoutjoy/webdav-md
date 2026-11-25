const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};
for(const file of ['appearance-types.js','appearance-source.js'])vm.runInNewContext(fs.readFileSync('mdpro/js/mermaid/'+file,'utf8'),context);
const api=context.window.MermaidAppearanceSource,types=context.window.MermaidAppearanceTypes;
test('type detection skips YAML, managed comments, and init without reading labels as types',()=>{
 assert.equal(types.type('---\nconfig: {}\n---\n%% comment\nkanban\n  Todo'),'kanban');
 assert.equal(types.type('%%{init: {}}%%\n%% comment\nmindmap\n root'),'mindmap');
});
test('non-flow source preserves syntax and YAML, repeated apply and reset are stable',()=>{
 for(const source of ['mindmap\n root((Test))\n  Child','quadrantChart\n A: [0.2,0.5]','sequenceDiagram\n A->>B: Hello','---\nconfig:\n  theme: dark\n---\nkanban\n Todo\n  a[Task]']) {
  const a={font:22,fill:'#112233',pointSize:8,chartWidth:1.4,layoutSpacing:2};
  const saved=api.serialize(source,a,[],0);assert.equal(api.readAppearance(saved).pointSize,8);
  const second=api.serialize(saved,a,[],0);assert.equal(second,saved);
  assert.equal(api.serialize(second,{},[],0),source);
  if(source.startsWith('---'))assert.ok(saved.startsWith('---\nconfig:\n  theme: dark\n---\n'));
 }
});
test('new layout values reject non-finite and unsafe input',()=>{
 for(const [key,value] of [['pointSize',0],['chartWidth',11],['chartHeight',Infinity],['layoutSpacing',-1]]){
  assert.throws(()=>api.serialize('mindmap\n root',{[key]:value},[],0));
  assert.equal(api.readAppearance('%% MDPRO appearance values '+(Number.isFinite(value)?JSON.stringify({[key]:value}):'{"'+key+'":1e999}')),null);
 }
});

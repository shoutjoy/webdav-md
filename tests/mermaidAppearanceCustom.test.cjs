const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};for(const f of ['appearance-custom.js','appearance-types.js','appearance-source.js'])vm.runInNewContext(fs.readFileSync('mdpro/js/mermaid/'+f,'utf8'),context);
const api=context.window.MermaidAppearanceCustom,source=context.window.MermaidAppearanceSource;
test('custom settings roundtrip for flowchart and YAML without losing source',()=>{
 for(const code of ['flowchart LR\nA-->B','---\nconfig:\n theme: dark\n---\nkanban\n Todo\n  a[Task]']){
  const c={version:1,sourceKey:api.sourceKey(code),rules:[{index:1,signature:'rect|a|g|node',style:{fill:'#112233',strokeWidth:80,opacity:.4,dash:'dashed'}}]};
  const saved=source.serialize(code,{custom:c},[],0);assert.equal(source.readAppearance(saved).custom.rules[0].style.strokeWidth,80);
  assert.equal(api.sourceKey(saved),c.sourceKey);assert.equal(source.serialize(saved,{},[],0),code);
 }
});
test('custom settings reject unsafe CSS, invalid targets, huge sets and values',()=>{
 assert.throws(()=>api.style({fill:'url(https://bad)'}));assert.throws(()=>api.style({filter:'blur(10px)'}));assert.throws(()=>api.style({strokeWidth:Infinity}));assert.throws(()=>api.style({opacity:2}));
 for(const index of [-1,1.5,999999])assert.throws(()=>api.clean({version:1,sourceKey:'abc-1',rules:[{index,signature:'rect',style:{}}]}));
 assert.throws(()=>api.clean({version:1,sourceKey:'abc-1',rules:Array(501).fill({})}));
});
test('expanded common ranges roundtrip and reject values above the new bounds',()=>{
 const code='flowchart LR\nA-->B',a={font:200,stroke:100,nodeStroke:0,arrowSize:10,edgeLength:30,width:10};
 const saved=source.serialize(code,a,['A','B'],1);assert.equal(source.readAppearance(saved).edgeLength,30);assert.match(saved,/stroke-width:100px/);
 assert.throws(()=>source.serialize(code,{font:201},['A','B'],1));
 assert.equal(source.readAppearance('%% MDPRO appearance values {"chartWidth":10}').chartWidth,10);
});
test('group tools preserve multiple targets and accept previous single-target settings',()=>{
 const tool={id:'group',label:'막대',property:'fill',index:1,signature:'rect|bar',targets:[{index:1,signature:'rect|bar'},{index:2,signature:'rect|bar'}]};
 const value={version:1,sourceKey:'abc-4',rules:[],tools:[tool]};
 assert.equal(api.clean(value).tools[0].targets.length,2);
 const old={...tool};delete old.targets;
 assert.equal(api.clean({...value,tools:[old]}).tools[0].targets.length,1);
 assert.throws(()=>api.clean({...value,tools:[{...tool,targets:[tool.targets[0],tool.targets[0]]}]}));
 assert.throws(()=>api.clean({...value,tools:[{...tool,targets:[]}]}));
 const saved=source.serialize('flowchart LR\nA-->B',{custom:value},[],0);
 assert.equal(source.readAppearance(saved).custom.tools[0].targets.length,2);
});

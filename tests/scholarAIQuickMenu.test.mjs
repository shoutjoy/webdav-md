import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const upgrades=readFileSync('mdpro/sidebarAI/scholar-ai-upgrades.js','utf8');
function menuHarness(){
 const make=()=>{const values=new Set();return {classList:{toggle(k,v){if(v)values.add(k);else values.delete(k)},contains:k=>values.has(k),add:k=>values.add(k),remove:k=>values.delete(k)},setAttribute(k,v){this[k]=v}}};
 const checkbox={checked:false},menu=make(),wrap=make(),toggle=make();
 const elements={'scholar-ai-quick-expand':checkbox,'scholar-ai-quick-menu':menu,'scholar-ai-quick-wrap':wrap,'scholar-ai-quick-toggle':toggle};
 const context={el:id=>elements[id],rewriteAcademicIda:()=> 'tone',translateAcademic:()=> 'translation',generateSlides:()=> 'slides'};
 vm.createContext(context);vm.runInContext(upgrades.slice(upgrades.indexOf('  function setQuickExpanded('),upgrades.indexOf('  function init() {')),context);
 return {context,checkbox,menu,wrap,toggle};
}
test('checkbox expands inline controls and unchecking collapses them',()=>{const h=menuHarness();h.context.setQuickExpanded(true);assert.ok(h.checkbox.checked);assert.ok(h.menu.classList.contains('expanded'));assert.ok(h.wrap.classList.contains('inline-expanded'));assert.equal(h.toggle['aria-expanded'],'true');h.context.setQuickExpanded(false);assert.ok(!h.menu.classList.contains('expanded'));assert.equal(h.toggle['aria-expanded'],'false')});
test('expanded actions remain visible after execution and outside-click closing',()=>{const h=menuHarness();h.context.setQuickExpanded(true);for(const action of ['tone','translate','slides'])h.context.runQuickAction(action);h.context.closeQuickMenu();assert.ok(h.menu.classList.contains('expanded'));assert.ok(h.checkbox.checked);assert.equal(h.toggle['aria-expanded'],'true')});
test('existing dropdown remains reachable while unchecked',()=>{const h=menuHarness();h.context.toggleQuickMenu();assert.ok(h.menu.classList.contains('open'));h.context.closeQuickMenu();assert.ok(!h.menu.classList.contains('open'))});
test('all ScholarAI templates include checkbox, short buttons and translation direction',()=>{for(const file of ['mdpro/index.html','mdpro/sidebarAI/sidebar-ai.html','mdpro/sidebarAI/sidebar-ai.js']){const html=readFileSync(file,'utf8');assert.match(html,/id="scholar-ai-quick-expand"/);for(const [id,label]of [['academic-ida-btn','문체'],['academic-translate-btn','번역'],['slide-generate-btn','slide']])assert.match(html,new RegExp('id="scholar-ai-'+id+'"[^>]*>'+label+'</button>'));assert.match(html,/id="scholar-ai-translation-direction"/);assert.match(html,/value="en-ko"/);assert.match(html,/value="ko-en"/)}});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('mdpro/AI_App/aiChat/ai-chat.js','utf8');
const start=source.indexOf('    getTaskModels: async function');
const end=source.indexOf('    close: function',start);
function setup(provider='lemonade') {
 const calls=[];
 const methods={LMStudio:{model:'loaded-lm',models:['installed-lm','loaded-lm']},Lemonade:['lemon-vision'],NPU:['flm-vision'],OpenAICompatible:['external-vision'],Gemini:['gemini-3.5-flash-lite']};
 const bridge={};for(const [name,value] of Object.entries(methods)) for(const prefix of ['refresh','getCached']) bridge[prefix+name+'Models']=async()=>{calls.push(name);return value;};
 const context={state:{provider,lmModel:'loaded-lm',lemonadeModel:'lemon-vision',npuModel:'flm-vision',openaiCompatibleModel:'external-vision',geminiModel:'gemini-3.5-flash-lite'},ensureInitialized:async()=>{},storageGet:()=> 'orcarouter',getBridge:()=>bridge,document:{getElementById:()=>({options:[{value:'lemonade',textContent:'Lemonade'},{value:'ollama-npu',textContent:'Lemonade NPU'},{value:'openai-compatible',textContent:'OpenAI Compatible'}]})}};
 vm.createContext(context);vm.runInContext('api=({'+source.slice(start,end)+'})',context);
 return {calls,context,run:context.api.getTaskModels};
}
for(const [selected,profile,method] of [['lemonade','lemonade','Lemonade'],['lemonade-flm','lemonade-flm','NPU'],['openai-compatible-env','orcarouter','OpenAICompatible']]) {
 test(selected+' resolves only its own WebDAV model catalog',async()=>{const s=setup();const info=await s.run(selected,true);assert.equal(info.provider,'openai-compatible');assert.equal(info.openAICompatibleProvider,profile);assert.deepEqual(s.calls,[method]);assert.equal(JSON.stringify(info).includes('apiKey'),false);});
}
test('Jena inheritance uses its current provider and model at execution time',async()=>{const s=setup();s.context.state.provider='ollama-npu';const info=await s.run(undefined,false);assert.equal(info.openAICompatibleProvider,'lemonade-flm');assert.equal(info.model,'flm-vision');});
test('LM Studio inheritance works with cached loaded and installed models',async()=>{const s=setup('lmstudio');const info=await s.run(undefined,false);assert.equal(info.model,'loaded-lm');assert.deepEqual(Array.from(info.models),['installed-lm','loaded-lm']);});
test('Lemonade model failure propagates without querying external compatible models',async()=>{const s=setup();s.context.getBridge=()=>({refreshLemonadeModels:async()=>{throw new Error('Lemonade unavailable');}});await assert.rejects(s.run('lemonade',true),/Lemonade unavailable/);assert.deepEqual(s.calls,[]);});

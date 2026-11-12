const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../mdpro/js/app.js'), 'utf8');
const helper = app.slice(app.indexOf('async function completeTaskVision('), app.indexOf('async function completeLocalImageToolRequest('));
function setup() {
    const calls = [];
    const context = {
        getScholarAIProviderRuntime: () => ({ getLMStudioConfig: () => ({ baseUrl: 'http://lm/v1', quickMaxTokens: 2048 }) }),
        getOllamaSettings: () => ({ baseUrl: 'http://ollama' }),
        getNPUBaseUrl: () => 'http://lemonade/api/v1',
        getLiteRTLMSettings: () => ({ baseUrl: 'http://litert/v1' }),
        getMermaidCompatibleConnection: () => ({ baseUrl: 'https://compatible/v1', apiKey: 'test-key' }),
        requestLocalAIJson: async (url, options) => { calls.push({ url, body: JSON.parse(options.body), signal: options.signal }); return { message: { content: 'latex' }, choices: [{ message: { content: 'latex' } }] }; }
    };
    context.fetch = async (url, options) => ({ ok: true, json: () => context.requestLocalAIJson(url, options) });
    vm.createContext(context); vm.runInContext(helper, context);
    return { calls, context, complete: context.completeTaskVision };
}
for (const provider of ['lmstudio', 'litertlm', 'ollama-npu', 'openai-compatible', 'ollama']) {
    test(provider + ' sends the image and selected model to its own server', async () => {
        const { calls, complete } = setup();
        const signal = {};
        const result = await complete({ provider, model: 'chosen-vision', systemInstruction: 'OCR', messages: [{ role: 'user', content: 'Read', attachments: [{ kind: 'image', dataUrl: 'data:image/png;base64,YWJj' }] }] }, signal);
        assert.equal(result.text, 'latex'); assert.equal(result.provider, provider);
        assert.equal(calls[0].body.model, 'chosen-vision'); assert.equal(calls[0].signal, signal);
        assert.equal(calls[0].body.messages[0].role, 'system');
        const user = calls[0].body.messages[1];
        if (provider === 'ollama') assert.equal(user.images[0], 'YWJj');
        else assert.equal(user.content[1].image_url.url, 'data:image/png;base64,YWJj');
        if (provider === 'ollama-npu') assert.equal(calls[0].url, 'http://lemonade/api/v1/chat/completions');
    });
}
test('text-only provider reports unsupported vision without sending a request', async () => {
    const { calls, complete } = setup();
    await assert.rejects(complete({ provider: 'deepseek' }), /DeepSeek/);
    assert.equal(calls.length, 0);
});

test('Ollama Gemma4 streams real image bytes with explicit vision context and thinking mode',async()=>{
    const {calls,context,complete}=setup(),events=[];
    context.requestLocalAITextStream=async(url,options,chunk)=>{
        calls.push({url,body:JSON.parse(options.body)});
        const data=JSON.stringify({message:{content:'ALPHA_731'}})+'\n'+JSON.stringify({message:{content:' BETA_284'},done:true,done_reason:'stop'});
        chunk(data.slice(0,18));chunk(data.slice(18));
    };
    const result=await complete({provider:'ollama',model:'gemma4:latest',mode:'quick',messages:[{role:'user',content:'Read this image',attachments:[{kind:'image',dataUrl:'data:image/png;base64,YWJj'}]}],onStreamEvent:event=>events.push(event)},{});
    assert.equal(calls[0].body.messages[0].images[0],'YWJj');
    assert.equal(calls[0].body.think,false);
    assert.equal(calls[0].body.options.num_ctx,8192);
    assert.equal(calls[0].body.stream,true);
    assert.equal(result.text,'ALPHA_731 BETA_284');
    assert(events.some(event=>event.type==='message.delta'));
});

test('LM Studio Gemma4 streaming preserves multimodal parts and the selected backend',async()=>{
    const {context,complete}=setup();
    let sent;
    context.streamOpenAICompatibleChat=async(connection,body,signal,emit)=>{
        sent={connection,body};emit({type:'message.delta',content:'seen'});return {provider:'openai-compatible',text:'seen',model:'backend-alias'};
    };
    const result=await complete({provider:'lmstudio',model:'gemma-4-e4b',mode:'quick',messages:[{role:'user',content:'Read',attachments:[{kind:'image',dataUrl:'data:image/png;base64,YWJj'}]}],onStreamEvent:()=>{}},{});
    assert.equal(sent.connection.baseUrl,'http://lm/v1');
    assert.equal(sent.body.messages[0].content[1].image_url.url,'data:image/png;base64,YWJj');
    assert.equal(result.provider,'lmstudio');assert.equal(result.model,'gemma-4-e4b');
    assert.equal(sent.body.reasoning_effort,'none');assert.equal(sent.body.chat_template_kwargs.enable_thinking,false);
});

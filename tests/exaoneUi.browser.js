// Pipe into agent-browser eval --stdin in an isolated /mdpro/index.html session.
(async () => {
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    for (let i=0;i<100 && !window.AIChatBridge;i++) await delay(100);
    check(window.AIChatBridge, 'app bridge initialization timed out');
    await openAiJenaFromMenu();
    localStorage.setItem('ss_openai_compatible_api_key_exaone', 'synthetic-fixture');
    localStorage.setItem('ss_openai_compatible_model_id_exaone', 'k-exaone_v2.5');
    const provider = document.getElementById('ai-chat-provider');
    provider.value = 'exaone'; provider.dispatchEvent(new Event('change'));
    await delay(250);
    const tl = document.querySelector('#ai-chat-reasoning-settings-slot select');
    check(tl, 'TL missing');
    tl.closest('details').open = true; tl.value = 'max'; tl.dispatchEvent(new Event('change'));
    const original = window.fetch;
    window.exaoneFixtureRequests = [];
    window.fetch = async (url, options) => {
        if (!String(url).includes('/api/exaone/chat/completions')) return original(url, options);
        const body = JSON.parse(options.body); exaoneFixtureRequests.push({url:String(url),body});
        const encoder = new TextEncoder();
        return new Response(new ReadableStream({start(controller) {
            controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{reasoning_content:'실시간 추론 확인'}}]})+'\n\n'));
            setTimeout(() => {controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:'EXAONE 합성 최종 답변'}}]})+'\n\ndata: [DONE]\n\n')); controller.close();},1800);
        }}),{headers:{'Content-Type':'text/event-stream'}});
    };
    try {
        AIChat.setEnabled(true);
        const show = document.getElementById('ai-chat-show-reasoning');
        show.checked = true; show.dispatchEvent(new Event('change'));
        document.getElementById('ai-chat-input').value = '한 문장으로 설명해줘';
        document.getElementById('ai-chat-send').click();
        await delay(550);
        check(tl.disabled, 'TL not locked during generation');
        check(!show.disabled, 'reasoning display toggle locked');
        const live = document.getElementById('ai-chat-live-reasoning-content');
        check(live && live.textContent.includes('실시간 추론 확인'), 'quick mode reasoning delta not rendered');
        const messages = document.getElementById('ai-chat-messages').firstElementChild;
        show.checked = false; show.dispatchEvent(new Event('change'));
        show.checked = true; show.dispatchEvent(new Event('change'));
        check(messages === document.getElementById('ai-chat-messages').firstElementChild, 'display toggle replaced message DOM');
        await delay(1700);
        check(document.getElementById('ai-chat-messages').textContent.includes('EXAONE 합성 최종 답변'), 'final answer missing');
        check(exaoneFixtureRequests[0].body.reasoning_effort === 'max', 'explicit TL missing');
        check(exaoneFixtureRequests[0].body.chat_template_kwargs.preserve_thinking === false, 'history policy missing');
        const models = await AIChat.getTaskModels('exaone',true);
        check(models.openAICompatibleProvider === 'exaone' && models.models.includes('k-exaone_v2.5'), 'task mapping failed');
        const task = await AIChat.completeTask({provider:'exaone',model:'k-exaone_v2.5',prompt:'독립 텍스트 작업'});
        check(task.text.includes('EXAONE 합성 최종 답변'), 'task bridge failed');
        check(exaoneFixtureRequests[1].body.reasoning_effort === 'low', 'task inherited main TL');
        return {requests:exaoneFixtureRequests.length,tl:'max',independent:'low',quickReasoning:true,displayTogglePreservesDom:true,finalAnswer:true,taskProvider:true};
    } finally { window.fetch = original; }
})()

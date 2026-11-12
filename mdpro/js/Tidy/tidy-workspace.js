(function () {
'use strict';
const $=id=>document.getElementById(id), main=document.querySelector('main'), sidebar=document.querySelector('aside'), editor=document.querySelector('.editor'), panel=document.querySelector('.jena-panel');
main.id='workspace';sidebar.id='sidebar';panel.id='jena-panel';
function button(id,label,handler){const b=document.createElement('button');b.type='button';b.className='btn';b.id=id;b.textContent=label;b.onclick=handler;return b;}
const content=document.createElement('div');content.id='sidebar-content';while(sidebar.firstChild)content.append(sidebar.firstChild);sidebar.append(content);
const heading=document.createElement('div');heading.className='sidebar-heading';
const tabs=document.createElement('div');tabs.className='sidebar-tabs';
const registration=document.createElement('section');registration.id='registration-panel';content.prepend(registration);
registration.append(content.querySelector('.toolbar'),document.querySelector('.name-field'),$('enabled').closest('label'),document.querySelector('.storage'));
const actions=document.createElement('div');actions.className='toolbar';$('save-btn').textContent='기능등록';registration.append(actions);actions.append($('save-btn'),$('delete-btn'));registration.append($('script-list'));
const history=$('jena-history-sidebar');content.replaceChildren(registration,history);
function showHistory(on){registration.hidden=on;history.hidden=!on;$('registration-tab').classList.toggle('active',!on);$('history-tab').classList.toggle('active',on);}
tabs.append(button('registration-tab','기능등록',()=>showHistory(false)),button('history-tab','히스토리',()=>showHistory(true)));
heading.append(tabs,button('sidebar-toggle','‹',()=>{const collapsed=main.classList.toggle('sidebar-collapsed');$('sidebar-toggle').textContent=collapsed?'›':'‹';$('sidebar-toggle').setAttribute('aria-expanded',String(!collapsed));}));sidebar.prepend(heading);showHistory(false);
const editorHeading=document.createElement('div');editorHeading.className='editor-heading';editorHeading.innerHTML='<strong>코드 편집</strong><span id="current-script-name" class="help"></span>';
editorHeading.append($('jena-download'),$('close-btn'));editor.prepend(editorHeading);$('jena-download').textContent='JS 다운로드';$('close-btn').textContent='닫기';
const sourceTabs=document.createElement('div');sourceTabs.className='tabs';document.querySelectorAll('.editor-menu [data-mode]').forEach(b=>{if(b.dataset.mode!=='jena')sourceTabs.append(b);});editorHeading.after(sourceTabs);
$('code').closest('label').id='code-field';$('code-field').querySelector('span').textContent='JavaScript · 변환 함수';
const oldActions=editor.querySelector('.toolbar');if(oldActions&&!oldActions.children.length)oldActions.remove();
main.append(panel);document.querySelector('[data-mode="jena"]').remove();
const aiTabs=document.createElement('div');aiTabs.className='tabs';
function mode(js){aiTabs.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===(js?1:0)));panel.dataset.mode=js?'js':'tidy';window.TidyJenaMode=js?'generate':'rewrite';$('jena-prompt').placeholder=js?'만들 JavaScript 기능을 요청하세요':'현재 transform 코드에서 수정할 내용을 요청하세요';}
aiTabs.append(button('jena-tidy-tab','Jena Tidy',()=>mode(false)),button('jena-js-tab','Jena JS',()=>mode(true)));panel.prepend(aiTabs);mode(false);
const live=button('live-code-toggle','실시간 작성 OFF',()=>{window.TidyLiveCodeEnabled=!window.TidyLiveCodeEnabled;live.textContent='실시간 작성 '+(window.TidyLiveCodeEnabled?'ON':'OFF');live.setAttribute('aria-pressed',String(window.TidyLiveCodeEnabled));});live.setAttribute('aria-pressed','false');$('jena-send').before(live);
$('jena-send').textContent='요청 보내기 · JS 생성';$('jena-capture').textContent='선택한 코드 가져오기';

// Keep existing correction, test, response and registration controls reachable.
panel.hidden=false;main.classList.remove('no-ai');
$('jena-history-sidebar').append(button('snapshot-btn','코드 스냅샷 저장',()=>window.TidySaveSnapshot()));
$('jena-send').after(button('jena-reset-prompt-btn','기본 프롬프트 복원',()=>{$('jena-prompt').value=window.TidyJenaMode==='generate'?'요청한 기능을 transform(source, context) 함수로 만들어줘.':'현재 코드를 TIDY 변환 규격에 맞춰 수정하고 기존 동작을 보존해줘.';}));
document.addEventListener('tidy-mode',()=>{panel.hidden=false;});
const full=button('header-fullscreen','전체화면',()=>{const dialog=window.parent.document.getElementById('tidy-manager-dialog');if(!dialog)return;if(!dialog.dataset.fullscreen){dialog.dataset.previous=dialog.getAttribute('style');dialog.dataset.fullscreen='true';Object.assign(dialog.style,{left:'0',top:'0',width:'100vw',height:'100dvh'});full.textContent='이전 크기';}else{dialog.setAttribute('style',dialog.dataset.previous);delete dialog.dataset.fullscreen;full.textContent='전체화면';}});document.querySelector('header').append(full);
function currentName(){$('current-script-name').textContent=$('name').value;}$('name').addEventListener('input',currentName);window.addEventListener('tidy-form-reset',currentName);currentName();
})();
(function(){const main=document.getElementById('workspace');['left','right'].forEach(side=>{const h=document.createElement('div');h.id='tidy-'+side+'-splitter';h.className='tidy-column-splitter';h.tabIndex=0;h.setAttribute('role','separator');h.setAttribute('aria-orientation','vertical');h.setAttribute('aria-label',side==='left'?'기능 목록 너비 조절':'Jena 패널 너비 조절');main.append(h);});})();
(function () {
    'use strict';
    var workspace = document.getElementById('workspace');
    var input = document.getElementById('code');
    if (!workspace || !input) return;
    var key = 'webdav_tidy_workspace_v1';
    function savedLayout() { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { return {}; } }
    var saved = savedLayout();
    var widths = {left: Number(saved.leftWidth) || 230, right: Number(saved.rightWidth) || 350};
    var drag = null;
    function persist() {
        try { localStorage.setItem(key, JSON.stringify(Object.assign(savedLayout(), {leftWidth: widths.left, rightWidth: widths.right}))); } catch (_) {}
    }
    function layout() {
        var collapsed = workspace.classList.contains('sidebar-collapsed');
        var noAI = workspace.classList.contains('no-ai');
        var total = workspace.clientWidth;
        var left = collapsed ? 44 : Math.max(160, Math.min(widths.left, total - 220 - (noAI ? 8 : 256)));
        var right = noAI ? 0 : Math.max(240, Math.min(widths.right, total - left - 236));
        workspace.style.setProperty('--tidy-left-width', left + 'px');
        workspace.style.setProperty('--tidy-right-width', right + 'px');
        document.getElementById('tidy-left-splitter').setAttribute('aria-valuenow', String(Math.round(left)));
        document.getElementById('tidy-right-splitter').setAttribute('aria-valuenow', String(Math.round(right)));
        document.getElementById('tidy-left-splitter').setAttribute('aria-valuemax',String(Math.max(160,total-right-236)));
        document.getElementById('tidy-right-splitter').setAttribute('aria-valuemax',String(Math.max(240,total-left-236)));
    }
    function stop(event) {
        if (!drag) return;
        if (event && event.type === 'pointerup') persist();
        var previous=drag;drag=null;
        if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
        document.body.classList.remove('tidy-column-resizing');
    }
    ['left', 'right'].forEach(function (side) {
        var handle = document.getElementById('tidy-' + side + '-splitter');
        handle.addEventListener('pointerdown', function (event) {
            if (event.button !== 0 || matchMedia('(max-width:760px)').matches) return;
            event.preventDefault();
            drag = {side:side, x:event.clientX, width:parseFloat(workspace.style.getPropertyValue('--tidy-' + side + '-width')), id:event.pointerId, handle:handle};
            handle.setPointerCapture(event.pointerId);
            document.body.classList.add('tidy-column-resizing');
        });
        handle.addEventListener('pointermove', function (event) {
            if (!drag || drag.handle !== handle) return;
            var delta = (event.clientX - drag.x) * (side === 'left' ? 1 : -1);
            var max = workspace.clientWidth - 236 - (side === 'left' ? parseFloat(workspace.style.getPropertyValue('--tidy-right-width')) : parseFloat(workspace.style.getPropertyValue('--tidy-left-width')));
            widths[side] = Math.max(side === 'left' ? 160 : 240, Math.min(drag.width + delta, max));
            layout();
        });
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
        handle.addEventListener('lostpointercapture', stop);
        handle.addEventListener('keydown', function (event) {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            var current = parseFloat(workspace.style.getPropertyValue('--tidy-' + side + '-width'));
            var max = workspace.clientWidth - 236 - (side === 'left' ? parseFloat(workspace.style.getPropertyValue('--tidy-right-width')) : parseFloat(workspace.style.getPropertyValue('--tidy-left-width')));
            widths[side] = Math.max(side === 'left' ? 160 : 240, Math.min(current + (event.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1), max));
            layout(); persist();
        });
    });
    new ResizeObserver(layout).observe(workspace);
    new MutationObserver(layout).observe(workspace, {attributes:true, attributeFilter:['class']});
    window.addEventListener('pagehide', function () { stop(); });
    layout();

    if (window.MDProJavaScriptHighlight) window.MDProJavaScriptHighlight.mount(input, document.getElementById('code-highlight'));
})();

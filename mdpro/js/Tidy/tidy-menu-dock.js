(function (global) {
    'use strict';
    var slot = null, panel = null, drag = null, desiredWidth = 280;
    try { desiredWidth = Number(localStorage.getItem('webdav_tidy_menu_dock_width_v1')) || 280; } catch (_) {}
    function layout() {
        if (!slot) return;
        var workspace = document.getElementById('main-workspace');
        var mobile = global.innerWidth <= 760;
        // Take space from the existing document flex column, alongside any other docks.
        var occupied = Array.from(workspace.children).reduce(function(sum,node) {
            if (node === slot || node.classList.contains('order-2')) return sum;
            return sum + node.getBoundingClientRect().width;
        }, 0);
        var available = Math.max(180, workspace.clientWidth - occupied - 280);
        var width = Math.max(180, Math.min(desiredWidth, available, workspace.clientWidth * 0.5));
        slot.style.width = mobile ? '' : width + 'px';
        var column = workspace.querySelector(':scope > .order-2');
        if (column) {
            document.documentElement.style.setProperty('--tidy-document-right', Math.max(0, global.innerWidth - column.getBoundingClientRect().right) + 'px');
        }
        slot.querySelector('[role=separator]').setAttribute('aria-valuenow',String(Math.round(width)));
        slot.querySelector('[role=separator]').setAttribute('aria-valuemin','180');
        slot.querySelector('[role=separator]').setAttribute('aria-valuemax',String(Math.max(180,Math.round(Math.min(available,workspace.clientWidth*0.5)))));
    }
    function stop() {
        if (!drag) return;
        var previous = drag;
        drag = null;
        if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
        document.body.classList.remove('tidy-dock-resizing');
        try {localStorage.setItem('webdav_tidy_menu_dock_width_v1',String(desiredWidth));} catch (_) {}
    }
    function undock(hide) {
        if (!slot) return;
        stop();
        panel.dataset.docked = 'false';
        panel.classList.remove('tidy-docked');
        document.body.appendChild(panel);
        slot.remove(); slot = null;
        document.documentElement.style.removeProperty('--tidy-document-right');
        document.getElementById('tidy-dock-btn').textContent = '우측 Dock';
        document.getElementById('tidy-dock-btn').setAttribute('aria-pressed','false');
        if (hide) panel.classList.add('hidden');
        else if (global.TidyActions) global.TidyActions.toggleMenu(true);
        var focusTarget=hide?document.getElementById('btn-tidy-quick'):panel.querySelector('button');
        if(focusTarget)focusTarget.focus();
        global.dispatchEvent(new Event('resize'));
    }
    function dock() {
        if (slot) {slot.querySelector('.tidy-dock-title').focus();return;}
        panel = document.getElementById('tidy-quick-panel');
        var workspace = document.getElementById('main-workspace');
        if (!panel || !workspace) return;
        slot = document.createElement('section'); slot.id='tidy-menu-dock'; slot.className='no-print'; slot.setAttribute('aria-label','TIDY 우측 분할 패널');
        var header = document.createElement('div');header.className='tidy-dock-heading';
        var title=document.createElement('strong');title.textContent='TIDY';title.className='tidy-dock-title';title.tabIndex=-1;header.appendChild(title);
        ['메뉴로 복귀','닫기'].forEach(function(label,index){var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=function(event){event.stopPropagation();undock(index===1);};header.appendChild(b);});
        var handle=document.createElement('div');handle.className='tidy-dock-splitter';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','TIDY 분할 패널 너비 조절');handle.tabIndex=0;
        handle.onpointerdown=function(event){if(event.button!==0)return;event.preventDefault();drag={x:event.clientX,width:slot.getBoundingClientRect().width,id:event.pointerId,handle:handle};handle.setPointerCapture(event.pointerId);document.body.classList.add('tidy-dock-resizing');};
        handle.onpointermove=function(event){if(!drag)return;desiredWidth=Math.max(180,drag.width+drag.x-event.clientX);layout();};
        handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=stop;
        handle.onkeydown=function(event){if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();desiredWidth=Math.max(180,slot.getBoundingClientRect().width+(event.key==='ArrowLeft'?20:-20));layout();try{localStorage.setItem('webdav_tidy_menu_dock_width_v1',String(desiredWidth));}catch(_) {}};
        slot.onkeydown=function(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();undock(true);}};
        slot.appendChild(handle);slot.appendChild(header);workspace.appendChild(slot);
        panel.dataset.docked='true';panel.classList.add('tidy-docked');panel.classList.remove('hidden');slot.appendChild(panel);
        document.getElementById('tidy-dock-btn').textContent='메뉴로 복귀';document.getElementById('tidy-dock-btn').setAttribute('aria-pressed','true');
        layout();title.focus();global.dispatchEvent(new Event('resize'));
    }
    global.TidyMenuDock={dock:dock,undock:undock,toggle:function(){if(slot)undock(false);else dock();},isDocked:function(){return !!slot;}};
    global.addEventListener('resize',layout);
    function init(){var workspace=document.getElementById('main-workspace');if(workspace && global.ResizeObserver)new ResizeObserver(layout).observe(workspace);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

(function (global) {
    'use strict';
    let slot, home, popupStyle, drag;
    let width = 430;
    try { width = Number(localStorage.getItem('webdav_macro_menu_dock_width_v1')) || width; } catch (_) {}
    function layout() {
        if (!slot) return;
        const workspace = slot.parentElement;
        const occupied = Array.from(workspace.children).reduce((sum, node) =>
            sum + (node === slot || node.classList.contains('order-2') ? 0 : node.getBoundingClientRect().width), 0);
        const max = Math.max(280, Math.min(workspace.clientWidth * .55, workspace.clientWidth - occupied - 280));
        const actual = Math.max(280, Math.min(width, max));
        slot.style.width = actual + 'px';
        const handle = slot.querySelector('[role=separator]');
        handle.setAttribute('aria-valuenow', Math.round(actual));
        handle.setAttribute('aria-valuemax', Math.round(max));
    }
    function save() {
        try { localStorage.setItem('webdav_macro_menu_dock_width_v1', String(width)); } catch (_) {}
    }
    function stop() {
        if (!drag) return;
        const previous = drag; drag = null;
        if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
        document.body.classList.remove('macro-menu-dock-resizing');
        save();
    }
    function detach() {
        if (!slot) return;
        stop();
        const modal = document.getElementById('macro-menu-panel');
        const panel = document.getElementById('macro-menu-panel');
        home.replaceWith(modal);
        modal.classList.remove('macro-menu-docked');
        if (popupStyle === null) panel.removeAttribute('style');
        else panel.setAttribute('style', popupStyle);
        slot.remove(); slot = null;
        global.dispatchEvent(new Event('resize'));
    }
    function apply(docked) {
        const modal = document.getElementById('macro-menu-panel');
        const panel = document.getElementById('macro-menu-panel');
        const button = document.getElementById('macro-dock-toggle');
        if (!modal || !panel) return;
        button.textContent = docked ? 'Popup' : 'Dock';
        button.title = docked ? '팝업 창으로 복귀' : '문서 우측에 도킹';
        button.setAttribute('aria-pressed', String(docked));
        if (!docked || modal.classList.contains('hidden')) { detach(); return; }
        if (slot) { layout(); return; }
        const workspace = document.getElementById('main-workspace');
        if (!workspace) return;
        popupStyle = panel.getAttribute('style');
        home = document.createComment('image insert popup'); modal.before(home);
        slot = document.createElement('section'); slot.id = 'macro-menu-dock'; slot.className = 'no-print';
        slot.setAttribute('aria-label', 'Macro 분할 패널');
        const handle = document.createElement('div'); handle.className = 'macro-menu-dock-splitter';
        handle.tabIndex = 0; handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical'); handle.setAttribute('aria-label', 'Macro 패널 너비 조절');
        handle.setAttribute('aria-valuemin', '280');
        handle.onpointerdown = event => {
            if (event.button !== 0 || global.innerWidth <= 760) return;
            event.preventDefault();
            drag = {x: event.clientX, width: slot.getBoundingClientRect().width, handle, id: event.pointerId};
            handle.setPointerCapture(event.pointerId); document.body.classList.add('macro-menu-dock-resizing');
        };
        handle.onpointermove = event => { if (drag) { width = Math.max(280, drag.width + drag.x - event.clientX); layout(); } };
        handle.onpointerup = handle.onpointercancel = handle.onlostpointercapture = stop;
        handle.onkeydown = event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); width = Math.max(280, slot.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? 20 : -20)); layout(); save();
        };
        slot.onkeydown = event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); global.toggleMacroMenu(); document.getElementById('btn-macro-menu')?.focus(); }
        };
        slot.append(handle, modal); workspace.append(slot); modal.classList.add('macro-menu-docked');
        layout(); global.dispatchEvent(new Event('resize'));
    }
    global.MacroMenuDock = {apply, detach, isDocked: () => !!slot};
    global.addEventListener('resize', layout);
    function init() {
        const workspace = document.getElementById('main-workspace');
        if (workspace && global.ResizeObserver) new ResizeObserver(layout).observe(workspace);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})(window);

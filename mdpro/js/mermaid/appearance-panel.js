/* Per-diagram nonmodal style panel; reuses the same input DOM in attached/floating/dock modes. */
(function (root) {
    'use strict';
    const states = new Map();
    function setOpen(panel, toggle, open) {
        const state = states.get(panel);
        if (!open && state && state.slot) { undock(state); panel.setAttribute('popover', 'manual'); document.body.append(panel); position(state, state.box); }
        if (!open && panel.matches(':popover-open')) panel.hidePopover();
        panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
        if (open && state && !state.floating) {
            if (!state.anchor.isConnected) panel.before(state.anchor);
            float(state);
        }
        if (open && state && state.floating && !state.slot) panel.showPopover();
        if (!open && state) stop(state);
    }
    function stop(s) {
        if (!s.drag) return;
        const { handle, id } = s.drag;
        if (handle.hasPointerCapture(id)) handle.releasePointerCapture(id);
        s.drag = null;
    }
    function clamp(s, box) {
        const width = Math.min(innerWidth - 16, Math.max(Math.min(300, innerWidth - 16), box.width));
        const height = Math.min(innerHeight - 16, Math.max(Math.min(220, innerHeight - 16), box.height));
        return { width, height, left: Math.max(8, Math.min(innerWidth - width - 8, box.left)), top: Math.max(8, Math.min(innerHeight - height - 8, box.top)) };
    }
    function position(s, box) {
        const b = clamp(s, box);
        Object.assign(s.panel.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
        s.box = b;
    }
    function undock(s) {
        if (!s.slot) return;
        stop(s); s.slot.before(s.panel); s.slot.remove(); s.slot = null; if (s.dockObserver) { s.dockObserver.disconnect(); s.dockObserver = null; }
        s.panel.classList.remove('trt-appearance-docked'); s.dockButton.textContent = 'Dock';
        s.dockButton.setAttribute('aria-pressed', 'false');
    }
    function dockLayout(s) {
        if (!s.slot) return;
        const workspace = s.slot.parentElement;
        const occupied = Array.from(workspace.children).reduce((sum, child) => sum + (child === s.slot || child.classList.contains('order-2') ? 0 : child.getBoundingClientRect().width), 0);
        const max = Math.max(240, Math.min(workspace.clientWidth * .55, workspace.clientWidth - occupied - 240));
        s.slot.style.width = Math.min(max, Math.max(240, s.dockWidth || 360)) + 'px';
        s.splitter.setAttribute('aria-valuenow', String(Math.round(s.slot.getBoundingClientRect().width)));
    }
    function dock(s) {
        if (s.slot) {
            undock(s); s.panel.setAttribute('popover', 'manual'); document.body.append(s.panel);
            position(s, s.box); s.panel.showPopover(); return;
        }
        states.forEach(other => { if (other !== s && other.slot) setOpen(other.panel, other.toggle, false); });
        if (!s.floating) float(s);
        stop(s);
        if (s.panel.matches(':popover-open')) s.panel.hidePopover();
        s.panel.removeAttribute('popover');
        const workspace = document.getElementById('main-workspace') || document.body;
        const slot = document.createElement('aside'); slot.className = 'trt-appearance-dock-slot';
        workspace.append(slot); s.slot = slot;
        s.panel.classList.add('trt-appearance-docked'); s.panel.style.left = s.panel.style.top = s.panel.style.width = s.panel.style.height = '';
        slot.append(s.panel);
        const handle = document.createElement('div'); handle.className = 'trt-appearance-dock-splitter';
        handle.tabIndex = 0; handle.setAttribute('role', 'separator'); handle.setAttribute('aria-label', '도표 스타일 Dock 너비'); handle.setAttribute('aria-orientation', 'vertical');
        slot.append(handle); s.splitter = handle;
        let drag;
        handle.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); drag = { id:e.pointerId, x:e.clientX, width:slot.getBoundingClientRect().width }; handle.setPointerCapture(e.pointerId); };
        handle.onpointermove = e => { if (!drag || drag.id !== e.pointerId) return; s.dockWidth = drag.width + drag.x - e.clientX; dockLayout(s); };
        const end = () => { if (drag && handle.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id); drag = null; };
        handle.onpointerup = handle.onpointercancel = handle.onlostpointercapture = end;
        handle.onkeydown = e => { if (!['ArrowLeft','ArrowRight'].includes(e.key)) return; e.preventDefault(); s.dockWidth = slot.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 20 : -20); dockLayout(s); };
        s.dockObserver = new ResizeObserver(() => dockLayout(s)); s.dockObserver.observe(workspace);
        s.dockButton.textContent = 'Dock 해제'; s.dockButton.setAttribute('aria-pressed', 'true'); dockLayout(s);
    }
    function syncTheme(s) {
        if (!s.floating) return;
        const dark = s.wrapper.dataset.mermaidTheme === 'dark';
        s.panel.style.setProperty('--appearance-surface', dark ? '#172033' : '#ffffff');
        s.panel.style.setProperty('--appearance-text', dark ? '#e2e8f0' : '#172033');
    }
    function float(s) {
        if (s.floating) {
            undock(s); stop(s);
            if (s.panel.matches(':popover-open')) s.panel.hidePopover();
            s.panel.removeAttribute('popover'); s.panel.removeAttribute('role'); s.panel.removeAttribute('aria-modal');
            s.panel.classList.remove('trt-appearance-floating'); s.panel.style.cssText = '';
            s.anchor.after(s.panel); s.floating = false; 
            s.floatButton.textContent = '플로팅'; s.dockButton.textContent = 'Dock';
        } else {
            s.floating = true;
            syncTheme(s);
            s.panel.classList.add('trt-appearance-floating'); s.panel.setAttribute('popover', 'manual');
            s.panel.setAttribute('role', 'dialog'); s.panel.setAttribute('aria-modal', 'false');
            document.body.append(s.panel); s.panel.hidden = false;
            position(s, s.box || { left: Math.max(8, innerWidth - 480), top: 80, width: 460, height: Math.min(620, innerHeight - 100) });
            s.panel.showPopover(); s.floatButton.textContent = '도표에 붙이기';
        }
    }
    function attach(wrapper, panel, toggle) {
        const styleId = 'trt-appearance-panel-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style'); style.id = styleId;
            style.textContent = `
              .trt-mermaid-appearance-panel{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;white-space:normal;box-sizing:border-box;}
              .trt-mermaid-category{display:flex;flex:1 1 180px;flex-wrap:wrap;align-content:start;align-items:center;gap:8px;min-width:0;border:1px solid #94a3b866;border-radius:8px;padding:8px;}
              .trt-mermaid-direction{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
              .trt-mermaid-direction .trt-mermaid-btn{width:auto;height:auto;min-height:34px;padding:6px 10px;white-space:normal;}
              .trt-mermaid-direction .trt-mermaid-btn[aria-pressed="true"]{background:#312e81;color:#fff;border:2px solid #818cf8;}
              .trt-mermaid-category legend{font-weight:700;padding:0 4px;}
              .trt-mermaid-category label{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;}
              .trt-mermaid-category input[type=number]{width:70px;height:32px;box-sizing:border-box;padding:4px 6px;background:#fff;color:#172033;-webkit-text-fill-color:#172033;border:1px solid #64748b;border-radius:4px;color-scheme:light;}
              .trt-mermaid-category select{max-width:100%;height:34px;color:inherit;background:transparent;}
              .trt-appearance-header{flex:1 0 100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
              .trt-appearance-header strong{margin-right:auto;}
              .trt-appearance-floating{position:fixed;inset:auto;margin:0;max-width:none;max-height:none;box-sizing:border-box;border:1px solid #94a3b8;border-radius:12px;padding:10px;box-shadow:0 12px 48px #0005;display:flex;flex-direction:column;flex-wrap:nowrap;background:var(--appearance-surface);color:var(--appearance-text);font:13px/1.5 system-ui,sans-serif;}
              .trt-appearance-floating[hidden]{display:none!important;}
              .trt-appearance-floating::backdrop{background:transparent;pointer-events:none;}
              .trt-appearance-floating .trt-appearance-header{flex:0 0 auto;cursor:move;touch-action:none;}
              .trt-appearance-body{display:contents;}
              .trt-appearance-floating .trt-appearance-body{display:flex;flex-wrap:wrap;align-content:start;gap:10px;min-height:0;overflow:auto;flex:1;}
              .trt-appearance-floating .trt-mermaid-btn{min-height:34px;min-width:34px;border:1px solid #94a3b8;border-radius:6px;background:transparent;color:inherit;cursor:pointer;}
              .trt-appearance-floating .trt-mermaid-fixed-fit{width:auto;height:auto;min-width:42px;padding:6px 10px;white-space:nowrap;font:inherit;}
              .trt-mermaid-category select option{background:white;color:#172033;}
              .trt-appearance-floating input[type=color]{height:34px;width:38px;}
              .trt-appearance-floating .trt-mermaid-appearance{color:inherit;}
              .trt-appearance-resize{display:none;position:absolute;touch-action:none;}
              .trt-appearance-floating .trt-appearance-resize{display:block;}
              .trt-appearance-resize[data-edge=n],.trt-appearance-resize[data-edge=s]{left:12px;right:12px;height:7px;cursor:ns-resize;}
              .trt-appearance-resize[data-edge=n]{top:0}.trt-appearance-resize[data-edge=s]{bottom:0}
              .trt-appearance-resize[data-edge=e],.trt-appearance-resize[data-edge=w]{top:12px;bottom:12px;width:7px;cursor:ew-resize;}
              .trt-appearance-resize[data-edge=e]{right:0}.trt-appearance-resize[data-edge=w]{left:0}
              .trt-appearance-resize[data-edge=se],.trt-appearance-resize[data-edge=nw],.trt-appearance-resize[data-edge=ne],.trt-appearance-resize[data-edge=sw]{width:12px;height:12px;}
              .trt-appearance-resize[data-edge=se]{right:0;bottom:0;cursor:nwse-resize;border-right:3px solid #818cf8;border-bottom:3px solid #818cf8;}
              .trt-appearance-resize[data-edge=nw]{left:0;top:0;cursor:nwse-resize}.trt-appearance-resize[data-edge=ne]{right:0;top:0;cursor:nesw-resize}.trt-appearance-resize[data-edge=sw]{left:0;bottom:0;cursor:nesw-resize}
              @media(max-width:600px){.trt-mermaid-appearance-panel .trt-mermaid-btn{min-height:44px;min-width:44px}.trt-mermaid-category{flex-basis:100%}}
              .trt-mermaid-appearance-panel:not(.trt-appearance-floating){display:block;width:100%;min-width:0;}
              .trt-mermaid-appearance-panel:not(.trt-appearance-floating) .trt-appearance-header{margin-bottom:12px;}
              .trt-mermaid-appearance-panel .trt-appearance-body{width:100%;min-width:0;box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;align-content:start;}
              .trt-mermaid-appearance-panel .trt-mermaid-category{display:flex;flex-direction:column;align-items:stretch;gap:12px;padding:12px;margin:0;border-radius:10px;}
              .trt-mermaid-appearance-panel .trt-mermaid-category:last-of-type{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;}
              .trt-mermaid-appearance-panel .trt-mermaid-category label{display:flex;justify-content:space-between;flex-wrap:nowrap;min-width:0;gap:12px;}
              .trt-mermaid-appearance-panel .trt-mermaid-category select{width:160px;min-width:0;border:1px solid #94a3b8;border-radius:6px;padding:4px;}
              .trt-mermaid-appearance-panel .trt-mermaid-category .trt-mermaid-appearance{display:grid;grid-template-columns:minmax(0,1fr) 34px 48px 34px;align-items:center;gap:6px;width:100%;margin:0;}
              .trt-mermaid-appearance-panel .trt-mermaid-category .trt-mermaid-appearance>span{text-align:center;font-variant-numeric:tabular-nums;}
              .trt-mermaid-appearance-panel .trt-mermaid-btn{font:inherit;line-height:1.3;font-size:13px;box-sizing:border-box;}
              .trt-mermaid-appearance-panel .trt-mermaid-category .trt-mermaid-btn{min-width:34px;min-height:34px;height:auto;padding:6px 8px;}
              .trt-mermaid-appearance-panel .trt-mermaid-category input[type=color]{width:38px;height:32px;padding:2px;border:1px solid #94a3b8;border-radius:6px;background:transparent;}
              .trt-mermaid-appearance-panel .trt-mermaid-font-bold{align-self:flex-end;width:40px;}
              .trt-mermaid-appearance-panel .trt-mermaid-direction{display:grid;grid-template-columns:1fr;gap:6px;}
              .trt-mermaid-appearance-panel .trt-mermaid-direction .trt-mermaid-btn{width:100%;text-align:left;}
              .trt-mermaid-appearance-panel .trt-mermaid-btn[aria-pressed=true]{background:#312e81;color:white;border-color:#818cf8;}
              .trt-mermaid-appearance-panel .trt-appearance-header{display:flex;flex-wrap:nowrap;gap:6px;align-items:center;padding-bottom:10px;border-bottom:1px solid #94a3b844;}
              .trt-mermaid-appearance-panel .trt-appearance-header strong{font-size:14px;white-space:nowrap;}
              .trt-mermaid-appearance-panel .trt-appearance-header button{padding:6px 8px;min-width:0;white-space:nowrap;}
              .trt-appearance-dock-slot{position:relative;order:5;flex:none;min-width:0;min-height:0;display:flex;border-left:1px solid #94a3b8;}
              .trt-appearance-floating.trt-appearance-docked{position:relative;inset:auto;width:100%;height:100%;border:0;border-radius:0;box-shadow:none;padding:12px;}
              .trt-appearance-docked .trt-appearance-resize{display:none;}
              .trt-appearance-docked .trt-appearance-header{cursor:default;}
              .trt-appearance-dock-splitter{position:absolute;left:-4px;top:0;bottom:0;width:8px;cursor:col-resize;touch-action:none;z-index:2;}
              .trt-appearance-dock-splitter:focus-visible{outline:2px solid #818cf8;}
              @media(max-width:600px){.trt-appearance-dock-slot{position:absolute;left:0;right:0;bottom:0;width:100%!important;height:45dvh;z-index:25;}#main-workspace:has(>.trt-appearance-dock-slot)>.order-2{margin-bottom:45dvh;}.trt-mermaid-appearance-panel .trt-mermaid-category .trt-mermaid-btn{min-height:44px;}}
            `;
            document.head.append(style);
        }
        const anchor = document.createComment('Mermaid style panel'); panel.before(anchor);
        // panel is not inserted in its controls yet, so retain an anchor after insertion too.
        const s = { wrapper, panel, toggle, floating: false, anchor };
        states.set(panel, s);
        const body = document.createElement('div'); body.className = 'trt-appearance-body';
        panel.querySelectorAll('.trt-mermaid-custom,.trt-mermaid-custom2').forEach(group => {
            const fold=document.createElement('details'),summary=document.createElement('summary');
            fold.className='trt-custom-section-fold';fold.style.width='100%';
            summary.textContent='도구 펼치기';fold.append(summary);
            summary.title='클릭하여 이 커스텀 영역의 도구를 펼치거나 접습니다. 만든 도구와 설정값은 유지됩니다.';
            Array.from(group.childNodes).filter(node=>node.nodeName!=='LEGEND').forEach(node=>fold.append(node));
            fold.addEventListener('toggle',()=>{summary.textContent=fold.open?'도구 접기':'도구 펼치기';});
            group.append(fold);
        });
        body.append(...Array.from(panel.childNodes)); panel.append(body);
        const header = document.createElement('header'); header.className = 'trt-appearance-header'; header.tabIndex = 0;
        header.title = '드래그로 이동 · 방향키로 이동 · Shift+방향키로 크기 조절';
        const title = document.createElement('strong'); title.textContent = '도표 스타일'; header.append(title);
        function button(text, action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'trt-mermaid-btn trt-mermaid-fixed-fit'; b.textContent = text; b.onclick = e => { e.stopPropagation(); action(); }; header.append(b); return b; }
        s.floatButton = button('플로팅', () => { if (!s.anchor.isConnected) panel.before(s.anchor); float(s); });
        s.dockButton = button('Dock', () => { if (!s.anchor.isConnected) panel.before(s.anchor); dock(s); });
        button('닫기', () => { setOpen(panel, toggle, false); toggle.focus(); }); panel.prepend(header);
        header.onkeydown = e => {
            if (e.target !== header || !s.floating || s.slot || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
            e.preventDefault(); const b = { ...s.box }, delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -10 : 10;
            b[e.shiftKey ? (/Left|Right/.test(e.key) ? 'width' : 'height') : (/Left|Right/.test(e.key) ? 'left' : 'top')] += delta; position(s, b);
        };
        function bind(handle, edge) {
            handle.addEventListener('pointerdown', e => {
                if (!s.floating || s.slot || e.button !== 0 || (!edge && e.target.closest('button,input,select,a'))) return;
                e.preventDefault(); s.drag = { id: e.pointerId, handle, x: e.clientX, y: e.clientY, box: { ...s.box } }; handle.setPointerCapture(e.pointerId);
            });
            handle.addEventListener('pointermove', e => {
                const d = s.drag; if (!d || d.id !== e.pointerId || d.handle !== handle) return;
                const dx = e.clientX - d.x, dy = e.clientY - d.y, b = { ...d.box };
                if (!edge) { b.left += dx; b.top += dy; }
                else { if (edge.includes('e')) b.width += dx; if (edge.includes('s')) b.height += dy; if (edge.includes('w')) { b.width -= dx; b.left += dx; } if (edge.includes('n')) { b.height -= dy; b.top += dy; } }
                position(s, b);
            });
            ['pointerup','pointercancel','lostpointercapture'].forEach(event => handle.addEventListener(event, () => stop(s)));
        }
        bind(header, '');
        for (const edge of ['n','s','e','w','nw','ne','sw','se']) { const h = document.createElement('span'); h.className = 'trt-appearance-resize'; h.dataset.edge = edge; h.setAttribute('aria-hidden','true'); panel.append(h); bind(h, edge); }
    }
    root.addEventListener('resize', () => states.forEach(s => { if (s.slot) dockLayout(s); else if (s.floating) position(s, s.box); }));
    new MutationObserver(() => states.forEach((s, panel) => { if (!s.wrapper.isConnected) { stop(s); if (s.slot) undock(s); if (s.floating) panel.remove(); s.anchor.remove(); states.delete(panel); } else syncTheme(s); })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mermaid-theme'] });
    root.MermaidAppearancePanel = { attach, setOpen };
})(window);

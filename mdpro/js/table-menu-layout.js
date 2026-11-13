(function (global) {
    'use strict';
    // Layout adapter for the existing table menu. Editor commands stay in app.js.
    let panel, slot, popupRect, drag, observer;
    let desiredWidth = 360;
    try { desiredWidth = Number(localStorage.getItem('webdav_table_menu_dock_width_v1')) || 360; } catch (_) {}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    function persistWidth() {
        try { localStorage.setItem('webdav_table_menu_dock_width_v1', String(desiredWidth)); } catch (_) {}
    }
    function stop() {
        if (!drag) return;
        const previous = drag;
        drag = null;
        if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
        document.body.classList.remove('table-menu-resizing');
        persistWidth();
    }
    function fitPopup(rect) {
        const gap = 8, width = clamp(rect.width || 360, Math.min(280, innerWidth - gap * 2), innerWidth - gap * 2);
        const height = rect.height ? clamp(rect.height, Math.min(220, innerHeight - gap * 2), innerHeight - gap * 2) : 0;
        Object.assign(panel.style, {
            width: width + 'px', height: height ? height + 'px' : '',
            left: clamp(rect.left, gap, innerWidth - width - gap) + 'px',
            top: clamp(rect.top, gap, innerHeight - (height || Math.min(panel.scrollHeight, innerHeight * .8)) - gap) + 'px'
        });
        panel.style.maxHeight = Math.max(120, innerHeight - parseFloat(panel.style.top) - gap) + 'px';
    }
    function sync() {
        if (!panel) return;
        const button = document.getElementById('table-menu-dock-btn');
        button.textContent = slot ? 'Dock 해제' : 'Dock';
        button.setAttribute('aria-pressed', String(!!slot));
        if (slot) {
            const workspace = slot.parentElement;
            const occupied = Array.from(workspace.children).reduce((sum, child) =>
                sum + (child === slot || child.classList.contains('order-2') ? 0 : child.getBoundingClientRect().width), 0);
            const max = Math.max(240, Math.min(workspace.clientWidth * .5, workspace.clientWidth - occupied - 280));
            const width = clamp(desiredWidth, 240, max);
            slot.style.width = width + 'px';
            const documentPane = workspace.querySelector(':scope > .order-2');
            if (documentPane) workspace.style.setProperty('--table-menu-document-right', Math.max(0, innerWidth - documentPane.getBoundingClientRect().right) + 'px');
            const handle = slot.querySelector('[role=separator]');
            handle.setAttribute('aria-valuenow', String(Math.round(width)));
            handle.setAttribute('aria-valuemax', String(Math.round(max)));
        } else if (!panel.classList.contains('hidden')) {
            if (panel.dataset.anchored === 'true') {
                const anchor = document.getElementById('btn-table-insert-picker').getBoundingClientRect();
                const top = Math.min(anchor.bottom + 6, innerHeight - 100);
                panel.style.left = clamp(anchor.left,8,innerWidth-panel.getBoundingClientRect().width-8)+'px';
                panel.style.top = top+'px';panel.style.maxHeight = Math.max(80,innerHeight-top-8)+'px';
            } else {
                const rect = panel.getBoundingClientRect();
                fitPopup({left:rect.left, top:rect.top, width:rect.width, height:panel.style.height ? rect.height : 0});
            }
        }
    }
    function bindPointer(handle, direction) {
        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0 || (!direction && event.target.closest('button,input,select,a'))) return;
            if (slot && direction !== 'dock') return;
            event.preventDefault();
            panel.dataset.anchored = 'false';
            const rect = (slot || panel).getBoundingClientRect();
            drag = {handle, id:event.pointerId, direction, x:event.clientX, y:event.clientY, rect};
            handle.setPointerCapture(event.pointerId);
            document.body.classList.add('table-menu-resizing');
        });
        handle.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            const {rect, direction} = drag, dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (direction === 'dock') { desiredWidth = rect.width - dx; sync(); return; }
            let left = rect.left, top = rect.top, right = rect.right, bottom = rect.bottom;
            const minWidth = Math.min(280, innerWidth - 16), minHeight = Math.min(220, innerHeight - 16);
            if (!direction) { fitPopup({left:left + dx, top:top + dy, width:rect.width, height:rect.height}); return; }
            if (direction.includes('e')) right = clamp(right + dx, left + minWidth, innerWidth - 8);
            if (direction.includes('w')) left = clamp(left + dx, 8, right - minWidth);
            if (direction.includes('s')) bottom = clamp(bottom + dy, top + minHeight, innerHeight - 8);
            if (direction.includes('n')) top = clamp(top + dy, 8, bottom - minHeight);
            fitPopup({left, top, width:right-left, height:bottom-top});
        });
        ['pointerup','pointercancel','lostpointercapture'].forEach(name => handle.addEventListener(name, stop));
    }
    function init() {
        if (panel) return;
        panel = document.getElementById('table-insert-picker');
        document.body.appendChild(panel);
        panel.classList.add('table-menu-floating');
        const sizeForm = document.createElement('form');
        sizeForm.className = 'table-size-inputs';
        sizeForm.innerHTML = '<label>행<input name="rows" aria-label="표 행 수" type="number" inputmode="numeric" min="1" max="10" step="1" value="3" required></label><label>열<input name="cols" aria-label="표 열 수" type="number" inputmode="numeric" min="1" max="10" step="1" value="3" required></label><button type="submit">표 넣기</button>';
        sizeForm.addEventListener('submit', event => {
            event.preventDefault();
            if (!sizeForm.reportValidity()) return;
            global.selectTableInsertSize(Number(sizeForm.elements.rows.value), Number(sizeForm.elements.cols.value));
        });
        const sizeLabel = document.getElementById('table-insert-size-label');
        sizeLabel.after(sizeForm);
        const mobile = global.matchMedia('(max-width:767px)');
        function foldSection(id, title, nodes) {
            const section = document.createElement('details');
            section.id = id;
            section.className = 'table-menu-section';
            section.open = !mobile.matches;
            const heading = document.createElement('summary');
            heading.textContent = title;
            section.appendChild(heading);
            nodes[0].before(section);
            nodes.forEach(node => section.appendChild(node));
            return section;
        }
        const sizeSection = foldSection('table-size-section', '크기 선택', [sizeLabel, sizeForm, document.getElementById('table-insert-grid')]);
        const structure = panel.querySelector('.table-structure-actions');
        const editSection = foldSection('table-edit-section', '표 편집 (표 안에 커서)', [structure]);
        // Keep the original heading and every command in the expandable body.
        mobile.addEventListener('change', () => {
            sizeSection.open = editSection.open = !mobile.matches;
        });
        bindPointer(document.getElementById('table-menu-heading'), '');
        ['n','s','e','w','ne','nw','se','sw'].forEach(direction => {
            const handle = document.createElement('span');
            handle.className = 'table-menu-resize table-menu-resize-' + direction;
            handle.dataset.direction = direction;
            handle.setAttribute('aria-hidden','true');
            panel.appendChild(handle);
            bindPointer(handle, direction);
        });
        if (global.ResizeObserver) {
            observer = new ResizeObserver(sync);
            observer.observe(document.getElementById('main-workspace'));
        }
        // Keyboard alternative to dragging/resizing the compact popup.
        panel.addEventListener('keydown', event => {
            if (!event.altKey || !event.key.startsWith('Arrow') || slot) return;
            event.preventDefault();
            const rect = panel.getBoundingClientRect(), horizontal = ['ArrowLeft','ArrowRight'].includes(event.key);
            const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -20 : 20;
            fitPopup({left:rect.left + (!event.shiftKey && horizontal ? delta : 0),
                top:rect.top + (!event.shiftKey && !horizontal ? delta : 0),
                width:rect.width + (event.shiftKey && horizontal ? delta : 0),
                height:rect.height + (event.shiftKey && !horizontal ? delta : 0)});
        });
    }
    function open() {
        init();
        panel.classList.remove('hidden');
        if (innerWidth <= 767) {
            if (!slot) toggleDock();
            sync();
            document.getElementById('table-menu-dock-btn').focus();
            return;
        }
        panel.dataset.anchored = 'true';
        const anchor = document.getElementById('btn-table-insert-picker').getBoundingClientRect();
        const top = Math.min(anchor.bottom + 6, innerHeight - 100);
        Object.assign(panel.style, {left:clamp(anchor.left, 8, innerWidth - Math.min(popupRect?.width || 360, innerWidth - 16) - 8) + 'px', top:top + 'px', width:Math.min(popupRect?.width || 360, innerWidth - 16) + 'px', height:'', maxHeight:Math.max(80, innerHeight - top - 8) + 'px'});
        sync();
        document.getElementById('table-menu-dock-btn').focus();
    }
    function undock() {
        if (!slot) return;
        stop();
        document.body.appendChild(panel);
        slot.remove(); slot = null;
        document.getElementById('main-workspace').style.removeProperty('--table-menu-document-right');
        panel.classList.remove('table-menu-docked');
        fitPopup(popupRect);
        sync(); global.dispatchEvent(new Event('resize'));
    }
    function close() {
        if (!panel || panel.classList.contains('hidden')) return;
        stop();
        if (slot) undock();
        popupRect = {left:panel.offsetLeft, top:panel.offsetTop, width:panel.offsetWidth, height:panel.style.height ? panel.offsetHeight : 0};
        panel.classList.add('hidden');
        document.getElementById('btn-table-insert-picker').focus();
    }
    function toggleDock() {
        init();
        if (slot) { undock(); return; }
        stop();
        const rect = panel.getBoundingClientRect();
        popupRect = {left:rect.left, top:rect.top, width:rect.width, height:panel.style.height ? rect.height : 0};
        slot = document.createElement('aside');
        slot.id = 'table-menu-dock'; slot.className = 'no-print'; slot.setAttribute('aria-label','표 도구 우측 Dock');
        const handle = document.createElement('div');
        handle.className = 'table-menu-dock-splitter'; handle.tabIndex = 0;
        handle.setAttribute('role','separator'); handle.setAttribute('aria-orientation','vertical');
        handle.setAttribute('aria-label','표 Dock 너비 조절'); handle.setAttribute('aria-valuemin','240');
        bindPointer(handle,'dock');
        handle.addEventListener('keydown', event => {
            if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
            event.preventDefault(); desiredWidth = slot.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? 20 : -20); sync(); persistWidth();
        });
        slot.appendChild(handle);
        document.getElementById('main-workspace').appendChild(slot);
        slot.appendChild(panel); panel.classList.add('table-menu-docked');
        panel.style.maxHeight = '';
        sync(); global.dispatchEvent(new Event('resize'));
    }
    global.TableMenuLayout = {open, close, toggleDock, isDocked:() => !!slot,
        toggle:() => { init(); if (panel.classList.contains('hidden')) open(); else close(); }};
    global.addEventListener('resize',sync);
})(window);

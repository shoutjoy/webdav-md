/* Mobile menus stay in their original DOM so existing commands/outside-click bindings survive. */
(function () {
    'use strict';
    const ids = ['text-emphasis-quick-panel','heading-quick-panel','list-quick-panel','code-quote-quick-panel','mermaid-quick-panel','table-insert-picker','image-insert-quick-panel','math-quick-panel','tidy-quick-panel','footnote-quick-panel','macro-menu-panel'];
    function init() {
        const panels = ids.map(id => document.getElementById(id)).filter(Boolean);
        function sync() {
            panels.forEach(panel => {
                const docked = panel.closest('#tidy-menu-dock,#table-menu-dock,#macro-menu-dock');
                const enabled = innerWidth <= 767 && !docked && !panel.classList.contains('hidden') && !panel.hidden;
                if (!enabled) {
                    if (panel.matches(':popover-open')) panel.hidePopover();
                    panel.removeAttribute('popover');
                    if (panel.classList.contains('mobile-editor-popover')) panel.classList.remove('mobile-editor-popover');
                    return;
                }
                if (!panel.classList.contains('mobile-editor-popover')) panel.classList.add('mobile-editor-popover');
                panel.setAttribute('popover','manual');
                if (!panel.querySelector('.mobile-menu-close')) {
                    const close = document.createElement('button');
                    close.type = 'button'; close.className = 'mobile-menu-close';
                    close.textContent = '메뉴 닫기 ×';
                    close.onclick = event => { event.stopPropagation(); panel.classList.add('hidden'); };
                    panel.prepend(close);
                }
                if (panel.showPopover && !panel.matches(':popover-open')) panel.showPopover();
            });
        }
        const observer = new MutationObserver(sync);
        panels.forEach(panel => observer.observe(panel,{attributes:true,attributeFilter:['class','hidden','data-docked']}));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') panels.filter(p => p.matches(':popover-open')).forEach(p => p.classList.add('hidden'));
        });
        addEventListener('resize',sync);
        sync();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();

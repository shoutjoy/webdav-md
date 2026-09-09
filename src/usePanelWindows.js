import { useEffect } from 'react';

// Keep the initial split layout until the user moves or resizes a panel.
export default function usePanelWindows({ mdpro = true, explorer = true } = {}) {
  useEffect(() => {
    if (!mdpro && !explorer) return undefined;
    let interaction;
    let holdTimer;
    const selectors = [mdpro && '.mdpro-stage', explorer && '.webdav-explorer-panel'].filter(Boolean);
    const selector = selectors.join(', ');
    const finish = () => {
      clearTimeout(holdTimer);
      interaction?.panel.classList.remove('is-panel-holding', 'is-panel-ready');
      if (interaction?.capture.hasPointerCapture(interaction.pointerId)) {
        interaction.capture.releasePointerCapture(interaction.pointerId);
      }
      interaction = null;
      document.body.classList.remove('is-panel-moving');
    };
    const down = (event) => {
      if (event.button !== 0) return;
      if (interaction) return;
      const handle = event.target.closest('[data-panel-edge]');
      const bar = event.target.closest('.webdav-explorer-bar, .mdpro-stage-bar');
      if (!handle && (!bar || event.target.closest('button, input, a, select'))) return;
      const panel = event.target.closest(selector);
      if (!panel || panel.classList.contains('is-app-fullscreen')) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const capture = handle || bar;
      capture.setPointerCapture(event.pointerId);
      interaction = { panel, edge: handle?.dataset.panelEdge, x: event.clientX, y: event.clientY, rect, capture, pointerId: event.pointerId, active: Boolean(handle) };
      if (handle) {
        document.body.classList.add('is-panel-moving');
      } else {
        panel.classList.add('is-panel-holding');
        holdTimer = setTimeout(() => {
          if (!interaction) return;
          interaction.active = true;
          panel.classList.remove('is-panel-holding');
          panel.classList.add('is-panel-ready');
          document.body.classList.add('is-panel-moving');
        }, 2000);
      }
    };
    const move = (event) => {
      if (!interaction || event.pointerId !== interaction.pointerId) return;
      const { panel, edge, x, y, rect } = interaction;
      const dx = event.clientX - x;
      const dy = event.clientY - y;
      if (!interaction.active) {
        if (Math.hypot(dx, dy) > 8) finish();
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let width = Math.min(rect.width, vw);
      let height = Math.min(rect.height, vh);
      let left = Math.max(0, Math.min(rect.left, vw - width));
      let top = Math.max(0, Math.min(rect.top, vh - height));
      const minimum = Math.min(240, vw);
      if (edge?.includes('left')) {
        const right = Math.min(vw, rect.right);
        left = Math.max(0, Math.min(rect.left + dx, right - minimum));
        width = right - left;
      } else if (edge?.includes('right')) {
        width = Math.max(Math.min(minimum, vw - left), Math.min(rect.width + dx, vw - left));
      }
      const minimumHeight = Math.min(160, vh);
      if (edge?.includes('top')) {
        const bottom = Math.min(vh, rect.bottom);
        top = Math.max(0, Math.min(rect.top + dy, bottom - minimumHeight));
        height = bottom - top;
      } else if (edge?.includes('bottom')) {
        height = Math.max(Math.min(minimumHeight, vh - top), Math.min(rect.height + dy, vh - top));
      }
      if (!edge) {
        left = Math.max(0, Math.min(rect.left + dx, vw - width));
        top = Math.max(0, Math.min(rect.top + dy, vh - height));
      }
      panel.classList.add('is-floating-panel');
      Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    };
    const restore = (event) => {
      if (!event.target.closest('.webdav-explorer-bar, .mdpro-stage-bar') || event.target.closest('button, input, a, select')) return;
      const panel = event.target.closest(selector);
      if (!panel || panel.classList.contains('is-app-fullscreen')) return;
      panel.classList.remove('is-floating-panel');
      for (const key of ['left', 'top', 'width', 'height']) panel.style[key] = '';
    };
    const fit = () => {
      document.querySelectorAll('.is-floating-panel').forEach(panel => {
        if (panel.classList.contains('is-app-fullscreen')) return;
        const rect = panel.getBoundingClientRect();
        const width = Math.min(rect.width, window.innerWidth);
        const height = Math.min(rect.height, window.innerHeight);
        Object.assign(panel.style, {
          width: `${width}px`, height: `${height}px`,
          left: `${Math.max(0, Math.min(rect.left, window.innerWidth - width))}px`,
          top: `${Math.max(0, Math.min(rect.top, window.innerHeight - height))}px`,
        });
      });
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        finish();
        document.querySelector('.mdpro-frame')?.contentWindow?.setAppFullscreenFallback?.(false);
      }
    };
    const release = (event) => {
      if (event.pointerId === interaction?.pointerId) finish();
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    document.addEventListener('lostpointercapture', release);
    document.addEventListener('dblclick', restore);
    document.addEventListener('keydown', escape);
    window.addEventListener('blur', finish);
    window.addEventListener('resize', fit);
    return () => {
      finish();
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
      document.removeEventListener('lostpointercapture', release);
      document.removeEventListener('dblclick', restore);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('blur', finish);
      window.removeEventListener('resize', fit);
    };
  }, [mdpro, explorer]);
}

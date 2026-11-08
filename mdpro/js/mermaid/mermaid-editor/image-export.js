/* Export only clones: HTML label geometry is measured in the live, font-ready SVG. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function nativeLabel(source, target) {
    const matrix = source.getScreenCTM();
    if (!matrix) throw new Error('라벨 위치를 측정할 수 없습니다.');
    const inverse = matrix.inverse();
    const group = document.createElementNS(NS, 'g');
    // foreignObject x/y are part of its geometry, not its CTM.
    // Range coordinates transformed by that CTM already include those offsets.
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const style = getComputedStyle(node.parentElement);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const range = document.createRange();
      const runs = [];
      for (let offset = 0; offset < node.length;) {
        const count = node.data.codePointAt(offset) > 0xffff ? 2 : 1;
        range.setStart(node, offset);
        range.setEnd(node, offset + count);
        const rect = range.getBoundingClientRect();
        const chars = node.data.slice(offset, offset + count);
        offset += count;
        if (!rect.width || !rect.height) continue;
        const left = new DOMPoint(rect.left, rect.top).matrixTransform(inverse);
        const bottom = new DOMPoint(rect.right, rect.bottom).matrixTransform(inverse);
        const last = runs[runs.length - 1];
        if (last && Math.abs(last.y - left.y) < 0.5 && Math.abs(last.right - left.x) < 1) {
          last.text += chars;
          last.right = bottom.x;
        } else runs.push({ x: left.x, y: left.y, right: bottom.x, height: bottom.y - left.y, text: chars });
      }
      for (const run of runs) {
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(run.x));
        // Match the inline font's baseline inside its measured text rectangle.
        text.setAttribute('y', String(run.y + run.height / 2 + parseFloat(style.fontSize) * 0.35));
        text.setAttribute('xml:space', 'preserve');
        const properties = {
          fill: style.color, color: style.color, stroke: 'none', 'stroke-width': '0',
          'font-family': style.fontFamily, 'font-size': style.fontSize,
          'font-weight': style.fontWeight, 'font-style': style.fontStyle,
          'letter-spacing': style.letterSpacing, 'text-anchor': 'start',
          'dominant-baseline': 'auto', 'white-space': 'pre', filter: 'none'
        };
        for (const [key, value] of Object.entries(properties)) text.style.setProperty(key, value, 'important');
        text.setAttribute('stroke', 'none');
        text.setAttribute('stroke-width', '0');
        text.textContent = run.text;
        group.appendChild(text);
      }
    }
    target.replaceWith(group);
  }

  function serialize(source, background) {
    const clone = source.cloneNode(true);
    const box = source.viewBox.baseVal;
    if (!(box.width > 0 && box.height > 0)) throw new Error('도표 크기를 측정할 수 없습니다.');
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('width', String(Math.ceil(box.width)));
    clone.setAttribute('height', String(Math.ceil(box.height)));
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    clone.style.cssText = 'display:block;max-width:none;';
    const originals = source.querySelectorAll('foreignObject');
    clone.querySelectorAll('foreignObject').forEach((target, i) => nativeLabel(originals[i], target));
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(box.x));
    rect.setAttribute('y', String(box.y));
    rect.setAttribute('width', String(box.width));
    rect.setAttribute('height', String(box.height));
    rect.setAttribute('fill', background);
    clone.insertBefore(rect, clone.firstChild);
    const serialized = new XMLSerializer().serializeToString(clone);
    const parsed = new DOMParser().parseFromString(serialized, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('SVG XML 생성에 실패했습니다.');
    return serialized;
  }

  window.MermaidEditorExport = { serialize };
})();

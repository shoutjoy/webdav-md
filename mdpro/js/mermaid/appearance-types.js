/* Diagram-specific appearance without changing semantic data or graph connections. */
(function (root) {
    'use strict';
    function type(source) {
        const clean = String(source || '').replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '').replace(/%%\{[\s\S]*?\}%%/g, '').replace(/^\s*%%[^\n]*$/gm, '').trim();
        return (clean.match(/^[\w-]+/) || ['unknown'])[0].toLowerCase();
    }
    const flow = source => ['flowchart', 'graph'].includes(type(source));
    function config(source, a) {
        const t = type(source), c = {}, w = a.chartWidth, h = a.chartHeight;
        if (t === 'quadrantchart') c.quadrantChart = Object.assign({}, w != null ? { chartWidth: 500 * w } : {}, h != null ? { chartHeight: 500 * h } : {}, a.pointSize != null ? { pointRadius: a.pointSize } : {});
        if (t.startsWith('xychart')) c.xyChart = Object.assign({}, w != null ? { width: 700 * w } : {}, h != null ? { height: 500 * h } : {});
        if (t === 'mindmap') c.mindmap = Object.assign({}, a.width != null ? { maxNodeWidth: 200 * a.width } : {}, a.layoutSpacing != null ? { padding: 10 * a.layoutSpacing } : {});
        if (t === 'kanban' && (a.width != null || a.layoutSpacing != null)) c.kanban = { sectionWidth: 200 * (a.width || 1) * (a.layoutSpacing || 1) };
        if (t === 'journey') c.journey = Object.assign({}, a.width != null ? { width: 150 * a.width } : {}, a.layoutSpacing != null ? { taskMargin: 50 * a.layoutSpacing } : {});
        if (t === 'timeline' && a.layoutSpacing != null) c.timeline = { padding: 50 * a.layoutSpacing };
        if (t === 'sequencediagram') c.sequence = Object.assign({}, a.width != null ? { width: 150 * a.width } : {}, a.layoutSpacing != null ? { actorMargin: 50 * a.layoutSpacing, messageMargin: 35 * a.layoutSpacing } : {});
        return c;
    }
    function css(a) {
        let s = '';
        if (a.font != null) s += 'text,tspan,foreignObject div,foreignObject span,foreignObject p{font-size:' + a.font + 'px!important;}';
        if (a.fontWeight != null) s += 'text,tspan,foreignObject *{font-weight:' + a.fontWeight + '!important;}';
        if (a.fontFamily) s += 'text,tspan,foreignObject *{font-family:' + JSON.stringify(a.fontFamily) + '!important;}';
        return s;
    }
    function prepare(source, a) {
        if (flow(source) || !a || !Object.values(a).some(v => v != null)) return source;
        const c = config(source, a);
        c.themeCSS = css(a);
        if (a.font != null) c.themeVariables = { fontSize: a.font + 'px' };
        const directive = '%%{init: ' + JSON.stringify(c) + '}%%\n';
        const front = String(source).match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
        return front ? front[0] + directive + source.slice(front[0].length) : directive + source;
    }
    function apply(svg, source, a) {
        if (flow(source) || !a || !Object.values(a).some(v => v != null)) return;
        const set = (el, key, value) => { if (value != null) el.style.setProperty(key, String(value), 'important'); };
        svg.querySelectorAll('text,tspan,foreignObject div,foreignObject span,foreignObject p').forEach(el => {
            set(el, 'font-size', a.font == null ? null : a.font + 'px');
            set(el, 'fill', a.textColor); set(el, 'color', a.textColor);
            set(el, 'font-weight', a.fontWeight); set(el, 'font-family', a.fontFamily);
        });
        svg.querySelectorAll('rect,circle,ellipse,polygon,path,line').forEach(el => {
            if (el.closest('defs,marker,clipPath,mask') || el.closest('foreignObject')) return;
            const cs = root.getComputedStyle(el);
            const edge = el.matches('line') || /edge|link|messageLine|relationship|branch|lineWrapper/i.test(el.getAttribute('class') || '') || (el.tagName.toLowerCase() === 'path' && cs.fill === 'none');
            if (edge) { set(el, 'stroke', a.color); set(el, 'stroke-width', a.stroke == null ? null : a.stroke + 'px'); }
            else {
                set(el, 'fill', a.fill); set(el, 'fill-opacity', a.alpha);
                set(el, 'stroke', a.nodeColor); set(el, 'stroke-width', a.nodeStroke == null ? null : a.nodeStroke + 'px');
            }
            const point = el.matches('.data-point circle,circle[class^="actor-"],circle.commit');
            if (point && a.pointSize != null) el.setAttribute('r', a.pointSize);
        });
    }
    root.MermaidAppearanceTypes = { type, flow, config, css, prepare, apply };
})(window);

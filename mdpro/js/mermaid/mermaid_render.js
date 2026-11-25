(function (global) {
    'use strict';

    const MERMAID_SOURCES = [
        'https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.min.js',
        'https://unpkg.com/mermaid@11.14.0/dist/mermaid.min.js',
        'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
        'https://unpkg.com/mermaid@11/dist/mermaid.min.js'
    ];
    const CODE_SELECTOR = 'pre > code';
    const MERMAID_DISPLAY_MODE_KEY = 'md_viewer_mermaid_display_mode';
    const MERMAID_THEME_KEY = 'md_viewer_mermaid_theme';
    const MERMAID_LIGHT_THEME_VARIABLES = {
        fontFamily: '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif',
        fontSize: '15px',
        primaryColor: '#ffffff',
        primaryTextColor: '#172033',
        primaryBorderColor: '#cbd5e1',
        lineColor: '#64748b',
        secondaryColor: '#f8fafc',
        tertiaryColor: '#eef6ff',
        background: '#ffffff',
        mainBkg: '#ffffff',
        secondBkg: '#f8fafc',
        tertiaryBkg: '#eef6ff',
        nodeBorder: '#cbd5e1',
        clusterBkg: '#f8fafc',
        clusterBorder: '#d7dee8',
        edgeLabelBackground: '#ffffff',
        textColor: '#172033',
        titleColor: '#0f172a',
        labelTextColor: '#172033',
        actorBkg: '#ffffff',
        actorBorder: '#cbd5e1',
        actorTextColor: '#172033',
        noteBkgColor: '#fff7ed',
        noteTextColor: '#3b2f20',
        noteBorderColor: '#fed7aa'
    };
    const MERMAID_DARK_THEME_VARIABLES = {
        fontFamily: '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif',
        fontSize: '15px',
        primaryColor: '#111827',
        primaryTextColor: '#e5edf7',
        primaryBorderColor: '#475569',
        lineColor: '#94a3b8',
        secondaryColor: '#172033',
        tertiaryColor: '#1e293b',
        background: '#0b1220',
        mainBkg: '#111827',
        secondBkg: '#172033',
        tertiaryBkg: '#1e293b',
        nodeBorder: '#475569',
        clusterBkg: '#0f172a',
        clusterBorder: '#334155',
        edgeLabelBackground: '#111827',
        textColor: '#e5edf7',
        titleColor: '#f8fafc',
        labelTextColor: '#e5edf7',
        actorBkg: '#111827',
        actorBorder: '#475569',
        actorTextColor: '#e5edf7',
        noteBkgColor: '#2d2418',
        noteTextColor: '#fdecc8',
        noteBorderColor: '#92400e'
    };
    let mermaidLoadPromise = null;
    let mermaidReady = false;
    let mermaidControlStyleInjected = false;
    const mermaidSvgCache = new Map();
    const MERMAID_SVG_CACHE_LIMIT = 40;
    const mermaidCacheStats = { hits: 0, misses: 0, writes: 0, evictions: 0 };
    let mermaidWorkQueue = Promise.resolve();
    let cachedMermaidSequence = 0;
    function enqueueMermaidWork(work) {
        const task = mermaidWorkQueue.catch(function () {}).then(work);
        mermaidWorkQueue = task;
        return task;
    }

    function isolateCachedMermaidIds(node) {
        const svg = node.querySelector('svg');
        if (!svg) return;
        const prefix = 'mdv-cache-' + (++cachedMermaidSequence) + '-';
        const ids = new Map();
        [svg].concat(Array.from(svg.querySelectorAll('[id]'))).forEach(element => {
            if (element.id) ids.set(element.id, prefix + element.id);
        });
        const cssIds = Array.from(ids.keys()).sort((a, b) => b.length - a.length);
        function references(value) {
            return value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, (match, id) => ids.has(id) ? 'url(#' + ids.get(id) + ')' : match);
        }
        [svg].concat(Array.from(svg.querySelectorAll('*'))).forEach(element => {
            Array.from(element.attributes).forEach(attribute => {
                let value = attribute.value;
                if (attribute.name === 'id') value = ids.get(value) || value;
                else if (/^(?:href|xlink:href)$/.test(attribute.name) && value.startsWith('#')) value = '#' + (ids.get(value.slice(1)) || value.slice(1));
                else if (/^aria-(?:labelledby|describedby)$/.test(attribute.name)) value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
                else value = references(value);
                if (value !== attribute.value) element.setAttribute(attribute.name, value);
            });
        });
        svg.querySelectorAll('style').forEach(style => {
            let text = references(style.textContent);
            cssIds.forEach(id => {
                const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                text = text.replace(new RegExp('#' + escaped + '(?![\\w-])', 'g'), '#' + ids.get(id));
            });
            style.textContent = text;
        });
    }

    function setWrapperMermaidTheme(wrapper, theme, appearance) {
        if (!wrapper || !wrapper.querySelector('.trt-mermaid-canvas') || !wrapper.getAttribute('data-mermaid-source')) {
            return Promise.reject(new Error('테마를 바꿀 Mermaid 원본 코드를 찾을 수 없습니다.'));
        }
        const next = theme === 'dark' ? 'dark' : 'light';
        const request = { theme: next };
        wrapper.__mdvMermaidThemeRequest = request;
        const button = wrapper.querySelector('.trt-mermaid-theme-toggle');
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        return enqueueMermaidWork(async function () {
            const node = wrapper.querySelector('.trt-mermaid-canvas');
            const storedSource = wrapper.getAttribute('data-mermaid-source');
            const source = global.MermaidAppearanceSource ? global.MermaidAppearanceSource.withDirection(storedSource, (appearance || wrapper.__mdvMermaidAppearance || {}).direction) : storedSource;
            const previousTheme = wrapper.getAttribute('data-mermaid-theme-override');
            const previousHtml = node.innerHTML;
            const previousAppearance = wrapper.__mdvMermaidAppearance;
            if (appearance !== undefined) wrapper.__mdvMermaidAppearance = appearance;
            const custom = wrapper.__mdvMermaidAppearance;
            try {
                await loadMermaid();
                if (custom && custom.fontFamily && document.fonts && document.fonts.load) await document.fonts.load((custom.fontWeight || 400) + ' ' + (custom.font || 15) + 'px ' + JSON.stringify(custom.fontFamily));
                await waitForMermaidFonts();
                wrapper.setAttribute('data-mermaid-theme-override', next);
                updateMermaidThemeButtons(wrapper);
                const cached = custom && Object.keys(custom).length ? null : readMermaidSvgCache(source, next);
                if (cached) {
                    node.innerHTML = cached;
                    isolateCachedMermaidIds(node);
                } else {
                    node.removeAttribute('data-processed');
                    node.textContent = global.MermaidAppearanceTypes ? global.MermaidAppearanceTypes.prepare(source, custom) : source;
                    configureMermaid(next, custom, storedSource);
                    await global.mermaid.run({ nodes: [node] });
                    restoreSankeyKoreanLabels(node);
                    polishMermaidSvg(node);
                    if (!custom || !Object.keys(custom).length) writeMermaidSvgCache(source, node.innerHTML, next);
                }
                if (wrapper.getAttribute('data-mermaid-mode') === 'fixed') applyFixedMermaidSize(wrapper);
                else applyMermaidTransform(wrapper);
            } catch (error) {
                node.innerHTML = previousHtml;
                wrapper.__mdvMermaidAppearance = previousAppearance;
                if (previousTheme) wrapper.setAttribute('data-mermaid-theme-override', previousTheme);
                else wrapper.removeAttribute('data-mermaid-theme-override');
                updateMermaidThemeButtons(wrapper);
                throw error;
            } finally {
                if (wrapper.__mdvMermaidThemeRequest === request) {
                    delete wrapper.__mdvMermaidThemeRequest;
                    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
                }
            }
        });
    }

    function hashMermaidSource(source) {
        const value = String(source || '');
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function getMermaidCacheKey(source, theme) {
        const value = String(source || '');
        return (theme || getMermaidTheme()) + ':' + value.length + ':' + hashMermaidSource(value);
    }

    function readMermaidSvgCache(source, theme) {
        const key = getMermaidCacheKey(source, theme);
        const cached = mermaidSvgCache.get(key);
        if (!cached || cached.source !== source) {
            mermaidCacheStats.misses += 1;
            return null;
        }
        mermaidSvgCache.delete(key);
        mermaidSvgCache.set(key, cached);
        mermaidCacheStats.hits += 1;
        return cached.html;
    }

    function writeMermaidSvgCache(source, html, theme) {
        const key = getMermaidCacheKey(source, theme);
        mermaidSvgCache.delete(key);
        mermaidSvgCache.set(key, { source: source, html: String(html || '') });
        mermaidCacheStats.writes += 1;
        while (mermaidSvgCache.size > MERMAID_SVG_CACHE_LIMIT) {
            const oldestKey = mermaidSvgCache.keys().next().value;
            mermaidSvgCache.delete(oldestKey);
            mermaidCacheStats.evictions += 1;
        }
    }

    function injectMermaidControlsStyle(doc) {
        const d = doc || document;
        if (mermaidControlStyleInjected || d.getElementById('mdv-mermaid-controls-style')) return;
        const style = d.createElement('style');
        style.id = 'mdv-mermaid-controls-style';
        style.textContent = [
            '.trt-mermaid-wrapper{position:relative;display:block;box-sizing:border-box;overflow:hidden;border:1px solid rgba(148,163,184,.35);border-radius:8px;background:#fff;min-width:180px;min-height:140px;height:450px;padding-right:158px;}',
            '.dark .trt-mermaid-wrapper,.trt-mermaid-wrapper[data-mermaid-theme="dark"]{background:#0f172a;border-color:#475569;}',
            '.dark .trt-mermaid-wrapper[data-mermaid-theme="light"],.trt-mermaid-wrapper[data-mermaid-theme="light"]{background:#fff;border-color:rgba(148,163,184,.35);}',
            '.trt-mermaid-viewport{position:relative;overflow:hidden;min-height:0;cursor:grab;touch-action:none;height:100%;}',
            '.trt-mermaid-viewport.dragging{cursor:grabbing;}',
            '.trt-mermaid-canvas{transform-origin:0 0;padding:24px;min-width:max-content;min-height:160px;overflow:visible;}',
            '.trt-mermaid-canvas svg{max-width:none !important;overflow:visible;text-rendering:geometricPrecision;shape-rendering:geometricPrecision;image-rendering:auto;}',
            '.trt-mermaid-wrapper[data-mermaid-mode="fixed"]{height:auto;min-height:0;padding:54px 18px 18px;overflow:hidden;}',
            '.trt-mermaid-wrapper[data-mermaid-mode="fixed"] .trt-mermaid-viewport{height:auto;min-height:0;overflow:auto;cursor:default;touch-action:auto;}',
            '.trt-mermaid-wrapper[data-mermaid-mode="fixed"] .trt-mermaid-canvas{width:100%;min-width:0;min-height:0;padding:0;}',
            '.trt-mermaid-wrapper[data-mermaid-mode="fixed"] .trt-mermaid-canvas svg{height:auto !important;max-width:none !important;transform:none !important;}',
            '.trt-mermaid-fixed-controls{position:relative;margin:0 0 12px;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:5px;}',
            '.trt-mermaid-appearance{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#475569;}',
            '.trt-mermaid-wrapper[data-mermaid-theme="dark"] .trt-mermaid-appearance{color:#e2e8f0;}',
            '.trt-mermaid-appearance-panel{flex:1 0 100%;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;}',
            '.trt-mermaid-appearance-panel[hidden]{display:none !important;}',
            '.trt-mermaid-appearance-toggle[aria-expanded="true"]{border-color:#818cf8;background:#312e81;color:#f8fafc;}',
            '.trt-mermaid-appearance input{width:32px;height:30px;padding:2px;}',
            '.trt-mermaid-fixed-controls .trt-mermaid-btn{width:30px;height:30px;border-radius:6px;}',
            '.trt-mermaid-fixed-controls .trt-mermaid-fixed-fit{width:auto;min-width:42px;padding:0 8px;font-size:12px;}',
            '.trt-mermaid-fixed-controls .trt-mermaid-fixed-export{width:auto;min-width:40px;padding:0 7px;font-size:11px;}',
            '.trt-mermaid-theme-toggle{font-size:16px;font-weight:700;}',
            '.trt-mermaid-fixed-scale{min-width:46px;text-align:center;color:#475569;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;}',
            '.dark .trt-mermaid-fixed-scale,.trt-mermaid-wrapper[data-mermaid-theme="dark"] .trt-mermaid-fixed-scale{color:#cbd5e1;}',
            '.dark .trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-fixed-scale,.trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-fixed-scale{color:#475569;}',
            '.trt-mermaid-control-top,.trt-mermaid-control-pad{position:absolute;right:12px;display:grid;gap:5px;z-index:20;}',
            '.trt-mermaid-control-top{top:12px;grid-template-columns:repeat(3,34px);}',
            '.trt-mermaid-control-pad{top:62px;grid-template-columns:repeat(3,34px);}',
            '.trt-mermaid-btn{width:34px;height:34px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#334155;font-size:14px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.08);font-family:Arial,sans-serif;}',
            '.trt-mermaid-btn:hover{background:#eef2ff;border-color:#a5b4fc;color:#3730a3;}',
            '.dark .trt-mermaid-btn,.trt-mermaid-wrapper[data-mermaid-theme="dark"] .trt-mermaid-btn{background:#1e293b;border-color:#64748b;color:#e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.35);}',
            '.dark .trt-mermaid-btn:hover,.trt-mermaid-wrapper[data-mermaid-theme="dark"] .trt-mermaid-btn:hover{background:#312e81;border-color:#818cf8;color:#eef2ff;}',
            '.dark .trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-btn,.trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-btn{background:#f8fafc;border-color:#cbd5e1;color:#334155;box-shadow:0 1px 2px rgba(15,23,42,.08);}',
            '.dark .trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-btn:hover,.trt-mermaid-wrapper[data-mermaid-theme="light"] .trt-mermaid-btn:hover{background:#eef2ff;border-color:#a5b4fc;color:#3730a3;}',
            '.trt-mermaid-pad-spacer{visibility:hidden;}',
            '.trt-mermaid-controls-toggle{position:absolute;top:12px;right:129px;z-index:22;width:auto;min-width:48px;padding:0 7px;font-size:11px;}',
            '.trt-mermaid-controls-collapsed{padding-right:18px;}',
            '.trt-mermaid-controls-collapsed .trt-mermaid-control-top,.trt-mermaid-controls-collapsed .trt-mermaid-control-pad{display:none;}',
            '.trt-mermaid-controls-collapsed .trt-mermaid-controls-toggle{right:12px;}',
            '.trt-mermaid-resize-handle{position:absolute;z-index:21;touch-action:none;}',
            '.trt-mermaid-resize-w{top:0;left:0;bottom:0;width:10px;cursor:ew-resize;}',
            '.trt-mermaid-resize-e{top:0;right:0;bottom:0;width:10px;cursor:ew-resize;}',
            '.trt-mermaid-resize-s{left:0;right:0;bottom:0;height:10px;cursor:ns-resize;}',
            '.trt-mermaid-resize-w::after,.trt-mermaid-resize-e::after{content:"";position:absolute;top:50%;width:3px;height:42px;border-radius:3px;background:#64748b;opacity:.42;transform:translateY(-50%);}',
            '.trt-mermaid-resize-w::after{left:2px;}',
            '.trt-mermaid-resize-e::after{right:2px;}',
            '.trt-mermaid-resize-s::after{content:"";position:absolute;left:50%;bottom:2px;width:42px;height:3px;border-radius:3px;background:#64748b;opacity:.42;transform:translateX(-50%);}',
            '.trt-mermaid-resize-w:hover::after,.trt-mermaid-resize-e:hover::after,.trt-mermaid-resize-s:hover::after{opacity:1;background:#6366f1;}',
            '.trt-mermaid-resize-sw{left:0;bottom:0;width:18px;height:18px;cursor:nesw-resize;background:linear-gradient(225deg,transparent 45%, #94a3b8 46%, #94a3b8 54%, transparent 55%);opacity:.75;}',
            '.trt-mermaid-resize-se{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 45%, #94a3b8 46%, #94a3b8 54%, transparent 55%);opacity:0.7;}',
            '.trt-mermaid-resize-sw:hover,.trt-mermaid-resize-se:hover{opacity:1;}'
        ].join('\n');
        d.head.appendChild(style);
        mermaidControlStyleInjected = true;
    }

    function getMermaidDisplayMode() {
        try {
            return localStorage.getItem(MERMAID_DISPLAY_MODE_KEY) === 'interactive' ? 'interactive' : 'fixed';
        } catch (e) {
            return 'fixed';
        }
    }

    function isDarkTheme() {
        return document.documentElement.classList.contains('dark');
    }

    function getMermaidTheme(wrapper) {
        const override = wrapper && wrapper.getAttribute && wrapper.getAttribute('data-mermaid-theme-override');
        if (override === 'dark' || override === 'light') return override;
        try {
            const saved = localStorage.getItem(MERMAID_THEME_KEY);
            if (saved === 'dark' || saved === 'light') return saved;
        } catch (e) {}
        return isDarkTheme() ? 'dark' : 'light';
    }

    function mermaidWrappers(root) {
        const target = root || document;
        return (target.matches && target.matches('.trt-mermaid-wrapper') ? [target] : [])
            .concat(target.querySelectorAll ? Array.from(target.querySelectorAll('.trt-mermaid-wrapper')) : []);
    }

    function updateMermaidThemeButtons(root) {
        mermaidWrappers(root).forEach(function (wrapper) {
            const dark = getMermaidTheme(wrapper) === 'dark';
            wrapper.setAttribute('data-mermaid-theme', dark ? 'dark' : 'light');
            wrapper.querySelectorAll('.trt-mermaid-theme-toggle').forEach(function (button) {
                button.textContent = dark ? '☀' : '☾';
                button.title = dark ? '이 도표만 라이트 모드로 전환' : '이 도표만 다크 모드로 전환';
                button.setAttribute('aria-label', button.title);
                button.setAttribute('aria-pressed', dark ? 'true' : 'false');
            });
        });
    }

    function setMermaidTheme(theme, wrapper) {
        if (wrapper) return setWrapperMermaidTheme(wrapper, theme);
        const nextTheme = theme === 'dark' ? 'dark' : 'light';
        try { localStorage.setItem(MERMAID_THEME_KEY, nextTheme); } catch (e) {}
        updateMermaidThemeButtons(document);
        return refresh(document);
    }

    function toggleMermaidTheme(wrapper) {
        const pending = wrapper && wrapper.__mdvMermaidThemeRequest;
        return setMermaidTheme((pending ? pending.theme : getMermaidTheme(wrapper)) === 'dark' ? 'light' : 'dark', wrapper);
    }

    function configureMermaid(theme, appearance, source) {
        if (!global.mermaid || typeof global.mermaid.initialize !== 'function') return;
        const dark = (theme || getMermaidTheme()) === 'dark';
        const a = appearance || {};
        let css = '';
        if (a.font) css += 'text,tspan,.label,.nodeLabel,.edgeLabel,.label p,.label span{font-size:' + a.font + 'px !important;}';
        if (a.color) css += '.flowchart-link,.edgePath path,.messageLine0,.messageLine1,.relationshipLine{stroke:' + a.color + ' !important;} marker path{stroke:' + a.color + ' !important;fill:' + a.color + ' !important;}';
        const nodeBorders = '.node > rect,.node > polygon,.node > circle,.node > ellipse,.node > path,.node > .label-container path,.node > .label-container rect,.node > .label-container polygon,.node > .label-container circle,.node > .label-container ellipse';
        if (a.nodeStroke != null) css += nodeBorders + '{stroke-width:' + a.nodeStroke + 'px !important;}';
        if (a.fill) css += nodeBorders + '{fill:' + a.fill + ' !important;}';
        if (a.alpha != null) css += nodeBorders + '{fill-opacity:' + a.alpha + ' !important;}';
        if (a.fontFamily) css += '.nodeLabel,.nodeLabel *,.edgeLabel,.edgeLabel *,text,tspan{font-family:' + (/^(sans-serif|serif|monospace)$/.test(a.fontFamily) ? a.fontFamily : JSON.stringify(a.fontFamily)) + ' !important;}';
        if (a.fontWeight != null) css += '.nodeLabel,.nodeLabel *,.edgeLabel,.edgeLabel *,text,tspan{font-weight:' + a.fontWeight + ' !important;}';
        if (a.textColor) css += '.nodeLabel,.nodeLabel *, .edgeLabel,.edgeLabel *,text,tspan{color:' + a.textColor + ' !important;fill:' + a.textColor + ' !important;}';
        if (a.nodeColor) css += nodeBorders + '{stroke:' + a.nodeColor + ' !important;}';
        if (a.stroke != null) css += '.flowchart-link,.edgePath path,.messageLine0,.messageLine1,.relationshipLine{stroke-width:' + a.stroke + 'px !important;}';
        if (global.MermaidAppearanceTypes) css += global.MermaidAppearanceTypes.css(a);
        global.mermaid.initialize(Object.assign({
            startOnLoad: false,
            suppressErrorRendering: true,
            securityLevel: 'loose',
            theme: Object.values(a).some(value => value != null) ? 'base' : (dark ? 'dark' : 'default'),
            themeCSS: css,
            flowchart: Object.assign({ useMaxWidth: true, htmlLabels: true }, a.width ? { padding: 20 * a.width, wrappingWidth: 200 * a.width } : {}, a.edgeLength != null ? { rankSpacing: 50 * a.edgeLength } : {}),
            themeVariables: Object.assign({}, dark ? MERMAID_DARK_THEME_VARIABLES : MERMAID_LIGHT_THEME_VARIABLES, a.font ? { fontSize: a.font + 'px' } : {}, a.fontFamily ? { fontFamily: a.fontFamily } : {})
        }, global.MermaidAppearanceTypes ? global.MermaidAppearanceTypes.config(source, a) : {}));
    }

    function waitForMermaidFonts() {
        if (!document.fonts || !document.fonts.ready) return Promise.resolve();
        return Promise.race([
            document.fonts.ready.catch(function () {}),
            new Promise(function (resolve) { setTimeout(resolve, 800); })
        ]);
    }

    function loadMermaidFromSource(src) {
        return new Promise(function (resolve, reject) {
            var stale = document.querySelectorAll('script[data-trt-mermaid="1"]');
            for (var i = 0; i < stale.length; i++) {
                try { stale[i].parentNode && stale[i].parentNode.removeChild(stale[i]); } catch (e) {}
            }
            var script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.setAttribute('data-trt-mermaid', '1');
            script.onload = function () {
                if (!global.mermaid) {
                    reject(new Error('Mermaid global not found after load.'));
                    return;
                }
                resolve(global.mermaid);
            };
            script.onerror = function () {
                reject(new Error('Failed to load mermaid library from ' + src));
            };
            document.head.appendChild(script);
        });
    }

    function loadMermaid() {
        if (mermaidReady && global.mermaid) return Promise.resolve(global.mermaid);
        if (mermaidLoadPromise) return mermaidLoadPromise;
        mermaidLoadPromise = (async function () {
            var lastErr = null;
            for (var i = 0; i < MERMAID_SOURCES.length; i++) {
                try {
                    await loadMermaidFromSource(MERMAID_SOURCES[i]);
                    if (!global.mermaid) throw new Error('Mermaid global not found.');
                    try { configureMermaid(); } catch (e) {}
                    mermaidReady = true;
                    return global.mermaid;
                } catch (err) {
                    lastErr = err;
                }
            }
            throw (lastErr || new Error('Failed to load mermaid library.'));
        })().catch(function (err) {
            mermaidLoadPromise = null;
            return Promise.reject(err);
        });
        return mermaidLoadPromise;
    }

    function buildMermaidNodeFromCode(codeEl, options) {
        if (!codeEl) return null;
        const pre = codeEl.parentElement;
        if (!pre || pre.tagName !== 'PRE') return null;
        const rawText = String(codeEl.textContent || '').trim();
        const className = String(codeEl.className || '').toLowerCase();
        const looksTagged = className.includes('mermaid') || className.includes('language-mermaid') || className.includes('lang-mermaid');
        const looksLikeMermaid = /^(%%\{[\s\S]*?\}%%\s*)?(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|c4Context|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|treeView-beta|treeview)\b/i.test(rawText);
        if (!looksTagged && !looksLikeMermaid) return null;
        const prepared = preprocessMermaidSource(rawText);
        const source = prepared && prepared.source ? prepared.source : '';
        if (!source) return null;

        injectMermaidControlsStyle(document);
        const wrapper = document.createElement('div');
        wrapper.className = 'trt-mermaid-wrapper my-3';
        wrapper.setAttribute('data-mermaid-source', source);
        wrapper.setAttribute('data-mermaid-original-source', rawText);
        const savedAppearance = global.MermaidAppearanceSource && global.MermaidAppearanceSource.readAppearance(rawText);
        if (savedAppearance) wrapper.__mdvMermaidAppearance = savedAppearance;
        wrapper.setAttribute('data-mermaid-mode', getMermaidDisplayMode());
        const retained = pre.__mdvMermaidPresentation;
        if (retained) {
            if (retained.appearance) wrapper.__mdvMermaidAppearance = retained.appearance;
            if (retained.theme) wrapper.setAttribute('data-mermaid-theme-override', retained.theme);
            wrapper.style.cssText = retained.style;
            if (retained.fixed) wrapper.__mdvFixedMermaidSizeState = retained.fixed;
            if (retained.pan) wrapper.__mdvMermaidPanState = retained.pan;
        }
        wrapper.setAttribute('data-mermaid-theme', getMermaidTheme(wrapper));
        if (prepared && prepared.labelMap && Object.keys(prepared.labelMap).length) {
            wrapper.setAttribute('data-sankey-label-map', JSON.stringify(prepared.labelMap));
        }

        const viewport = document.createElement('div');
        viewport.className = 'trt-mermaid-viewport';
        const block = document.createElement('div');
        block.className = 'mermaid trt-mermaid-canvas';
        const cachedHtml = options && options.ignoreCache ? null : readMermaidSvgCache(source, getMermaidTheme(wrapper));
        if (cachedHtml) {
            block.innerHTML = cachedHtml;
            isolateCachedMermaidIds(block);
            block.setAttribute('data-mermaid-cache-hit', '1');
        } else {
            block.textContent = source;
        }
        viewport.appendChild(block);
        wrapper.appendChild(viewport);

        pre.replaceWith(wrapper);
        return block;
    }

    function isQuotedField(value) {
        var v = String(value || '').trim();
        return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
    }

    function quoteMermaidFieldIfNeeded(value) {
        var v = String(value || '').trim();
        if (!v) return '""';
        if (isQuotedField(v)) return v;
        // Quote non-ASCII (e.g. Korean) or whitespace/special-label values for robust Sankey parsing.
        if (/[^\x00-\x7F]/.test(v) || /\s/.test(v) || /[,:;]/.test(v)) {
            return '"' + v.replace(/"/g, '\\"') + '"';
        }
        return v;
    }

    function unquoteField(value) {
        var v = String(value || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            return v.slice(1, -1);
        }
        return v;
    }

    function preprocessSankeyBetaSource(source) {
        var lines = String(source || '').split(/\r?\n/);
        if (!lines.length) return { source: source, labelMap: null };
        var out = [];
        var started = false;
        var labelMap = {};
        var reverseMap = {};
        var aliasSeq = 0;

        function toAlias(label) {
            var key = String(label || '');
            if (reverseMap[key]) return reverseMap[key];
            var alias = 'kr_node_' + aliasSeq++;
            reverseMap[key] = alias;
            labelMap[alias] = key;
            return alias;
        }

        for (var i = 0; i < lines.length; i++) {
            var raw = lines[i];
            var trimmed = String(raw || '').trim();
            if (!started) {
                out.push(raw);
                if (/^sankey-beta\b/i.test(trimmed)) started = true;
                continue;
            }
            if (!trimmed) {
                out.push(raw);
                continue;
            }
            if (/^%%/.test(trimmed)) {
                out.push(raw);
                continue;
            }

            var noSemi = trimmed.replace(/;+\s*$/, '');
            var m = noSemi.match(/^(.*?),(.*?),(.*)$/);
            if (!m) {
                out.push(raw);
                continue;
            }
            var fromRaw = unquoteField(m[1]);
            var toRaw = unquoteField(m[2]);
            var from = /[^\x00-\x7F]/.test(fromRaw) ? toAlias(fromRaw) : quoteMermaidFieldIfNeeded(m[1]);
            var to = /[^\x00-\x7F]/.test(toRaw) ? toAlias(toRaw) : quoteMermaidFieldIfNeeded(m[2]);
            var value = String(m[3] || '').trim();
            out.push(from + ', ' + to + ', ' + value);
        }
        return {
            source: out.join('\n'),
            labelMap: Object.keys(labelMap).length ? labelMap : null
        };
    }

    function normalizeMermaidDiagramType(source) {
        var src = String(source || '');
        // Accept both "treeView" and "treeview" and normalize to the beta keyword.
        return src
            .replace(/(^\s*)(treeview|treeView)(?!-beta)(?=\s|$)/im, '$1treeView-beta')
            .replace(/[—–−]\s*>/g, '-->')
            .replace(/<\s*[—–−]/g, '<--')
            .replace(/[—–−]{2,}\s*>/g, '-->');
    }

    function preprocessMermaidSource(source) {
        var src = normalizeMermaidDiagramType(source).trim();
        if (!src) return { source: src, labelMap: null };
        if (global.MermaidAppearanceTypes?.type(src) === 'sankey-beta' || /^sankey-beta\b/i.test(src)) return preprocessSankeyBetaSource(src);
        if (global.MermaidLabelSanitizer && typeof global.MermaidLabelSanitizer.preprocess === 'function') {
            src = global.MermaidLabelSanitizer.preprocess(src);
        }
        return { source: src, labelMap: null };
    }

    function restoreSankeyKoreanLabels(node) {
        var parent = node && (node.closest('.trt-mermaid-wrapper') || node.parentElement);
        if (!parent) return;
        var mapText = parent.getAttribute('data-sankey-label-map');
        if (!mapText) return;
        var labelMap = null;
        try { labelMap = JSON.parse(mapText); } catch (e) { labelMap = null; }
        if (!labelMap) return;
        var svg = parent.querySelector('svg');
        if (!svg) return;
        var textNodes = svg.querySelectorAll('text, tspan');
        function escapeRegExp(text) {
            return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        for (var i = 0; i < textNodes.length; i++) {
            var el = textNodes[i];
            var raw = String(el.textContent || '');
            var next = raw;
            for (var alias in labelMap) {
                if (!Object.prototype.hasOwnProperty.call(labelMap, alias)) continue;
                var label = String(labelMap[alias] || '');
                if (!label) continue;
                var re = new RegExp('\\b' + escapeRegExp(alias) + '\\b', 'g');
                next = next.replace(re, label);
            }
            if (next !== raw) el.textContent = next;
        }
    }



    function polishMermaidSvg(node) {
        const svg = node && node.querySelector ? node.querySelector('svg') : null;
        if (!svg) return;
        svg.style.display = 'block';
        svg.style.marginLeft = 'auto';
        svg.style.marginRight = 'auto';
        // An SVG <style> is document-wide CSS. Scope every selector to this SVG.
        svg.querySelectorAll('style[data-mdv-mermaid-polish="1"]').forEach(style => style.remove());
        const scope = '#' + CSS.escape(svg.id);
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.setAttribute('data-mdv-mermaid-polish', '1');
        style.textContent = [
            scope + ' .nodeLabel,' + scope + ' .edgeLabel{letter-spacing:normal;}',
            scope + ' foreignObject,' + scope + ' foreignObject>div{overflow:visible;}',
            scope + ' .nodeLabel p,' + scope + ' .edgeLabel p{margin:0;}'
        ].join('\n');
        svg.insertBefore(style, svg.firstChild);
        const wrapper = node.closest('.trt-mermaid-wrapper');
        if (global.MermaidAppearanceTypes) global.MermaidAppearanceTypes.apply(svg, wrapper?.getAttribute('data-mermaid-original-source'), wrapper?.__mdvMermaidAppearance);
        repairMermaidArrowheads(svg);
        ensureMermaidLabelContrast(node);
        if (global.MermaidAppearanceCustom) global.MermaidAppearanceCustom.apply(svg, wrapper?.getAttribute('data-mermaid-original-source'), wrapper?.__mdvMermaidAppearance?.custom);
        if (global.MermaidAppearanceCustom2) global.MermaidAppearanceCustom2.apply(svg, wrapper?.getAttribute('data-mermaid-original-source'), wrapper?.__mdvMermaidAppearance?.custom2);
    }

    function repairMermaidArrowheads(svg) {
        const shapes = Array.from(svg.querySelectorAll('.node > .label-container,.node > .label-container path'));
        const border = Math.max(1, ...shapes.map(n => parseFloat(global.getComputedStyle(n).strokeWidth) || 1));
        let largestArrow = 8, largestStroke = 1;
        svg.querySelectorAll('.flowchart-link').forEach(function (edge, index) {
            largestStroke = Math.max(largestStroke, parseFloat(global.getComputedStyle(edge).strokeWidth) || 1);
            const computed = global.getComputedStyle(edge);
            const width = parseFloat(computed.strokeWidth) || 1;
            for (const side of ['start', 'end']) {
                const value = edge.getAttribute('marker-' + side) || computed.getPropertyValue('marker-' + side);
                const match = String(value).match(/#([^)'"\s]+)[)'"\s]*$/);
                if (!match) continue;
                const original = Array.from(svg.querySelectorAll('marker')).find(m => m.id === match[1]);
                if (!original || !/point(?:End|Start)(?:$|-)/.test(original.id)) continue;
                const appearance = svg.closest('.trt-mermaid-wrapper')?.__mdvMermaidAppearance || {};
                const arrowScale = Number.isFinite(appearance.arrowSize) ? Math.min(10, Math.max(.1, appearance.arrowSize)) : 1;
                const marker = original.cloneNode(true), size = Math.max(8, width * 2.4 + border) * arrowScale;
                largestArrow = Math.max(largestArrow, size);
                marker.id = svg.id + '-mdv-point' + side + '-' + index;
                marker.setAttribute('markerUnits', 'userSpaceOnUse');
                marker.setAttribute('markerWidth', size); marker.setAttribute('markerHeight', size);
                marker.setAttribute('refX', side === 'end' ? 10 + (border / 2 + 1) * 10 / size : -(border / 2 + 1) * 10 / size);
                marker.setAttribute('overflow', 'visible');
                marker.querySelectorAll('path').forEach(path => { path.style.setProperty('fill', computed.stroke, 'important'); path.style.setProperty('stroke', computed.stroke, 'important'); path.style.setProperty('stroke-width', '1px', 'important'); });
                original.parentNode.appendChild(marker);
                edge.setAttribute('marker-' + side, 'url(#' + marker.id + ')');
                edge.style.setProperty('marker-' + side, 'url(#' + marker.id + ')');
            }
        });
        if (largestStroke > 4 || border > 4 || largestArrow > 16) {
            const wrapper = svg.closest('.trt-mermaid-wrapper');
            const direction = wrapper && wrapper.__mdvMermaidAppearance && wrapper.__mdvMermaidAppearance.direction
                || ((wrapper && wrapper.getAttribute('data-mermaid-source') || '').match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m) || [])[1] || 'TD';
            svg.querySelectorAll('.edgeLabels > .edgeLabel').forEach(label => {
                const base = label.getAttribute('data-mdv-label-base') || label.getAttribute('transform') || '';
                label.setAttribute('data-mdv-label-base', base);
                const b = label.getBBox(), offset = largestArrow / 2 + (/LR|RL/.test(direction) ? b.height : b.width) / 2 + 6;
                label.setAttribute('transform', base + (/LR|RL/.test(direction) ? ' translate(0,' + (-offset) + ')' : ' translate(' + offset + ',0)'));
            });
            // Moving edge labels for thick arrows must also enlarge the viewport.
            // Keep HTML label measurements unchanged; only extend the SVG bounds.
            const bounds = svg.getBBox();
            const box = String(svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
            if (box.length === 4 && box.every(Number.isFinite) && bounds.width > 0 && bounds.height > 0) {
                const pad = largestArrow / 2 + 8;
                const left = Math.min(box[0], bounds.x - pad), top = Math.min(box[1], bounds.y - pad);
                const right = Math.max(box[0] + box[2], bounds.x + bounds.width + pad);
                const bottom = Math.max(box[1] + box[3], bounds.y + bounds.height + pad);
                svg.setAttribute('viewBox', [left, top, right - left, bottom - top].join(' '));
            }
        }
    }

    function ensureMermaidLabelContrast(node) {
        const wrapper = node.closest('.trt-mermaid-wrapper');
        if (wrapper && wrapper.__mdvMermaidAppearance && wrapper.__mdvMermaidAppearance.textColor) return;
        const source = wrapper && wrapper.getAttribute('data-mermaid-source') || '';
        const explicitClasses = new Set();
        const explicitNodes = new Set();
        for (const match of source.matchAll(/classDef\s+([\w,-]+)\s+([^;\n]+)/g)) {
            if (/(?:^|,)\s*color\s*:/.test(match[2])) match[1].split(',').forEach(id => explicitClasses.add(id));
        }
        for (const match of source.matchAll(/(?:^|[;\n])\s*style\s+([\w,-]+)\s+([^;\n]+)/g)) {
            if (/(?:^|,)\s*color\s*:/.test(match[2])) match[1].split(',').forEach(id => explicitNodes.add(id));
        }
        function rgb(value) {
            const parts = String(value).match(/[\d.]+/g);
            return parts && parts.length >= 3 && (parts.length < 4 || Number(parts[3]) > 0) ? parts.slice(0, 3).map(Number) : null;
        }
        function luminance(color) {
            return color.map(c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        }
        node.querySelectorAll('g.node').forEach(function (group) {
            const id = (group.id.match(/flowchart-(.+)-\d+$/) || [])[1];
            if (explicitNodes.has(id) || Array.from(group.classList).some(name => explicitClasses.has(name))) return;
            const shape = group.querySelector('.label-container,rect,circle,ellipse,polygon,path');
            const label = group.querySelector('.nodeLabel');
            if (!shape || !label) return;
            const fill = rgb(global.getComputedStyle(shape).fill);
            const color = rgb(global.getComputedStyle(label).color);
            if (!fill || !color) return;
            const bg = luminance(fill), fg = luminance(color);
            if ((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) >= 4.5) return;
            const readable = bg > 0.179 ? '#172033' : '#e2e8f0';
            group.querySelectorAll('.nodeLabel,.label text,.label tspan').forEach(function (text) {
                text.style.setProperty('color', readable);
                text.style.setProperty('fill', readable);
            });
        });
    }

    function getMermaidPanState(wrapper) {
        if (!wrapper.__mdvMermaidPanState) {
            wrapper.__mdvMermaidPanState = { scale: 1, x: 0, y: 0 };
        }
        return wrapper.__mdvMermaidPanState;
    }

    function applyMermaidTransform(wrapper) {
        const canvas = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-canvas') : null;
        if (!canvas) return;
        const s = getMermaidPanState(wrapper);
        const svg = canvas.querySelector('svg');
        if (svg) {
            svg.style.transformOrigin = '0 0';
            svg.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px) scale(' + s.scale + ')';
            canvas.style.transform = 'none';
        } else {
            canvas.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px) scale(' + s.scale + ')';
        }
    }

    function adjustMermaidView(wrapper, dx, dy, scaleDelta) {
        const s = getMermaidPanState(wrapper);
        if (scaleDelta) s.scale = Math.max(0.1, Math.min(4, Math.round((s.scale + scaleDelta) * 100) / 100));
        s.x += dx || 0;
        s.y += dy || 0;
        applyMermaidTransform(wrapper);
    }

    function resetMermaidView(wrapper) {
        const s = getMermaidPanState(wrapper);
        s.scale = 1;
        s.x = 0;
        s.y = 0;
        applyMermaidTransform(wrapper);
    }

    function fitMermaidView(wrapper) {
        const viewport = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-viewport') : null;
        const canvas = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-canvas') : null;
        if (!viewport || !canvas) return;
        const svg = canvas.querySelector('svg');
        
        // Measure sizes with scale reset to ensure getBoundingClientRect returns correct original size
        const oldSvgTransform = svg ? svg.style.transform : '';
        const oldCanvasTransform = canvas.style.transform;
        if (svg) svg.style.transform = 'none';
        canvas.style.transform = 'none';

        const target = svg || canvas;
        const vw = Math.max(1, viewport.clientWidth - 84);
        const vh = Math.max(1, viewport.clientHeight - 40);
        const w = Math.max(1, target.scrollWidth || target.getBoundingClientRect().width);
        const h = Math.max(1, target.scrollHeight || target.getBoundingClientRect().height);

        // Restore transforms
        if (svg) svg.style.transform = oldSvgTransform;
        canvas.style.transform = oldCanvasTransform;

        const scale = Math.max(0.1, Math.min(2, Math.min(vw / w, vh / h)));
        const s = getMermaidPanState(wrapper);
        s.scale = Math.round(scale * 100) / 100;
        s.x = Math.max(0, (viewport.clientWidth - (w * s.scale)) / 2);
        s.y = Math.max(0, (viewport.clientHeight - (h * s.scale)) / 2);
        applyMermaidTransform(wrapper);
    }

    function getFixedMermaidSizeState(wrapper) {
        if (!wrapper.__mdvFixedMermaidSizeState) {
            wrapper.__mdvFixedMermaidSizeState = { factor: 1 };
        }
        return wrapper.__mdvFixedMermaidSizeState;
    }

    function getMermaidSvgNaturalWidth(svg) {
        if (!svg) return 0;
        const viewBox = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
        if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0) return viewBox[2];
        const width = Number.parseFloat(svg.getAttribute('width'));
        return Number.isFinite(width) && width > 0 ? width : 0;
    }

    function applyFixedMermaidSize(wrapper, nextFactor) {
        const viewport = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-viewport') : null;
        const svg = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-canvas svg') : null;
        if (!viewport || !svg) return;
        const state = getFixedMermaidSizeState(wrapper);
        if (Number.isFinite(nextFactor)) {
            state.factor = Math.max(0.2, Math.min(1.6, Math.round(nextFactor * 10) / 10));
        }
        const availableWidth = Math.max(160, viewport.clientWidth || wrapper.clientWidth - 36 || 760);
        const naturalWidth = getMermaidSvgNaturalWidth(svg) || availableWidth;
        const fittedBaseWidth = Math.min(naturalWidth, availableWidth * 0.86);
        const displayWidth = Math.max(80, Math.min(availableWidth * 1.6, fittedBaseWidth * state.factor));
        svg.style.setProperty('width', Math.round(displayWidth) + 'px', 'important');
        svg.style.setProperty('height', 'auto', 'important');
        svg.style.setProperty('max-width', 'none', 'important');
        svg.style.setProperty('transform', 'none', 'important');
        wrapper.setAttribute('data-mermaid-fixed-scale', String(state.factor));
        const label = wrapper.querySelector('.trt-mermaid-fixed-scale');
        if (label) label.textContent = Math.round(state.factor * 100) + '%';
    }

    function bindFixedMermaidResize(wrapper) {
        if (!wrapper || wrapper.__mdvFixedResizeBound || typeof ResizeObserver === 'undefined') return;
        const viewport = wrapper.querySelector('.trt-mermaid-viewport');
        if (!viewport) return;
        wrapper.__mdvFixedResizeBound = true;
        let frame = 0;
        let lastWidth = Math.round(viewport.getBoundingClientRect().width * 10) / 10;
        const observer = new ResizeObserver(function (entries) {
            const entry = entries && entries[0];
            const width = entry && entry.contentRect
                ? Math.round(entry.contentRect.width * 10) / 10
                : Math.round(viewport.getBoundingClientRect().width * 10) / 10;
            if (Math.abs(width - lastWidth) < 0.5) return;
            lastWidth = width;
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(function () {
                frame = 0;
                applyFixedMermaidSize(wrapper);
            });
        });
        observer.observe(viewport);
        wrapper.__mdvFixedResizeObserver = observer;
    }

    function getMermaidExportSize(svg) {
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        let width = viewBox && viewBox.width > 0 ? viewBox.width : rect.width;
        let height = viewBox && viewBox.height > 0 ? viewBox.height : rect.height;
        if (!(width > 0)) width = 1200;
        if (!(height > 0)) height = 800;
        return { width: Math.ceil(width), height: Math.ceil(height) };
    }

    function inlineMermaidExportLabelStyles(sourceSvg, exportSvg) {
        const sourceNodes = sourceSvg.querySelectorAll('foreignObject, foreignObject *');
        const exportNodes = exportSvg.querySelectorAll('foreignObject, foreignObject *');
        const properties = [
            'color', 'background-color', 'font-family', 'font-size', 'font-style',
            'font-weight', 'line-height', 'letter-spacing', 'text-align', 'white-space',
            'display', 'align-items', 'justify-content', 'flex-direction', 'box-sizing',
            'width', 'height', 'max-width', 'padding', 'margin', 'border',
            'border-radius', 'overflow', 'overflow-wrap', 'word-break'
        ];
        for (let i = 0; i < exportNodes.length; i++) {
            const sourceNode = sourceNodes[i];
            const exportNode = exportNodes[i];
            if (!sourceNode || !exportNode) continue;
            const computed = global.getComputedStyle(sourceNode);
            properties.forEach(function (property) {
                const value = computed.getPropertyValue(property);
                if (value) exportNode.style.setProperty(property, value);
            });
        }
    }

    function createMermaidExportClone(wrapper) {
        const svg = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-canvas svg') : null;
        if (!svg) throw new Error('렌더링된 Mermaid SVG를 찾지 못했습니다.');
        const size = getMermaidExportSize(svg);
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        clone.setAttribute('width', String(size.width));
        clone.setAttribute('height', String(size.height));
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
        clone.style.width = size.width + 'px';
        clone.style.height = size.height + 'px';
        clone.style.maxWidth = 'none';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        inlineMermaidExportLabelStyles(svg, clone);

        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        const background = global.getComputedStyle(wrapper).backgroundColor;
        if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('data-mdv-export-background', '1');
            rect.setAttribute('x', String(viewBox && Number.isFinite(viewBox.x) ? viewBox.x : 0));
            rect.setAttribute('y', String(viewBox && Number.isFinite(viewBox.y) ? viewBox.y : 0));
            rect.setAttribute('width', String(viewBox && viewBox.width > 0 ? viewBox.width : size.width));
            rect.setAttribute('height', String(viewBox && viewBox.height > 0 ? viewBox.height : size.height));
            rect.setAttribute('fill', background);
            clone.insertBefore(rect, clone.firstChild);
        }
        return { svg: clone, size: size };
    }

    function mermaidBlobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(reader.error || new Error('이미지 변환에 실패했습니다.')); };
            reader.readAsDataURL(blob);
        });
    }

    function wrapMermaidExportLabel(text, maxWidth, font) {
        const value = String(text || '').replace(/\s+/g, ' ').trim();
        if (!value) return [];
        const measureCanvas = document.createElement('canvas');
        const context = measureCanvas.getContext('2d');
        if (!context || !(maxWidth > 0)) return [value];
        context.font = font;
        const tokens = value.split(/(\s+)/).filter(Boolean);
        const lines = [];
        let line = '';
        tokens.forEach(function (token) {
            const candidate = line + token;
            if (line.trim() && context.measureText(candidate).width > maxWidth) {
                lines.push(line.trim());
                line = token.trimStart();
            } else {
                line = candidate;
            }
        });
        if (line.trim()) lines.push(line.trim());
        return lines.length ? lines : [value];
    }

    function replaceMermaidHtmlLabelsForPng(sourceSvg, exportSvg) {
        const sourceObjects = sourceSvg.querySelectorAll('foreignObject');
        const exportObjects = exportSvg.querySelectorAll('foreignObject');
        for (let i = 0; i < exportObjects.length; i++) {
            const sourceObject = sourceObjects[i];
            const exportObject = exportObjects[i];
            if (!sourceObject || !exportObject) continue;
            const label = sourceObject.querySelector('.nodeLabel,.edgeLabel,p,span,div') || sourceObject;
            const computed = global.getComputedStyle(label);
            const x = Number.parseFloat(exportObject.getAttribute('x')) || 0;
            const y = Number.parseFloat(exportObject.getAttribute('y')) || 0;
            const width = Number.parseFloat(exportObject.getAttribute('width')) || 0;
            const height = Number.parseFloat(exportObject.getAttribute('height')) || 0;
            const fontSize = Number.parseFloat(computed.fontSize) || 16;
            const fontWeight = computed.fontWeight || '600';
            const fontFamily = computed.fontFamily || 'Arial, sans-serif';
            const fontStyle = computed.fontStyle || 'normal';
            const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.2;
            const paddingX = (Number.parseFloat(computed.paddingLeft) || 0) + (Number.parseFloat(computed.paddingRight) || 0);
            const font = fontStyle + ' ' + fontWeight + ' ' + fontSize + 'px ' + fontFamily;
            const paragraphs = sourceObject.querySelectorAll('p');
            let lines = [];
            // Block HTML in a label can leave empty <p> siblings around its <div>.
            // Those paragraphs must not hide the actual label text during PNG export.
            const nonemptyParagraphs = Array.from(paragraphs).filter(function (part) {
                return String(part.textContent || '').trim();
            });
            const sources = nonemptyParagraphs.length ? nonemptyParagraphs : [sourceObject];
            sources.forEach(function (part) {
                lines = lines.concat(wrapMermaidExportLabel(part.textContent, Math.max(10, width - paddingX), font));
            });
            if (!lines.length) {
                exportObject.remove();
                continue;
            }
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const centerX = x + width / 2;
            const firstY = y + height / 2 - ((lines.length - 1) * lineHeight / 2);
            text.setAttribute('x', String(centerX));
            text.setAttribute('y', String(firstY));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', computed.color || '#172033');
            text.setAttribute('font-family', fontFamily);
            text.setAttribute('font-size', String(fontSize));
            text.setAttribute('font-weight', fontWeight);
            text.setAttribute('font-style', fontStyle);
            text.setAttribute('letter-spacing', computed.letterSpacing || 'normal');
            text.setAttribute('stroke', 'none');
            text.setAttribute('stroke-width', '0');
            text.setAttribute('opacity', '1');
            text.style.setProperty('fill', computed.color || '#172033', 'important');
            text.style.setProperty('color', computed.color || '#172033', 'important');
            text.style.setProperty('stroke', 'none', 'important');
            text.style.setProperty('stroke-width', '0', 'important');
            text.style.setProperty('paint-order', 'normal', 'important');
            lines.forEach(function (line, lineIndex) {
                const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', String(centerX));
                if (lineIndex > 0) tspan.setAttribute('dy', String(lineHeight));
                tspan.setAttribute('fill', computed.color || '#172033');
                tspan.setAttribute('stroke', 'none');
                tspan.setAttribute('stroke-width', '0');
                tspan.style.setProperty('fill', computed.color || '#172033', 'important');
                tspan.style.setProperty('stroke', 'none', 'important');
                tspan.style.setProperty('stroke-width', '0', 'important');
                tspan.textContent = line;
                text.appendChild(tspan);
            });
            exportObject.replaceWith(text);
        }
    }

    async function exportMermaidWrapperImage(wrapper, format) {
        const exported = createMermaidExportClone(wrapper);
        if (format !== 'png') {
            const svgText = new XMLSerializer().serializeToString(exported.svg);
            return {
                dataUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText),
                width: exported.size.width,
                height: exported.size.height,
                format: 'svg'
            };
        }
        const sourceSvg = wrapper.querySelector('.trt-mermaid-canvas svg');
        replaceMermaidHtmlLabelsForPng(sourceSvg, exported.svg);
        const svgText = new XMLSerializer().serializeToString(exported.svg);
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        try {
            const image = new Image();
            image.decoding = 'async';
            image.src = url;
            if (typeof image.decode === 'function') await image.decode();
            else await new Promise(function (resolve, reject) { image.onload = resolve; image.onerror = reject; });
            const scale = Math.min(Math.max(8, Number(global.devicePixelRatio) || 1), 8192 / Math.max(exported.size.width, exported.size.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(exported.size.width * scale));
            canvas.height = Math.max(1, Math.round(exported.size.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D context를 사용할 수 없습니다.');
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const pngBlob = await new Promise(function (resolve, reject) {
                canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('PNG 생성에 실패했습니다.')); }, 'image/png');
            });
            return {
                dataUrl: await mermaidBlobToDataUrl(pngBlob),
                width: canvas.width,
                height: canvas.height,
                format: 'png'
            };
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    async function openMermaidWrapperInImageInsert(wrapper, format) {
        try {
            const exported = await exportMermaidWrapperImage(wrapper, format);
            if (typeof global.openImageInsertModal !== 'function' || typeof global.applyImageInsertDataUrl !== 'function') {
                throw new Error('이미지 삽입 기능을 찾지 못했습니다.');
            }
            global.openImageInsertModal();
            global.applyImageInsertDataUrl(
                exported.dataUrl,
                'mermaid-view-' + Date.now() + '.' + exported.format
            );
        } catch (error) {
            console.error('Mermaid image insert failed:', error);
            if (typeof global.showToast === 'function') global.showToast('Mermaid 이미지 변환 실패: ' + (error && error.message ? error.message : error));
        }
    }

    async function downloadMermaidWrapperPng(wrapper, downloadButton) {
        if (downloadButton && downloadButton.disabled) return;
        if (downloadButton) { downloadButton.disabled = true; downloadButton.setAttribute('aria-busy', 'true'); }
        try {
            if (document.fonts) await document.fonts.ready;
            const exported = await exportMermaidWrapperImage(wrapper, 'png');
            const link = document.createElement('a');
            link.href = exported.dataUrl;
            link.download = 'mermaid-diagram-' + Date.now() + '.png';
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Mermaid PNG download failed:', error);
            if (typeof global.showToast === 'function') global.showToast('PNG 다운로드 실패: ' + (error.message || error));
        } finally {
            if (downloadButton) { downloadButton.disabled = false; downloadButton.removeAttribute('aria-busy'); }
        }
    }

    let appearancePanelSequence = 0;
    function addFixedMermaidControls(node) {
        const wrapper = node && node.closest ? node.closest('.trt-mermaid-wrapper') : null;
        if (!wrapper || wrapper.getAttribute('data-mermaid-mode') !== 'fixed') return;
        if (!wrapper.__mdvFixedMermaidControlsReady) {
            wrapper.__mdvFixedMermaidControlsReady = true;
            const controls = document.createElement('div');
            controls.className = 'trt-mermaid-fixed-controls';

            function button(label, title, action, extraClass) {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = 'trt-mermaid-btn' + (extraClass ? (' ' + extraClass) : '');
                element.textContent = label;
                element.title = title;
                element.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    action(element);
                });
                return element;
            }

            controls.appendChild(button('−', '고정형 다이어그램 축소', function () {
                const state = getFixedMermaidSizeState(wrapper);
                applyFixedMermaidSize(wrapper, state.factor - 0.1);
            }));
            const scale = document.createElement('span');
            scale.className = 'trt-mermaid-fixed-scale';
            scale.textContent = '100%';
            controls.appendChild(scale);
            controls.appendChild(button('+', '고정형 다이어그램 확대', function () {
                const state = getFixedMermaidSizeState(wrapper);
                applyFixedMermaidSize(wrapper, state.factor + 0.1);
            }));
            const appearanceToggle = button('✎', '도표 스타일 조절', function () {
                if (global.MermaidAppearancePanel) global.MermaidAppearancePanel.setOpen(appearanceControls, appearanceToggle, appearanceControls.hidden);
                else { appearanceControls.hidden = !appearanceControls.hidden; appearanceToggle.setAttribute('aria-expanded', String(!appearanceControls.hidden)); }
            }, 'trt-mermaid-appearance-toggle');
            appearanceToggle.setAttribute('aria-label', '도표 스타일 조절');
            appearanceToggle.setAttribute('aria-expanded', 'false');
            controls.appendChild(appearanceToggle);
            controls.appendChild(button('맞춤', '문서 너비에 맞는 기본 크기', function () {
                applyFixedMermaidSize(wrapper, 1);
            }, 'trt-mermaid-fixed-fit'));
            controls.appendChild(button('SVG', '현재 보이는 Mermaid를 SVG 이미지 삽입창으로 보내기', function () {
                openMermaidWrapperInImageInsert(wrapper, 'svg');
            }, 'trt-mermaid-fixed-export'));
            controls.appendChild(button('PNG', '현재 보이는 Mermaid를 PNG 이미지 삽입창으로 보내기', function () {
                openMermaidWrapperInImageInsert(wrapper, 'png');
            }, 'trt-mermaid-fixed-export'));
            controls.appendChild(button('DN', 'Mermaid를 PNG 파일로 PC에 다운로드', function (downloadButton) {
                downloadMermaidWrapperPng(wrapper, downloadButton);
            }, 'trt-mermaid-fixed-download'));
            controls.appendChild(button('', '', function () {
                toggleMermaidTheme(wrapper).catch(function (error) { console.error('Mermaid theme change failed:', error); });
            }, 'trt-mermaid-theme-toggle'));
            const appearanceControls = document.createElement('section');
            appearanceControls.className = 'trt-mermaid-appearance trt-mermaid-appearance-panel';
            appearanceControls.hidden = true;
            appearanceControls.id = 'trt-mermaid-appearance-' + (++appearancePanelSequence);
            appearanceToggle.setAttribute('aria-controls', appearanceControls.id);
            appearanceControls.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') { event.stopPropagation(); if (global.MermaidAppearancePanel) global.MermaidAppearancePanel.setOpen(appearanceControls, appearanceToggle, false); else { appearanceControls.hidden = true; appearanceToggle.setAttribute('aria-expanded', 'false'); } appearanceToggle.focus(); }
            });
            let customTools, custom2Tools;
            const status = document.createElement('span');
            status.setAttribute('role', 'status');
            function change(patch) {
                const next = Object.assign({}, wrapper.__mdvMermaidAppearance || {}, patch);
                appearanceControls.querySelectorAll('button,input,select').forEach(el => { el.disabled = true; });
                status.textContent = '적용 중…';
                return setWrapperMermaidTheme(wrapper, getMermaidTheme(wrapper), next).then(function () {
                    update(); customTools?.refresh(); status.textContent = '';
                }).catch(function (error) { status.textContent = '적용 실패: ' + error.message; }).finally(function () {
                    appearanceControls.querySelectorAll('button,input,select').forEach(el => { el.disabled = false; });
                    custom2Tools?.refresh();
                });
            }
            const values = {}, fields = {}, directionButtons = [];
            function category(title) {
                const group = document.createElement('fieldset'); group.className = 'trt-mermaid-category';
                const legend = document.createElement('legend'); legend.textContent = title; group.append(legend); appearanceControls.append(group); return group;
            }
            const textGroup = category('글자'), edgeGroup = category('연결선·화살표'), nodeGroup = category('도형'), layoutGroup = category('배치');
            function pair(host, key, label, initial, step, min, max, unit) {
                [min,max] = global.MermaidAppearanceSource?.ranges[key] || [min,max];
                let boost = 1;
                const group = document.createElement('span'); group.className = 'trt-mermaid-appearance';
                group.addEventListener('click', e => { boost = e.shiftKey ? 10 : 1; }, true);
                group.appendChild(document.createTextNode(label));
                group.appendChild(button('−', label + ' 줄이기', () => change({ [key]: Math.max(min, +(((wrapper.__mdvMermaidAppearance || {})[key] ?? initial) - step * boost).toFixed(2)) })));
                const value = document.createElement('input'); value.type='number';value.min=min;value.max=max;value.step='any';value.style.width='80px';value.setAttribute('aria-label',label+' 값');value.title=label+' ('+unit+') · '+min+'~'+max+' · Shift+클릭 10배 증감';value.onchange=()=>{if(value.value!==''&&value.checkValidity())change({[key]:Number(value.value)});else update();};values[key] = { value, initial, unit }; group.style.gridTemplateColumns='minmax(0,1fr) 34px 80px 34px';group.appendChild(value);
                group.appendChild(button('+', label + ' 늘리기', () => change({ [key]: Math.min(max, +(((wrapper.__mdvMermaidAppearance || {})[key] ?? initial) + step * boost).toFixed(2)) })));
                host.append(group);
            }
            function colorField(host, key, title, fallback) {
                const label = document.createElement('label'); label.textContent = title;
                const input = document.createElement('input'); input.type = 'color'; input.title = title; input.setAttribute('aria-label', title);
                fields[key] = { input, fallback }; input.value = (wrapper.__mdvMermaidAppearance || {})[key] || fallback;
                input.addEventListener('change', () => change({ [key]: input.value })); label.append(input); host.append(label); return input;
            }
            function update() {
                const a = wrapper.__mdvMermaidAppearance || {};
                Object.keys(values).forEach(key => { const v = values[key]; v.value.value = a[key] ?? v.initial; });
                bold.setAttribute('aria-pressed', String(a.fontWeight === 700));
                directionButtons.forEach(({ element, value }) => element.setAttribute('aria-pressed', String((a.direction || '') === value)));
                Object.keys(fields).forEach(key => { fields[key].input.value = a[key] ?? fields[key].fallback; });
            }
            const diagramType = global.MermaidAppearanceTypes?.type(wrapper.getAttribute('data-mermaid-original-source')) || 'flowchart';
            if (!['flowchart', 'graph'].includes(diagramType)) {
                const special = category('도표별 조절 · ' + diagramType);
                appearanceControls.insertBefore(special, textGroup);
                const note = document.createElement('p'); note.textContent = '도형·선 스타일은 도표 전체에 적용됩니다. TD/LR·연결선 길이·화살촉은 flowchart용입니다.'; special.append(note);
                if (['quadrantchart','journey','gitgraph'].includes(diagramType)) pair(special, 'pointSize', '점 크기', 5, 1, 1, 30, 'px');
                if (diagramType === 'quadrantchart' || diagramType.startsWith('xychart')) {
                    pair(special, 'chartWidth', '차트 너비', 1, .1, .5, 3, '배');
                    pair(special, 'chartHeight', '차트 높이', 1, .1, .5, 3, '배');
                }
                if (['mindmap','kanban','journey','timeline','sequencediagram'].includes(diagramType)) pair(special, 'layoutSpacing', diagramType === 'kanban' ? '열 배치 배율' : diagramType === 'timeline' ? '도표 여백' : '배치 간격', 1, .25, .5, 5, '배');
            }
            pair(textGroup, 'font', '글자', 15, 1, 8, 48, 'px');
            const bold = button('B', '글자 볼드', () => change({ fontWeight: (wrapper.__mdvMermaidAppearance || {}).fontWeight === 700 ? 400 : 700 }), 'trt-mermaid-font-bold');
            bold.setAttribute('aria-label', '글자 볼드'); bold.style.fontWeight = '700'; textGroup.append(bold);
            const fontLabel = document.createElement('label'); fontLabel.textContent = '폰트 ';
            const family = document.createElement('select'); family.setAttribute('aria-label', '글자 폰트'); family.add(new Option('원본 폰트', ''));
            (global.MermaidAppearanceSource?.fontFamilies || ['sans-serif', 'serif', 'monospace']).forEach(name => family.add(new Option(name, name)));
            fields.fontFamily = { input: family, fallback: '' }; family.onchange = () => change({ fontFamily: family.value || null }); fontLabel.append(family); textGroup.append(fontLabel);
            colorField(textGroup, 'textColor', '글자 색상', '#172033');
            pair(edgeGroup, 'stroke', '선 두께', 2, .5, .5, 10, 'px');
            pair(edgeGroup, 'edgeLength', '연결선 길이', 1, .25, .5, 5, '배');
            pair(edgeGroup, 'arrowSize', '화살표 머리 크기', 1, .25, .25, 3, '배');
            const color = colorField(edgeGroup, 'color', '연결선 색상', '#64748b');
            pair(nodeGroup, 'nodeStroke', '도형 테두리 두께', 1, .5, .5, 10, 'px');
            const nodeColor = colorField(nodeGroup, 'nodeColor', '도형 테두리 색상', '#64748b');
            colorField(nodeGroup, 'fill', '도형 배경색', '#ffffff');
            pair(nodeGroup, 'alpha', '배경 알파', 1, .1, 0, 1, '');
            const alphaLabel = document.createElement('label'); alphaLabel.textContent = '배경 알파'; alphaLabel.title = '0=투명, 1=불투명';
            const alpha = document.createElement('input'); alpha.type = 'number'; alpha.min = 0; alpha.max = 1; alpha.step = .05; alpha.setAttribute('aria-label', '배경 알파');
            fields.alpha = { input: alpha, fallback: 1 }; alpha.addEventListener('change', () => { if (alpha.checkValidity() && alpha.value !== '') change({ alpha: Number(alpha.value) }); else update(); }); alphaLabel.append(alpha); nodeGroup.append(alphaLabel);
            pair(layoutGroup, 'width', '박스 너비', 1, .1, .3, 3, '배');
            const directionGroup = document.createElement('div');
            directionGroup.className = 'trt-mermaid-direction';
            directionGroup.setAttribute('role', 'group'); directionGroup.setAttribute('aria-label', '그래프 방향');
            directionGroup.append(document.createTextNode('방향'));
            [['', '원본 방향'], ['TD', 'TD · 위에서 아래'], ['LR', 'LR · 왼쪽에서 오른쪽']].forEach(([value, title]) => {
                const element = button(title, title, () => change({ direction: value || null }));
                directionButtons.push({ element, value }); directionGroup.append(element);
            });
            layoutGroup.append(directionGroup);
            const actions = category('적용과 기록');
            actions.appendChild(button('초기화', '도표 스타일을 원래대로 복원', () => {
                color.value = '#64748b'; nodeColor.value = '#64748b';
                change({ custom: null, custom2: null, pointSize: null, chartWidth: null, chartHeight: null, layoutSpacing: null, font: null, stroke: null, arrowSize: null, edgeLength: null, width: null, color: null, nodeStroke: null, nodeColor: null, fill: null, alpha: null, textColor: null, direction: null, fontFamily: null, fontWeight: null });
            }, 'trt-mermaid-fixed-fit'));
            actions.appendChild(button('코드에 적용', '조절한 스타일을 Mermaid 원본 코드에 적용하고 이전 코드를 inDB에 저장', async function (applyButton) {
                applyButton.disabled = true;
                try {
                    if (!global.MermaidAppearanceSource) throw new Error('코드 적용 모듈이 준비되지 않았습니다. 새로고침하세요.');
                    await global.MermaidAppearanceSource.apply(wrapper);
                } catch (error) { status.textContent = '코드 적용 실패: ' + error.message; }
                finally { applyButton.disabled = false; }
            }, 'trt-mermaid-fixed-fit'));
            actions.appendChild(button('변경 기록', 'inDB의 이전 Mermaid 코드 보기 및 복원', function () {
                if (global.MermaidAppearanceSource) global.MermaidAppearanceSource.showHistory(wrapper, appearanceControls);
                else status.textContent = '기록 모듈이 준비되지 않았습니다.';
            }, 'trt-mermaid-fixed-fit'));
            if (global.MermaidAppearanceCustom) customTools = global.MermaidAppearanceCustom.attach(wrapper, appearanceControls, change);
            if (global.MermaidAppearanceCustom2) custom2Tools = global.MermaidAppearanceCustom2.attach(wrapper, appearanceControls, change);
            appearanceControls.appendChild(status); controls.appendChild(appearanceControls); update();
            if (global.MermaidAppearancePanel) global.MermaidAppearancePanel.attach(wrapper, appearanceControls, appearanceToggle);
            wrapper.insertBefore(controls, wrapper.firstChild);
            if (wrapper.__mdvMermaidAppearance) setWrapperMermaidTheme(wrapper, getMermaidTheme(wrapper)).catch(error => { status.textContent = error.message; });
            updateMermaidThemeButtons(wrapper);
        }
        bindFixedMermaidResize(wrapper);
        setTimeout(function () { applyFixedMermaidSize(wrapper); }, 0);
    }

    function copyMermaidSource(wrapper) {
        const source = String(wrapper && wrapper.getAttribute ? wrapper.getAttribute('data-mermaid-source') : '');
        if (!source) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(source).catch(function () {});
        }
    }

    function bindMermaidPan(wrapper) {
        const viewport = wrapper && wrapper.querySelector ? wrapper.querySelector('.trt-mermaid-viewport') : null;
        if (!viewport || viewport.__mdvMermaidPanBound) return;
        viewport.__mdvMermaidPanBound = true;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        viewport.addEventListener('pointerdown', function (ev) {
            if (ev.target && ev.target.closest && ev.target.closest('.trt-mermaid-btn')) return;
            dragging = true;
            lastX = ev.clientX;
            lastY = ev.clientY;
            viewport.classList.add('dragging');
            try { viewport.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        viewport.addEventListener('pointermove', function (ev) {
            if (!dragging) return;
            const dx = ev.clientX - lastX;
            const dy = ev.clientY - lastY;
            lastX = ev.clientX;
            lastY = ev.clientY;
            adjustMermaidView(wrapper, dx, dy, 0);
        });
        function stop(ev) {
            dragging = false;
            viewport.classList.remove('dragging');
            try { viewport.releasePointerCapture(ev.pointerId); } catch (e) {}
        }
        viewport.addEventListener('pointerup', stop);
        viewport.addEventListener('pointercancel', stop);
        viewport.addEventListener('wheel', function (ev) {
            ev.preventDefault();
            adjustMermaidView(wrapper, 0, 0, ev.deltaY < 0 ? 0.1 : -0.1);
        }, { passive: false });
    }

    function bindMermaidResize(wrapper) {
        if (!wrapper || wrapper.__mdvMermaidResizeBound) return;
        wrapper.__mdvMermaidResizeBound = true;

        const handleW = wrapper.querySelector('.trt-mermaid-resize-w');
        const handleE = wrapper.querySelector('.trt-mermaid-resize-e');
        const handleS = wrapper.querySelector('.trt-mermaid-resize-s');
        const handleSW = wrapper.querySelector('.trt-mermaid-resize-sw');
        const handleSE = wrapper.querySelector('.trt-mermaid-resize-se');

        let startX, startY, startWidth, startHeight, startMarginLeft;
        let activeHandle = null;

        function onPointerDown(ev) {
            if (ev.target.classList.contains('trt-mermaid-resize-w')) activeHandle = 'w';
            else if (ev.target.classList.contains('trt-mermaid-resize-e')) activeHandle = 'e';
            else if (ev.target.classList.contains('trt-mermaid-resize-s')) activeHandle = 's';
            else if (ev.target.classList.contains('trt-mermaid-resize-sw')) activeHandle = 'sw';
            else if (ev.target.classList.contains('trt-mermaid-resize-se')) activeHandle = 'se';
            else return;

            ev.preventDefault();
            ev.stopPropagation();

            startX = ev.clientX;
            startY = ev.clientY;
            const rect = wrapper.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startMarginLeft = Number.parseFloat(getComputedStyle(wrapper).marginLeft) || 0;

            document.documentElement.addEventListener('pointermove', onPointerMove);
            document.documentElement.addEventListener('pointerup', onPointerUp, { once: true });

            document.body.style.userSelect = 'none';

            try {
                ev.target.setPointerCapture(ev.pointerId);
            } catch(e) {}
        }

        function onPointerMove(ev) {
            if (!activeHandle) return;

            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;

            if (activeHandle === 'w' || activeHandle === 'sw') {
                let newWidth = Math.max(180, startWidth - dx);
                let newMarginLeft = startMarginLeft + (startWidth - newWidth);
                if (newMarginLeft < 0) {
                    newWidth = startWidth + startMarginLeft;
                    newMarginLeft = 0;
                }
                wrapper.style.width = newWidth + 'px';
                wrapper.style.marginLeft = newMarginLeft + 'px';
            }
            if (activeHandle === 'e' || activeHandle === 'se') {
                const newWidth = Math.max(180, startWidth + dx);
                wrapper.style.width = newWidth + 'px';
            }
            if (activeHandle === 's' || activeHandle === 'sw' || activeHandle === 'se') {
                const newHeight = Math.max(140, startHeight + dy);
                wrapper.style.height = newHeight + 'px';
            }
        }

        function onPointerUp(ev) {
            if(ev.target.releasePointerCapture) {
                try { ev.target.releasePointerCapture(ev.pointerId); } catch(e) {}
            }
            document.documentElement.removeEventListener('pointermove', onPointerMove);
            document.body.style.userSelect = '';
            activeHandle = null;
        }

        [handleW, handleE, handleS, handleSW, handleSE].forEach(function (handle) {
            if (handle) handle.addEventListener('pointerdown', onPointerDown);
        });
    }

    function addMermaidControls(node) {
        const wrapper = node && node.closest ? node.closest('.trt-mermaid-wrapper') : null;
        if (!wrapper || wrapper.__mdvMermaidControlsReady) return;
        if (wrapper.getAttribute('data-mermaid-mode') === 'fixed') return;
        wrapper.__mdvMermaidControlsReady = true;
        wrapper.setAttribute('data-mermaid-controls', 'ready');
        const top = document.createElement('div');
        top.className = 'trt-mermaid-control-top';
        const pad = document.createElement('div');
        pad.className = 'trt-mermaid-control-pad';

        function btn(label, title, action, extraClass) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'trt-mermaid-btn' + (extraClass ? (' ' + extraClass) : '');
            b.textContent = label;
            b.title = title;
            b.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                action();
            });
            return b;
        }

        top.appendChild(btn('<>', '가로 맞춤', function () { fitMermaidView(wrapper); }));
        top.appendChild(btn('', '', function () {
            toggleMermaidTheme(wrapper).catch(function (error) { console.warn(error); });
        }, 'trt-mermaid-theme-toggle'));
        top.appendChild(btn('[]', 'Mermaid 코드 복사', function () { copyMermaidSource(wrapper); }));
        pad.appendChild(document.createElement('span')).className = 'trt-mermaid-pad-spacer';
        pad.appendChild(btn('^', '위로 이동', function () { adjustMermaidView(wrapper, 0, -28, 0); }));
        pad.appendChild(btn('+', '확대', function () { adjustMermaidView(wrapper, 0, 0, 0.1); }));
        pad.appendChild(btn('<', '왼쪽 이동', function () { adjustMermaidView(wrapper, -28, 0, 0); }));
        pad.appendChild(btn('R', '위치 초기화', function () { resetMermaidView(wrapper); }));
        pad.appendChild(btn('>', '오른쪽 이동', function () { adjustMermaidView(wrapper, 28, 0, 0); }));
        pad.appendChild(document.createElement('span')).className = 'trt-mermaid-pad-spacer';
        pad.appendChild(btn('v', '아래로 이동', function () { adjustMermaidView(wrapper, 0, 28, 0); }));
        pad.appendChild(btn('-', '축소', function () { adjustMermaidView(wrapper, 0, 0, -0.1); }));

        const toggle = btn('접기', 'Mermaid 조작기 접기', function () {
            const collapsed = wrapper.classList.toggle('trt-mermaid-controls-collapsed');
            toggle.textContent = collapsed ? '펼치기' : '접기';
            toggle.title = collapsed ? 'Mermaid 조작기 펼치기' : 'Mermaid 조작기 접기';
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }, 'trt-mermaid-controls-toggle');
        toggle.setAttribute('aria-expanded', 'true');
        wrapper.appendChild(top);
        wrapper.appendChild(pad);
        wrapper.appendChild(toggle);
        updateMermaidThemeButtons(wrapper);

        const resizeW = document.createElement('div');
        resizeW.className = 'trt-mermaid-resize-handle trt-mermaid-resize-w';
        resizeW.title = '왼쪽 너비 조절';
        wrapper.appendChild(resizeW);

        const resizeE = document.createElement('div');
        resizeE.className = 'trt-mermaid-resize-handle trt-mermaid-resize-e';
        resizeE.title = '오른쪽 너비 조절';
        wrapper.appendChild(resizeE);

        const resizeS = document.createElement('div');
        resizeS.className = 'trt-mermaid-resize-handle trt-mermaid-resize-s';
        resizeS.title = '아래 높이 조절';
        wrapper.appendChild(resizeS);

        const resizeSW = document.createElement('div');
        resizeSW.className = 'trt-mermaid-resize-handle trt-mermaid-resize-sw';
        resizeSW.title = '왼쪽 아래 크기 조절';
        wrapper.appendChild(resizeSW);

        const resizeSE = document.createElement('div');
        resizeSE.className = 'trt-mermaid-resize-handle trt-mermaid-resize-se';
        resizeSE.title = '오른쪽 아래 크기 조절';
        wrapper.appendChild(resizeSE);

        bindMermaidPan(wrapper);
        bindMermaidResize(wrapper);
        setTimeout(function () { fitMermaidView(wrapper); }, 0);
    }

    function upgradeExistingMermaidWrapper(wrapper) {
        if (!wrapper || !wrapper.querySelector || !wrapper.querySelector('svg')) return null;
        injectMermaidControlsStyle(document);
        wrapper.setAttribute('data-mermaid-mode', getMermaidDisplayMode());
        wrapper.setAttribute('data-mermaid-theme', getMermaidTheme(wrapper));
        let viewport = wrapper.querySelector('.trt-mermaid-viewport');
        let canvas = wrapper.querySelector('.trt-mermaid-canvas');
        if (!viewport) {
            viewport = document.createElement('div');
            viewport.className = 'trt-mermaid-viewport';
            const mermaidBlock = wrapper.querySelector('.mermaid');
            if (mermaidBlock) {
                mermaidBlock.classList.add('trt-mermaid-canvas');
                wrapper.insertBefore(viewport, mermaidBlock);
                viewport.appendChild(mermaidBlock);
                canvas = mermaidBlock;
            } else {
                canvas = document.createElement('div');
                canvas.className = 'trt-mermaid-canvas';
                while (wrapper.firstChild) canvas.appendChild(wrapper.firstChild);
                viewport.appendChild(canvas);
                wrapper.appendChild(viewport);
            }
        } else if (!canvas) {
            const mermaidBlock = viewport.querySelector('.mermaid') || viewport.firstElementChild;
            if (mermaidBlock) {
                mermaidBlock.classList.add('trt-mermaid-canvas');
                canvas = mermaidBlock;
            }
        }
        const node = canvas || wrapper.querySelector('.mermaid') || wrapper;
        if (wrapper.getAttribute('data-mermaid-mode') === 'fixed') addFixedMermaidControls(node);
        else addMermaidControls(node);
        return node;
    }

    function enhanceExistingMermaidWrappers(root) {
        const target = root || document;
        const wrappers = target.querySelectorAll ? target.querySelectorAll('.trt-mermaid-wrapper') : [];
        for (let i = 0; i < wrappers.length; i++) {
            upgradeExistingMermaidWrapper(wrappers[i]);
        }
    }

    // Coalesce calls for the same DOM root so observers and explicit export
    // preparation await an in-flight render before inspecting its wrappers.
    const pendingMermaidRenders = new WeakMap();
    function renderIn(root, options) {
        const target = root || document;
        const previous = pendingMermaidRenders.get(target) || Promise.resolve();
        const task = previous.catch(function () {}).then(function () {
            return enqueueMermaidWork(function () { return renderMermaidIn(target, options); });
        });
        pendingMermaidRenders.set(target, task);
        return task.finally(function () {
            if (pendingMermaidRenders.get(target) === task) pendingMermaidRenders.delete(target);
        });
    }

    async function renderMermaidIn(root, options) {
        const target = root || document;
        const codeNodes = target.querySelectorAll ? target.querySelectorAll(CODE_SELECTOR) : [];
        const mermaidNodes = [];
        const cachedNodes = [];

        for (let i = 0; i < codeNodes.length; i++) {
            const node = buildMermaidNodeFromCode(codeNodes[i], options);
            if (!node) continue;
            if (node.getAttribute('data-mermaid-cache-hit') === '1') cachedNodes.push(node);
            else mermaidNodes.push(node);
        }

        if (!mermaidNodes.length) {
            enhanceExistingMermaidWrappers(target);
            return { changed: cachedNodes.length > 0, cachedCount: cachedNodes.length };
        }
        await loadMermaid();
        await waitForMermaidFonts();
        let changedCount = 0;
        let errorCount = 0;
        let firstError = null;

        for (let i = 0; i < mermaidNodes.length; i++) {
            const n = mermaidNodes[i];
            try {
                const renderWrapper = n.closest('.trt-mermaid-wrapper');
                configureMermaid(getMermaidTheme(renderWrapper), renderWrapper?.__mdvMermaidAppearance, renderWrapper?.getAttribute('data-mermaid-original-source'));
                await global.mermaid.run({ nodes: [n] });
                restoreSankeyKoreanLabels(n);
                polishMermaidSvg(n);
                const wrapper = n && n.closest ? n.closest('.trt-mermaid-wrapper') : null;
                const renderedSource = wrapper
                    ? String(wrapper.getAttribute('data-mermaid-source') || '')
                    : '';
                if (renderedSource && n.innerHTML) writeMermaidSvgCache(renderedSource, n.innerHTML, getMermaidTheme(wrapper));
                if (wrapper && wrapper.getAttribute('data-mermaid-mode') === 'fixed') addFixedMermaidControls(n);
                else addMermaidControls(n);
                changedCount += 1;
            } catch (e) {
                errorCount += 1;
                if (!firstError) firstError = e;
                const parent = n && n.parentElement;
                if (!parent) continue;
                const src = String(parent.getAttribute('data-mermaid-source') || n.textContent || '');
                parent.innerHTML = '';
                const pre = document.createElement('pre');
                pre.className = 'trt-mermaid-error';
                pre.textContent = src;
                parent.appendChild(pre);
            }
        }

        enhanceExistingMermaidWrappers(target);

        return {
            changed: changedCount > 0,
            cachedCount: cachedNodes.length,
            partial: errorCount > 0 && changedCount > 0,
            error: firstError,
            errorCount: errorCount
        };
    }

    function restoreMermaidCodeBlocks(root) {
        const target = root || document;
        const wrappers = target.querySelectorAll ? Array.from(target.querySelectorAll('.trt-mermaid-wrapper')) : [];
        for (let i = 0; i < wrappers.length; i++) {
            const wrapper = wrappers[i];
            const source = String(
                wrapper.getAttribute('data-mermaid-original-source')
                || wrapper.getAttribute('data-mermaid-source')
                || ''
            ).trim();
            if (!source || !wrapper.parentNode) continue;
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.className = 'language-mermaid';
            code.textContent = source;
            pre.appendChild(code);
            pre.__mdvMermaidPresentation = {
                appearance: wrapper.__mdvMermaidAppearance,
                theme: wrapper.getAttribute('data-mermaid-theme-override'), style: wrapper.style.cssText,
                fixed: wrapper.__mdvFixedMermaidSizeState && Object.assign({}, wrapper.__mdvFixedMermaidSizeState),
                pan: wrapper.__mdvMermaidPanState && Object.assign({}, wrapper.__mdvMermaidPanState)
            };
            wrapper.replaceWith(pre);
        }
        return wrappers.length;
    }

    async function refresh(root) {
        const target = root || document;
        return enqueueMermaidWork(function () {
            restoreMermaidCodeBlocks(target);
            return renderMermaidIn(target);
        });
    }

    function setDisplayMode(mode) {
        const nextMode = mode === 'fixed' ? 'fixed' : 'interactive';
        try { localStorage.setItem(MERMAID_DISPLAY_MODE_KEY, nextMode); } catch (e) {}
        return refresh(document);
    }

    function debounce(fn, wait) {
        let timer = null;
        return function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(fn, wait);
        };
    }


    function observeViewer() {
        const viewer = document.getElementById('viewer');
        if (!viewer || viewer.__trtMermaidObserved) return;
        viewer.__trtMermaidObserved = true;

        const run = debounce(function () {
            if (!viewer.hasAttribute('data-mermaid-export-preparing')) renderIn(viewer).catch(function () {});
        }, 80);

        const observer = new MutationObserver(function () {
            run();
        });
        observer.observe(viewer, { childList: true, subtree: true });
        run();
    }

    function init() {
        observeViewer();
        const retry = setInterval(function () {
            observeViewer();
            const viewer = document.getElementById('viewer');
            if (viewer && viewer.__trtMermaidObserved) clearInterval(retry);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    global.MermaidTRT = {
        renderIn: renderIn,
        loadMermaid: loadMermaid,
        validateSource: function (source) { return enqueueMermaidWork(async function () { await loadMermaid(); return global.mermaid.parse(preprocessMermaidSource(source).source); }); },
        refresh: refresh,
        setDisplayMode: setDisplayMode,
        getDisplayMode: getMermaidDisplayMode,
        setBlockTheme: setWrapperMermaidTheme,
        getTheme: getMermaidTheme,
        setTheme: setMermaidTheme,
        toggleTheme: toggleMermaidTheme,
        exportWrapperImage: exportMermaidWrapperImage,
        openWrapperInImageInsert: openMermaidWrapperInImageInsert,
        getCacheStats: function () {
            return Object.assign({}, mermaidCacheStats, { size: mermaidSvgCache.size });
        },
        clearCache: function () { mermaidSvgCache.clear(); }
    };
})(window);

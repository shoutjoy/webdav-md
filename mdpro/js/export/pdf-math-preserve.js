(function (global) {
  'use strict';

  var scriptUrl = global.document && global.document.currentScript && global.document.currentScript.src;
  var rendererPromise = null;
  var MATH_SELECTOR = 'mjx-container,.katex-display,.katex,math,[data-pdf-math-source]';

  function mathSource(node) {
    var math = node.matches('math') ? node : node.querySelector('math');
    var annotation = node.querySelector('annotation[encoding="application/x-tex"]');
    var display = node.getAttribute('display') === 'true' || node.getAttribute('display') === 'block' ||
      node.classList.contains('katex-display') || node.getAttribute('data-pdf-math-display') === 'true';
    if (math) {
      if (math.querySelector('merror')) throw new Error('원본 수식에 오류가 있어 PDF 저장을 중단했습니다.');
      var copy = math.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
      return { kind: 'mathml', source: copy.outerHTML, display: display || math.getAttribute('display') === 'block',
        label: annotation ? annotation.textContent : (node.getAttribute('data-pdf-math-source') || math.textContent) };
    }
    var tex = node.getAttribute('data-pdf-math-source') || (annotation && annotation.textContent);
    if (tex) return { kind: 'tex', source: tex, display: display, label: tex };
    // Existing path-based SVG output can be preserved without a second typeset.
    var svg = node.querySelector('svg');
    if (svg) {
      var ids = new Set(Array.from(svg.querySelectorAll('[id]'), function (child) { return child.id; }));
      var missingGlyph = Array.from(svg.querySelectorAll('use')).some(function (use) {
        var ref = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
        return ref.charAt(0) !== '#' || !ids.has(ref.slice(1));
      });
      if (missingGlyph) throw new Error('PDF 수식의 공유 글리프를 찾지 못했습니다. 문서를 다시 렌더링한 뒤 내보내세요.');
      return { kind: 'svg', source: svg.outerHTML, display: display, label: node.textContent || '수식' };
    }
    throw new Error('PDF 수식 원본을 찾지 못했습니다. 문서를 다시 렌더링한 뒤 내보내세요.');
  }

  function svgLength(value, fontSize) {
    var number = parseFloat(value);
    if (!Number.isFinite(number)) throw new Error('PDF 수식 크기를 확인하지 못했습니다.');
    if (/ex$/i.test(value)) return number * fontSize * 0.5;
    if (/em$/i.test(value)) return number * fontSize;
    return number;
  }

  function getRenderer() {
    if (rendererPromise) return rendererPromise;
    rendererPromise = new Promise(function (resolve, reject) {
      var frame = global.document.createElement('iframe');
      frame.hidden = true;
      frame.setAttribute('aria-hidden', 'true');
      frame.title = 'PDF 수식 변환 엔진';
      global.document.body.appendChild(frame);
      var win = frame.contentWindow;
      win.MathJax = {
        startup: { typeset: false }, svg: { fontCache: 'none' }, options: { enableMenu: false },
        tex: { packages: ['base', 'ams', 'newcommand', 'configmacros'] }
      };
      var script = frame.contentDocument.createElement('script');
      script.src = new URL('../../vendor/mathjax/tex-mml-svg.min.js', scriptUrl).href;
      var timer = global.setTimeout(function () { fail(new Error('PDF 수식 변환 엔진 로딩 시간이 초과되었습니다.')); }, 20000);
      function fail(error) {
        global.clearTimeout(timer);
        frame.remove();
        rendererPromise = null;
        reject(error);
      }
      script.onerror = function () { fail(new Error('PDF 수식 변환 엔진을 불러오지 못했습니다.')); };
      script.onload = function () {
        if (!win.MathJax || !win.MathJax.startup) return fail(new Error('PDF 수식 변환 엔진을 초기화하지 못했습니다.'));
        win.MathJax.startup.promise.then(function () { global.clearTimeout(timer); resolve(win.MathJax); }, fail);
      };
      frame.contentDocument.head.appendChild(script);
    });
    return rendererPromise;
  }

  async function makeMathImage(spec, fontSize, renderer) {
    var options = { display: spec.display, em: fontSize, ex: fontSize * 0.5, containerWidth: 680 };
    var converted = spec.kind === 'svg' ? null : await renderer[spec.kind === 'mathml' ? 'mathml2svgPromise' : 'tex2svgPromise'](spec.source, options);
    var svg = converted ? converted.querySelector('svg') : new global.DOMParser().parseFromString(spec.source, 'image/svg+xml').documentElement;
    if (!svg || svg.querySelector('[data-mml-node="merror"],mjx-merror')) throw new Error('PDF 수식을 안전하게 변환하지 못했습니다: ' + spec.label);
    var width = svgLength(svg.getAttribute('width'), fontSize);
    var height = svgLength(svg.getAttribute('height'), fontSize);
    var align = svg.style.verticalAlign || '0ex';
    // All glyph paths are embedded by fontCache:none: no webfont or shared defs dependency.
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.color = '#1e293b';
    var image = global.document.createElement('img');
    image.setAttribute('data-pdf-math-image', 'true');
    image.alt = spec.label || '수식';
    image.width = Math.ceil(width);
    image.height = Math.ceil(height);
    // Constrain the whole SVG, including wide fractions, to its final page/list
    // container. Auto height keeps every glyph in proportion when it shrinks.
    image.style.cssText = 'display:inline-block!important;width:' + (width / fontSize) + 'em;height:auto!important;max-width:100%!important;min-width:0!important;object-fit:contain!important;margin:0!important;vertical-align:' + align + ';';
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
    // Do not paginate or save a PDF with missing formula pixels.
    await image.decode();
    var wrapper = global.document.createElement('span');
    wrapper.className = spec.display ? 'pdf-math-preserved pdf-math-display' : 'pdf-math-preserved pdf-math-inline';
    if (spec.display) wrapper.style.cssText = 'display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important;text-align:center;';
    wrapper.setAttribute('data-pdf-math-source', spec.label || spec.source);
    wrapper.appendChild(image);
    return wrapper;
  }

  async function prepare(root) {
    var nodes = Array.prototype.filter.call(root.querySelectorAll(MATH_SELECTOR), function (node) {
      return !node.closest('.pdf-math-preserved') && !(node.parentElement && node.parentElement.closest(MATH_SELECTOR));
    });
    // Also preserve still-untypeset inline/display TeX, excluding code and existing formula trees.
    var raw = [];
    var walker = global.document.createTreeWalker(root, 4);
    var text;
    while ((text = walker.nextNode())) {
      if (text.parentElement.closest('pre,code,script,style,textarea,' + MATH_SELECTOR + ',.pdf-math-preserved')) continue;
      var pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([^\n]+?)\\\)|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
      var matches = Array.from(text.nodeValue.matchAll(pattern));
      if (matches.length) raw.push({ node: text, matches: matches });
    }
    if (!nodes.length && !raw.length) return 0;
    var renderer = await getRenderer();
    var count = 0;
    for (var node of nodes) {
      var size = parseFloat(global.getComputedStyle(node).fontSize) || 16;
      var image = await makeMathImage(mathSource(node), size, renderer);
      node.replaceWith(image);
      count += 1;
    }
    for (var entry of raw) {
      var fragment = global.document.createDocumentFragment();
      var cursor = 0;
      var fontSize = parseFloat(global.getComputedStyle(entry.node.parentElement).fontSize) || 16;
      for (var match of entry.matches) {
        fragment.appendChild(global.document.createTextNode(entry.node.nodeValue.slice(cursor, match.index)));
        fragment.appendChild(await makeMathImage({ kind: 'tex', source: match[1] || match[2] || match[3] || match[4], display: !!(match[1] || match[2]), label: match[0] }, fontSize, renderer));
        cursor = match.index + match[0].length;
        count += 1;
      }
      fragment.appendChild(global.document.createTextNode(entry.node.nodeValue.slice(cursor)));
      entry.node.replaceWith(fragment);
    }
    return count;
  }

  global.PdfMathPreserve = Object.freeze({ prepare: prepare, __test: { mathSource: mathSource, svgLength: svgLength } });
})(typeof window !== 'undefined' ? window : globalThis);

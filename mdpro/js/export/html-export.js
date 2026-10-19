(function (global) {
  'use strict';

  var MAX_IMAGE_BYTES = 30 * 1024 * 1024;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeFileBase(value) {
    var name = String(value || 'document')
      .replace(/^.*[\\/]/, '')
      .replace(/\.(?:md|markdown|mdown|txt|html?|json|mdd|mpv|docx)$/i, '')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .trim();
    return name || 'document';
  }

  function resolveUrl(value, baseUrl) {
    var source = String(value || '').trim();
    if (!source || /^(?:data:|blob:|internal:|#)/i.test(source)) return source;
    try {
      return new URL(source, baseUrl || (global.document && global.document.baseURI) || undefined).href;
    } catch (_) {
      return source;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('Image encoding failed.')); };
      reader.readAsDataURL(blob);
    });
  }

  function normalizeResolvedBlob(value) {
    if (!value) return null;
    var candidate = value.blob || value.data || value;
    if (typeof candidate === 'string' && /^data:/i.test(candidate)) return { dataUrl: candidate };
    if (typeof global.Blob === 'function' && candidate instanceof global.Blob) return { blob: candidate };
    if (candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
      return { blob: new Blob([candidate], { type: value.mime || value.type || 'application/octet-stream' }) };
    }
    return null;
  }

  async function fetchImageBlob(url) {
    if (typeof global.fetch !== 'function') return null;
    var response = await global.fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'force-cache'
    });
    if (!response.ok) throw new Error('Image download failed (HTTP ' + response.status + ').');
    var blob = await response.blob();
    if (!blob || !blob.size) throw new Error('Downloaded image is empty.');
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 30 MB.');
    return blob;
  }

  function makeLocalProxyUrl(url) {
    if (!/^https?:\/\//i.test(String(url || '')) || !global.location) return '';
    var hostname = String(global.location.hostname || '').toLowerCase();
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return '';
    try {
      var proxy = new URL('/__mdviewer_image_proxy', global.location.href);
      proxy.searchParams.set('url', url);
      return proxy.href;
    } catch (_) {
      return '';
    }
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas && typeof canvas.toBlob === 'function') {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Canvas capture failed.'));
        }, 'image/png');
        return;
      }
      try {
        var dataUrl = canvas.toDataURL('image/png');
        global.fetch(dataUrl).then(function (response) { return response.blob(); }).then(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function captureImageElement(image) {
    if (!image || !global.document) return null;
    var width = Number(image.naturalWidth || image.width || 0);
    var height = Number(image.naturalHeight || image.height || 0);
    if (!width || !height) return null;
    var scale = Math.min(1, 2400 / Math.max(width, height));
    var canvas = global.document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var context = canvas.getContext && canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas);
  }

  async function resolveImageDataUrl(source, originalImage, payload) {
    var src = String(source || '').trim();
    if (!src) return null;
    if (/^data:/i.test(src)) return src;

    if (typeof payload.resolveImage === 'function') {
      try {
        var custom = normalizeResolvedBlob(await payload.resolveImage(src));
        if (custom && custom.dataUrl) return custom.dataUrl;
        if (custom && custom.blob) return await blobToDataUrl(custom.blob);
      } catch (_) {}
    }

    var resolved = resolveUrl(src, payload.baseUrl);
    var candidates = [];
    if (originalImage) {
      var liveSource = originalImage.currentSrc || originalImage.src || originalImage.getAttribute('src') || '';
      if (liveSource) candidates.push(liveSource);
    }
    if (resolved && candidates.indexOf(resolved) < 0) candidates.push(resolved);

    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = candidates[index];
      if (!candidate || /^internal:/i.test(candidate)) continue;
      try {
        return await blobToDataUrl(await fetchImageBlob(candidate));
      } catch (_) {}
    }

    var proxyUrl = makeLocalProxyUrl(resolved);
    if (proxyUrl) {
      try {
        return await blobToDataUrl(await fetchImageBlob(proxyUrl));
      } catch (_) {}
    }

    if (originalImage) {
      try {
        var captured = await captureImageElement(originalImage);
        if (captured) return await blobToDataUrl(captured);
      } catch (_) {}
    }
    return null;
  }

  async function embedImages(root, liveRoot, payload) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return { embedded: 0, external: 0 };
    }
    var images = Array.prototype.slice.call(root.querySelectorAll('img'));
    var liveImages = liveRoot && typeof liveRoot.querySelectorAll === 'function'
      ? Array.prototype.slice.call(liveRoot.querySelectorAll('img'))
      : [];
    var results = await Promise.all(images.map(async function (image, index) {
      var source = image.getAttribute('src') ||
        image.getAttribute('data-src') ||
        image.getAttribute('data-original-src') || '';
      var dataUrl = await resolveImageDataUrl(source, liveImages[index] || null, payload);
      image.removeAttribute('srcset');
      image.removeAttribute('crossorigin');
      image.removeAttribute('loading');
      if (dataUrl) {
        image.setAttribute('src', dataUrl);
        image.removeAttribute('data-src');
        image.removeAttribute('data-original-src');
        return true;
      }
      var absolute = resolveUrl(source, payload.baseUrl);
      if (absolute) image.setAttribute('src', absolute);
      return false;
    }));

    Array.prototype.slice.call(root.querySelectorAll('source[srcset]')).forEach(function (source) {
      source.removeAttribute('srcset');
    });
    return {
      embedded: results.filter(Boolean).length,
      external: results.filter(function (result) { return !result; }).length
    };
  }

  function absolutizeCssUrls(css, stylesheetUrl) {
    return String(css || '').replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, function (match, quote, value) {
      var source = String(value || '').trim();
      if (!source || /^(?:data:|blob:|#)/i.test(source)) return match;
      return 'url("' + resolveUrl(source, stylesheetUrl).replace(/"/g, '%22') + '")';
    });
  }

  async function collectPageStyles() {
    if (!global.document) return '';
    // Promise.all keeps document order even when downloads finish out of order.
    var nodes = Array.prototype.slice.call(global.document.querySelectorAll('style,link[rel="stylesheet"]'));
    var chunks = await Promise.all(nodes.map(async function (link) {
      if (link.tagName.toLowerCase() === 'style') return link.outerHTML;
      var href = link.href || link.getAttribute('href') || '';
      if (!href) return '';
      try {
        var response = await global.fetch(href, { cache: 'force-cache' });
        if (!response.ok) throw new Error('Stylesheet download failed.');
        var css = absolutizeCssUrls(await response.text(), href);
        return '<style>\n/* ' + escapeHtml(href) + ' */\n' + css + '\n</style>';
      } catch (_) {
        return '<link rel="stylesheet" href="' + escapeHtml(resolveUrl(href, global.document.baseURI)) + '">';
      }
    }));
    return chunks.join('\n');
  }

  function exportDocumentStyles(isDark) {
    var background = isDark ? '#0f172a' : '#ffffff';
    var foreground = isDark ? '#f1f5f9' : '#1e293b';
    return '<style id="mdviewer-export-styles">' +
      'html,html body.mdviewer-export-body{background:' + background + '!important;color:' + foreground + '!important;color-scheme:' + (isDark ? 'dark' : 'light') + ';}' +
      'body.mdviewer-export-body{display:block!important;height:auto!important;min-height:100vh;margin:0!important;padding:32px 16px!important;overflow:auto!important;}' +
      '.mdviewer-export-document{max-width:960px;margin:0 auto;}' +
      'body.mdviewer-export-body .mdviewer-export-document>.markdown-body{display:block!important;position:static!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:0!important;margin:0!important;box-sizing:border-box;overflow:visible!important;transform:none!important;opacity:1!important;background:' + background + '!important;color:' + foreground + '!important;column-count:auto!important;}' +
      '.mdviewer-export-document pre{white-space:pre-wrap;overflow-wrap:anywhere;}' +
      (!isDark ? 'html:not(.dark) .mdviewer-export-document pre{background:#f1f5f9!important;color:#0f172a!important;}html:not(.dark) .mdviewer-export-document pre code{background:transparent!important;color:inherit!important;}' : '') +
      '.mdviewer-export-document .trt-mermaid-wrapper,.mdviewer-export-document .trt-mermaid-viewport,.mdviewer-export-document .trt-mermaid-canvas{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;transform:none!important;}' +
      '.mdviewer-export-document .trt-mermaid-canvas{width:100%!important;display:block!important;}' +
      '</style>';
  }

  function normalizeMermaidExport(root) {
    Array.prototype.slice.call(root.querySelectorAll('.trt-mermaid-wrapper svg')).forEach(function (svg) {
      var box = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return;
      svg.setAttribute('width', String(box[2]));
      svg.setAttribute('height', String(box[3]));
      svg.style.setProperty('width', '100%', 'important');
      svg.style.setProperty('max-width', box[2] + 'px', 'important');
      svg.style.setProperty('height', 'auto', 'important');
      svg.style.setProperty('transform', 'none', 'important');
      svg.style.display = 'block';
      svg.style.margin = '0 auto';
    });
  }

  function isFullHtmlDocument(content, fileName) {
    var source = String(content || '').replace(/^\uFEFF/, '').trim();
    if (/^(?:<!doctype\s+html\b|<html\b)/i.test(source)) return true;
    return /\.html?$/i.test(String(fileName || '').trim()) && /<[^>]+>/.test(source);
  }

  function ensureHtmlMetadata(documentNode, title, baseUrl) {
    var head = documentNode.head || documentNode.getElementsByTagName('head')[0];
    if (!head) return;
    if (!head.querySelector('meta[charset]')) {
      var charset = documentNode.createElement('meta');
      charset.setAttribute('charset', 'UTF-8');
      head.insertBefore(charset, head.firstChild);
    }
    if (!head.querySelector('meta[name="viewport"]')) {
      var viewport = documentNode.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      head.appendChild(viewport);
    }
    if (!documentNode.title) documentNode.title = title;
    if (baseUrl && !head.querySelector('base')) {
      var base = documentNode.createElement('base');
      base.setAttribute('href', baseUrl);
      head.insertBefore(base, head.firstChild);
    }
  }

  async function buildExportHtml(payload) {
    var content = String(payload.content || '');
    var fileBase = sanitizeFileBase(payload.fileName);
    if (isFullHtmlDocument(content, payload.fileName) && typeof global.DOMParser === 'function') {
      var parsed = new global.DOMParser().parseFromString(content, 'text/html');
      ensureHtmlMetadata(parsed, fileBase, payload.baseUrl);
      var htmlImages = await embedImages(parsed, null, payload);
      return {
        html: '<!DOCTYPE html>\n' + parsed.documentElement.outerHTML,
        embeddedImageCount: htmlImages.embedded,
        externalImageCount: htmlImages.external
      };
    }

    var rendered = payload.renderedElement ||
      (global.document && (global.document.getElementById('viewer') || global.document.querySelector('.markdown-body')));
    if (!rendered) throw new Error('HTML export content was not found.');
    var clone = rendered.cloneNode(true);
    ['pointer-events', 'opacity', 'position', 'left', 'top', 'width', 'height', 'min-height', 'max-height', 'transform', 'overflow', 'display'].forEach(function (property) {
      clone.style.removeProperty(property);
    });
    clone.removeAttribute('hidden');
    clone.classList.remove('hidden');
    Array.prototype.slice.call(clone.querySelectorAll('script,.no-print,button,.trt-mermaid-controls,.trt-mermaid-fixed-controls')).forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    normalizeMermaidExport(clone);
    var imageResult = await embedImages(clone, rendered, payload);
    var styles = await collectPageStyles();
    var documentTheme = rendered.closest && rendered.closest('.document-light-mode,.document-dark-mode');
    var isDark = documentTheme ? documentTheme.classList.contains('document-dark-mode') :
      !!(global.document && global.document.documentElement.classList.contains('dark'));
    var rootClass = isDark ? 'dark' : '';
    var rootStyle = global.document ? (global.document.documentElement.getAttribute('style') || '') : '';
    var html = '<!DOCTYPE html>\n' +
      '<html lang="ko" class="' + escapeHtml(rootClass) + '" style="' + escapeHtml(rootStyle) + '">\n' +
      '<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + escapeHtml(fileBase) + '</title>\n' + styles + '\n' +
      exportDocumentStyles(isDark) + '\n' +
      '</head>\n<body class="mdviewer-export-body viewer-view-mode">\n' +
      '<main class="mdviewer-export-document">' + clone.outerHTML + '</main>\n' +
      '</body>\n</html>';
    return {
      html: html,
      embeddedImageCount: imageResult.embedded,
      externalImageCount: imageResult.external
    };
  }

  function downloadHtml(html, fileName) {
    var blob = new Blob(['\uFEFF', html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var anchor = global.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    global.document.body.appendChild(anchor);
    anchor.click();
    global.setTimeout(function () {
      if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  async function exportToHTML(options) {
    var payload = options || {};
    var output = await buildExportHtml(payload);
    var fileName = sanitizeFileBase(payload.fileName) + '.html';
    downloadHtml(output.html, fileName);
    return {
      fileName: fileName,
      embeddedImageCount: output.embeddedImageCount,
      externalImageCount: output.externalImageCount
    };
  }

  global.HtmlExport = Object.freeze({
    exportToHTML: exportToHTML,
    buildExportHtml: buildExportHtml
  });
})(window);

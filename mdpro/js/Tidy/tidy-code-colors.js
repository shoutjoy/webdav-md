(function () {
    'use strict';
    const highlighter = window.MDProJavaScriptHighlight;
    if (!highlighter) return;
    highlighter.mount(document.getElementById('code'), document.getElementById('code-highlight'));
    const result = document.getElementById('jena-result');
    if (result) {
        const wrapper = document.createElement('div'); wrapper.className = 'tidy-syntax-editor';
        const mirror = document.createElement('pre'); mirror.setAttribute('aria-hidden','true');
        result.before(wrapper); wrapper.append(mirror, result); highlighter.mount(result, mirror);
    }
})();

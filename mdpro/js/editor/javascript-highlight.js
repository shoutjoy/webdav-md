(function (global) {
    'use strict';
    var mounted = new WeakSet();
    function mount(input, mirror) {
        if (!input || !mirror || mounted.has(input)) return;
        mounted.add(input);
        input.parentElement.classList.add('syntax-ready');
    var pending = 0, composing = false;
    var keywords = new Set('async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch throw try typeof var void while with yield'.split(' '));
    var builtins = new Set('Array Boolean Date Error JSON Map Math Number Object Promise RegExp Set String Symbol console undefined NaN Infinity'.split(' '));
    var tokens = /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*(?:"|$)|'(?:\\[\s\S]|[^'\\])*(?:'|$)|`(?:\\[\s\S]|[^`\\])*(?:`|$)|\/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\r\n])+\/[dgimsuvy]*|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d*)?(?:e[+-]?\d+)?n?)\b|[A-Za-z_$][\w$]*|[+*=!<>?&|%~^:\-]+/g;
    function syncScroll() { mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft; }
    function render() {
        pending = 0;
        if (composing) return;
        var source = input.value, fragment = document.createDocumentFragment(), cursor = 0;
        tokens.lastIndex = 0;
        var match;
        while ((match = tokens.exec(source))) {
            fragment.appendChild(document.createTextNode(source.slice(cursor, match.index)));
            var value = match[0], type = '';
            if (/^\/[/\*]/.test(value)) type = 'comment';
            else if (/^["'`]/.test(value)) type = 'string';
            else if (value[0] === '/') type = 'regexp';
            else if (/^\d/.test(value)) type = 'number';
            else if (/^(true|false|null)$/.test(value)) type = 'literal';
            else if (keywords.has(value)) type = 'keyword';
            else if (builtins.has(value)) type = 'builtin';
            else if (/^\s*\(/.test(source.slice(tokens.lastIndex))) type = 'function';
            else if (/^[+*=!<>?&|%~^:\-]+$/.test(value)) type = 'operator';
            if (type) { var span=document.createElement('span');span.className='js-' + type;span.textContent=value;fragment.appendChild(span); }
            else fragment.appendChild(document.createTextNode(value));
            cursor = tokens.lastIndex;
        }
        fragment.appendChild(document.createTextNode(source.slice(cursor) + '\n'));
        mirror.replaceChildren(fragment); syncScroll();
    }
    function schedule() { if (!pending) pending = requestAnimationFrame(render); }
    var nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(input, 'value', {configurable:true, get:function(){return nativeValue.get.call(this);},set:function(value){nativeValue.set.call(this,value);schedule();}});
    input.addEventListener('input', schedule);
    input.addEventListener('scroll', syncScroll);
    input.addEventListener('compositionstart', function(){composing=true;input.parentElement.classList.add('is-composing');});
    input.addEventListener('compositionend', function(){composing=false;input.parentElement.classList.remove('is-composing');schedule();});
    new ResizeObserver(syncScroll).observe(input);
    render();
    }
    global.MDProJavaScriptHighlight = { mount: mount };
})(window);

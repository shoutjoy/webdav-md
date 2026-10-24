(function (global) {
    'use strict';

    var DEFAULT_CONFIG = {
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true,
            processEnvironments: true
        },
        options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        }
    };

    var DEFAULT_SCRIPT_URL = 'js/math_render/math_render.js?v=20261024-statistical-stars-1';
    var DEFAULT_MATHJAX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.min.js';
    var TYPESET_QUEUES = typeof WeakMap === 'function' ? new WeakMap() : null;
    var fallbackTypesetQueue = Promise.resolve();

    function clone(value) {
        if (value == null) return value;
        try {
            var serialized = JSON.stringify(value);
            return serialized === undefined ? value : JSON.parse(serialized);
        } catch (_) {
            return value;
        }
    }

    function mergeDeep(base, extra) {
        var out = clone(base) || {};
        if (!extra || typeof extra !== 'object') return out;
        Object.keys(extra).forEach(function (key) {
            var next = extra[key];
            if (next && typeof next === 'object' && !Array.isArray(next)) {
                out[key] = mergeDeep(out[key] || {}, next);
            } else {
                out[key] = clone(next);
            }
        });
        return out;
    }

    function escAttr(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function looksLikeMathText(text) {
        var s = String(text || '').trim();
        if (!s) return false;
        if (/[가-힣]{2,}/.test(s)) return false;
        // A hyphen, slash, or comparison sign in prose is not evidence of math.
        // Ignore TeX command names when checking for ordinary English words.
        var plainText = s.replace(/\\[A-Za-z]+/g, '');
        if (/[A-Za-z]{2,}/.test(plainText)) return false;
        return /\\[A-Za-z]+|[_^=]|[+\-*/]|[{}]|[<>]/.test(s);
    }

    function enqueueTypeset(targetWindow, task) {
        var win = targetWindow || global;
        var previous = TYPESET_QUEUES ? TYPESET_QUEUES.get(win) : fallbackTypesetQueue;
        if (!previous || typeof previous.then !== 'function') previous = Promise.resolve();
        var next = previous.catch(function () { return false; }).then(task);
        var settled = next.catch(function () { return false; });
        if (TYPESET_QUEUES) TYPESET_QUEUES.set(win, settled);
        else fallbackTypesetQueue = settled;
        return next;
    }

    function looksLikeCitationText(text) {
        var s = String(text || '').trim();
        if (!s) return false;
        if (!/[A-Za-z가-힣]/.test(s)) return false;
        if (!/\d{3,4}/.test(s)) return false;
        if (!/[,&;]/.test(s)) return false;
        return true;
    }

    function normalizeLegacyMathDelimiters(raw) {
        var src = String(raw || '');
        var chunks = src.split(/(```[\s\S]*?```)/g);
        return chunks.map(function (chunk) {
            if (/^```[\s\S]*```$/.test(chunk)) return chunk;
            var normalized = String(chunk || '');
            var lines = normalized.split('\n');
            var rebuilt = [];
            var i = 0;

            while (i < lines.length) {
                var current = String(lines[i] || '');
                if (/^\s*\\\[\s*$/.test(current)) {
                    var mathLines = [];
                    var j = i + 1;
                    while (j < lines.length && !/^\s*\\\]\s*$/.test(String(lines[j] || ''))) {
                        mathLines.push(String(lines[j] || ''));
                        j += 1;
                    }
                    if (j < lines.length) {
                        rebuilt.push('$$\n' + mathLines.join('\n').trim() + '\n$$');
                        i = j + 1;
                        continue;
                    }
                }
                rebuilt.push(current);
                i += 1;
            }

            normalized = rebuilt.join('\n')
                // Some AI responses escape TeX delimiters for a second Markdown
                // pass (\\\\(...\\\\)). Collapse only complete paired delimiters;
                // ordinary TeX commands and line breaks remain unchanged.
                .replace(/\\\\\s*\(([\s\S]*?)\\\\\s*\)/g, function (_, inner) {
                    return '\\(' + String(inner || '').trim() + '\\)';
                })
                .replace(/\\\\\s*\[([\s\S]*?)\\\\\s*\]/g, function (_, inner) {
                    return '\\[' + String(inner || '').trim() + '\\]';
                })
                .replace(/\\\s*\[([\s\S]*?)\\\s*\]/g, function (_, inner) {
                    return '$$\n' + String(inner || '').trim() + '\n$$';
                })
                .replace(/\\\s*\(([\s\S]*?)\\\s*\)/g, function (_, inner) {
                    return '$' + String(inner || '').trim() + '$';
                });

            lines = normalized.split('\n').map(function (line) {
                var m = line.match(/^(\s*)\[(.+?)\](\s*)$/);
                if (!m) return line;
                var inner = String(m[2] || '').trim();
                if (!looksLikeMathText(inner)) return line;
                return String(m[1] || '') + '\\[' + inner + '\\]' + String(m[3] || '');
            });

            return lines.join('\n').replace(/(^|[^\]\\\w])\(([^()\n]{1,120})\)(?=\s*[:.,;]|$)/g, function (match, prefix, inner) {
                var body = String(inner || '').trim();
                // Do not wrap an ordinary parenthesis that already contains an
                // explicit math segment. Otherwise (\(\beta\)) becomes
                // \($\beta$\), leaving the inner dollar signs visible.
                if (/\$|\\[\[(]/.test(body)) return match;
                if (!looksLikeMathText(body)) return match;
                if (looksLikeCitationText(body)) return match;
                if (/[&;,]/.test(body) && /[A-Za-z가-힣]/.test(body)) return match;
                return String(prefix || '') + '\\(' + body + '\\)';
            });
        }).join('');
    }

    function getMarkdownParser(markdownParser) {
        if (typeof markdownParser === 'function') return markdownParser;
        if (markdownParser && typeof markdownParser.parse === 'function') {
            return function (input) {
                return markdownParser.parse(input);
            };
        }
        return null;
    }

    var MathRender = {
        scriptUrl: DEFAULT_SCRIPT_URL,
        mathJaxUrl: DEFAULT_MATHJAX_URL,
        createMathJaxConfig: function (overrides) {
            return mergeDeep(DEFAULT_CONFIG, overrides);
        },
        ensureWindowConfig: function (targetWindow, overrides) {
            var win = targetWindow || global;
            var current = (win && win.MathJax && typeof win.MathJax === 'object') ? win.MathJax : {};
            if (current && (current.startup || typeof current.typesetPromise === 'function')) {
                return current;
            }
            var merged = mergeDeep(this.createMathJaxConfig(), current);
            if (overrides && typeof overrides === 'object') merged = mergeDeep(merged, overrides);
            if (win) win.MathJax = merged;
            return merged;
        },
        getConfigScriptTag: function (overrides) {
            return '<script>window.MathJax=' + JSON.stringify(this.createMathJaxConfig(overrides)) + ';<\/script>';
        },
        getHeadTags: function (options) {
            var opts = options || {};
            var includeSelf = opts.includeSelf !== false;
            var scriptUrl = opts.scriptUrl || this.scriptUrl;
            var mathJaxUrl = opts.mathJaxUrl || this.mathJaxUrl;
            var html = '';
            if (includeSelf) html += '<script src="' + escAttr(scriptUrl) + '"><\/script>';
            html += this.getConfigScriptTag(opts.configOverrides);
            html += '<script src="' + escAttr(mathJaxUrl) + '"><\/script>';
            return html;
        },
        prepareMarkdown: function (raw) {
            // Quoted sentence placeholders are literal tildes, not paired deletion marks.
            return normalizeLegacyMathDelimiters(raw).split(/(`{3,}[\s\S]*?`{3,}|~{3,}[^\n]*\n[\s\S]*?\n~{3,}|`+[^`]*`+)/g).map(function (part, index) {
                if (index % 2) return part;
                return part.replace(/(["'“‘])~~(?=[^~\s])([^\n"'”’]*)(["'”’])/g, function (match, quote, body, end) {
                    return body.indexOf('~~') >= 0 ? match : quote + '&#126;&#126;' + body + end;
                });
            }).join('');
        },
        createMarkedInput: function (raw) {
            return this.protectMathSegments(this.prepareMarkdown(raw));
        },
        renderMarkdown: function (markdownParser, raw) {
            var parse = getMarkdownParser(markdownParser);
            var prepared = this.createMarkedInput(raw);
            if (!parse) return Promise.resolve(prepared.restoreHtml(prepared.text));
            try {
                return Promise.resolve(parse(prepared.text)).then(function (html) {
                    return prepared.restoreHtml(html || '');
                });
            } catch (err) {
                return Promise.reject(err);
            }
        },
        renderMarkdownSync: function (markdownParser, raw) {
            var parse = getMarkdownParser(markdownParser);
            var prepared = this.createMarkedInput(raw);
            if (!parse) return prepared.restoreHtml(prepared.text);
            var html = parse(prepared.text);
            if (html != null && typeof html.then === 'function') {
                throw new Error('MathRender.renderMarkdownSync does not support async markdown parsers.');
            }
            return prepared.restoreHtml(html || '');
        },
        renderMarkdownSafe: function (markdownParser, raw, options) {
            var opts = options || {};
            var fallbackText = opts.fallbackText != null ? opts.fallbackText : raw;
            var fallbackHtml = opts.fallbackHtml;
            if (fallbackHtml == null) {
                fallbackHtml = '<p>' + escapeHtml(fallbackText).replace(/\n/g, '<br>') + '</p>';
            }
            if (!markdownParser) return Promise.resolve(fallbackHtml);
            return this.renderMarkdown(markdownParser, raw).catch(function () {
                return fallbackHtml;
            });
        },
        renderMarkdownSafeSync: function (markdownParser, raw, options) {
            var opts = options || {};
            var fallbackText = opts.fallbackText != null ? opts.fallbackText : raw;
            var fallbackHtml = opts.fallbackHtml;
            if (fallbackHtml == null) {
                fallbackHtml = escapeHtml(fallbackText).replace(/\n/g, '<br>');
            }
            if (!markdownParser) return fallbackHtml;
            try {
                return this.renderMarkdownSync(markdownParser, raw);
            } catch (_) {
                return fallbackHtml;
            }
        },
        setElementHtml: function (target, html) {
            if (!target) return '';
            var next = String(html || '');
            target.innerHTML = next;
            return next;
        },
        renderIntoElement: function (target, markdownParser, raw, options) {
            var self = this;
            var opts = options || {};
            return this.renderMarkdownSafe(markdownParser, raw, opts).then(function (html) {
                self.setElementHtml(target, html);
                return self.typesetElement(target, opts).then(function () {
                    return html;
                });
            });
        },
        typesetElement: function (target, options) {
            return this.renderElement(target, options || {});
        },
        renderElement: function (target, options) {
            return this.typesetWhenReady(target, options || {});
        },
        typeset: function (target, options) {
            var opts = options || {};
            var win = opts.targetWindow || global;
            var root = target || (win.document && win.document.body);
            return enqueueTypeset(win, function () {
                var mj = win && win.MathJax;
                if (!root || !mj || typeof mj.typesetPromise !== 'function') {
                    return false;
                }
                try {
                    if (opts.clear !== false && typeof mj.typesetClear === 'function') {
                        mj.typesetClear([root]);
                    }
                    return mj.typesetPromise([root]).then(function () {
                        return true;
                    }).catch(function (err) {
                        if (opts.silent !== true && win.console && typeof win.console.warn === 'function') {
                            win.console.warn('[MathRender] typeset failed:', err);
                        }
                        return false;
                    });
                } catch (err) {
                    if (opts.silent !== true && win.console && typeof win.console.warn === 'function') {
                        win.console.warn('[MathRender] typeset failed:', err);
                    }
                    return false;
                }
            });
        },
        typesetWhenReady: function (target, options) {
            var opts = options || {};
            var win = opts.targetWindow || global;
            var retries = typeof opts.retries === 'number' ? opts.retries : 30;
            var delay = typeof opts.delay === 'number' ? opts.delay : 100;
            var self = this;
            return new Promise(function (resolve) {
                var tries = 0;
                function run() {
                    var mj = win && win.MathJax;
                    if (mj && typeof mj.typesetPromise === 'function') {
                        self.typeset(target, opts).then(resolve);
                        return;
                    }
                    tries += 1;
                    if (tries >= retries) {
                        resolve(false);
                        return;
                    }
                    setTimeout(run, delay);
                }
                run();
            });
        },
        protectStatisticalMarkers: function (text) {
            function literalStars(match) { return match.replace(/\*/g, '&#42;'); }
            return String(text || '')
                // A cell containing only significance stars is not emphasis.
                .replace(/(^|\|)[ \t]*\*{1,3}(?=[ \t]*\|)/gm, literalStars)
                .replace(/\|[ \t]*\*{1,3}[ \t]*$/gm, literalStars)
                // Numeric estimates / item labels: .42**, 1***, -2.3*.
                .replace(/(^|[^\w*\\])(-?(?:\d+(?:\.\d+)?|\.\d+))\*{1,3}(?!\*)(?=$|[\s|.,;:!?)\]])/g, literalStars)
                // Significance legends, including < which must remain text.
                .replace(/(^|[\s(,;:])\*{1,3}(?=\s*p\s*(?:[<=>≤≥]|&lt;|&gt;))/gi, literalStars);
        },
        protectMathSegments: function (md) {
            var src = String(md || '');
            // Code spans (including multi-backtick spans) and fenced blocks own
            // their dollar signs; never pair them with a later math delimiter.
            var codePattern = /`{3,}[^\n]*\n[\s\S]*?\n`{3,}|~{3,}[^\n]*\n[\s\S]*?\n~{3,}|(`+)(?!`)[\s\S]*?\1(?!`)/g;
            var slots = [];

            function escapeHtml(value) {
                return String(value || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            function normalizeMathSegment(seg) {
                var source = String(seg || '');
                var open = '';
                var close = '';
                var body = source;

                if (source.slice(0, 3) === '\\\\(' && source.slice(-3) === '\\\\)') {
                    open = '\\(';
                    close = '\\)';
                    body = source.slice(3, -3);
                } else if (source.slice(0, 3) === '\\\\[' && source.slice(-3) === '\\\\]') {
                    open = '\\[';
                    close = '\\]';
                    body = source.slice(3, -3);
                } else if (source.slice(0, 2) === '\\(' && source.slice(-2) === '\\)') {
                    open = '\\(';
                    close = '\\)';
                    body = source.slice(2, -2);
                } else if (source.slice(0, 2) === '\\[' && source.slice(-2) === '\\]') {
                    open = '\\[';
                    close = '\\]';
                    body = source.slice(2, -2);
                } else if (source.slice(0, 2) === '$$' && source.slice(-2) === '$$') {
                    open = '$$';
                    close = '$$';
                    body = source.slice(2, -2);
                } else if (source.charAt(0) === '$' && source.charAt(source.length - 1) === '$') {
                    open = '$';
                    close = '$';
                    body = source.slice(1, -1);
                }

                if (!open) return source;

                // AI output occasionally uses Markdown-style ampersands to decorate
                // an entire TeX expression: \(&r=.9&\). Outside an alignment
                // environment those ampersands are invalid and MathJax reports
                // "Misplaced &". Remove only a single pair at the outer boundary;
                // preserve &=, matrices, aligned rows, and all interior ampersands.
                var match = body.match(/^(\s*)&([^&]*)&(\s*)$/);
                if (match && !/\\begin\s*\{|\\\\(?:\s|$)/.test(body)) {
                    body = match[1] + match[2] + match[3];
                }
                // The same double-escaping often affects TeX commands such as
                // \\sqrt or \\text. A true TeX row break is followed by spacing
                // or the end of the expression, so leave that form intact.
                body = body.replace(/\\\\(?=[A-Za-z])/g, '\\');
                return open + body + close;
            }

            function pushSlot(out, seg) {
                var token = '@@MATHSEG_' + slots.length + '@@';
                slots.push(normalizeMathSegment(seg));
                out.push(token);
            }

            function protectChunk(text) {
                var s = String(text || '');
                var out = [];
                var i = 0;
                var end = -1;

                while (i < s.length) {
                    if (s.slice(i, i + 3) === '\\\\(' || s.slice(i, i + 3) === '\\\\[') {
                        var doubledClose = s.slice(i, i + 3) === '\\\\(' ? '\\\\)' : '\\\\]';
                        end = s.indexOf(doubledClose, i + 3);
                        if (end >= 0) {
                            pushSlot(out, s.slice(i, end + 3));
                            i = end + 3;
                            continue;
                        }
                    }

                    if (s[i] === '\\' && s[i + 1] === '[') {
                        end = s.indexOf('\\]', i + 2);
                        if (end >= 0) {
                            pushSlot(out, s.slice(i, end + 2));
                            i = end + 2;
                            continue;
                        }
                    }

                    if (s[i] === '\\' && s[i + 1] === '(') {
                        end = s.indexOf('\\)', i + 2);
                        if (end >= 0) {
                            pushSlot(out, s.slice(i, end + 2));
                            i = end + 2;
                            continue;
                        }
                    }

                    if (s[i] === '$' && s[i + 1] === '$' && (i === 0 || s[i - 1] !== '\\')) {
                        end = -1;
                        for (var k = i + 2; k < s.length - 1; k += 1) {
                            if (s[k] === '$' && s[k + 1] === '$' && s[k - 1] !== '\\') {
                                end = k;
                                break;
                            }
                        }
                        if (end >= 0) {
                            pushSlot(out, s.slice(i, end + 2));
                            i = end + 2;
                            continue;
                        }
                    }

                    if (s[i] === '$' && (i === 0 || s[i - 1] !== '\\')) {
                        end = -1;
                        for (var j = i + 1; j < s.length; j += 1) {
                            if (s[j] === '$' && s[j - 1] !== '\\') {
                                end = j;
                                break;
                            }
                        }
                        if (end >= 0) {
                            pushSlot(out, s.slice(i, end + 1));
                            i = end + 1;
                            continue;
                        }
                    }

                    // Marked accepts ~text~ as deletion, which joins unrelated
                    // ranges such as insa_i1~insa_i4, insa_p1~insa_p4. Protect
                    // lone tildes through parsing, then restore the literal
                    // character (also inside URLs/attributes). Keep ~~ deletion
                    // and escaped tildes under the Markdown parser's control.
                    if (s[i] === '~' && s[i - 1] !== '~' && s[i + 1] !== '~') {
                        var backslashes = 0;
                        for (var b = i - 1; b >= 0 && s[b] === '\\'; b -= 1) backslashes += 1;
                        if (backslashes % 2 === 0) {
                            pushSlot(out, '~');
                            i += 1;
                            continue;
                        }
                    }

                    out.push(s[i]);
                    i += 1;
                }

                return MathRender.protectStatisticalMarkers(out.join(''));
            }

            var cursor = 0;
            var protectedText = '';
            src.replace(codePattern, function (code, ticks, offset) {
                protectedText += protectChunk(src.slice(cursor, offset)) + code;
                cursor = offset + code.length;
                return code;
            });
            protectedText += protectChunk(src.slice(cursor));

            return {
                text: protectedText,
                restoreHtml: function (html) {
                    var out = String(html || '');
                    for (var i = 0; i < slots.length; i += 1) {
                        out = out.split('@@MATHSEG_' + i + '@@').join(escapeHtml(slots[i]));
                    }
                    return out;
                }
            };
        }
    };

    global.MathRender = MathRender;
    MathRender.ensureWindowConfig(global);
    global.renderMathInMarkdownViewer = function (element, options) {
        var opts = options || {};
        var targetWindow = opts.targetWindow;
        if (!targetWindow) {
            try {
                targetWindow = element && element.ownerDocument && element.ownerDocument.defaultView
                    ? element.ownerDocument.defaultView
                    : global;
            } catch (_) {
                targetWindow = global;
            }
        }
        return MathRender.typesetElement(element, {
            silent: opts.silent !== false,
            clear: opts.clear,
            retries: opts.retries,
            delay: opts.delay,
            targetWindow: targetWindow
        });
    };
})(window);

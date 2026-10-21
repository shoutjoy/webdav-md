(function (global) {
    'use strict';

    var SETTINGS_KEY = 'tidyCustomScripts';
    var GITHUB_FOLDER = 'mdviewer/tidy-scripts';
    var FILE_HEADER = 'mdviewer-tidy-script:v1';
    var sourceUrl = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
    var managerUrl = sourceUrl
        ? new URL('./tidy-script-manager.html?v=20261016-ai-tools-1', sourceUrl).href
        : './js/Tidy/tidy-script-manager.html';
    var deps = {};
    var scripts = [];
    var configured = false;
    var runBusy = false;

    function stringValue(value) {
        return String(value == null ? '' : value);
    }

    function createId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return 'tidy_' + global.crypto.randomUUID();
        }
        return 'tidy_' + Date.now() + '_' + Math.random().toString(16).slice(2, 10);
    }

    function normalizeName(value) {
        return Array.from(stringValue(value).trim()).slice(0, 60).join('');
    }

    function normalizeRecord(input, previous) {
        var source = input && typeof input === 'object' ? input : {};
        var prior = previous && typeof previous === 'object' ? previous : {};
        var now = new Date().toISOString();
        return {
            id: stringValue(source.id || prior.id || createId()).trim(),
            name: normalizeName(source.name || prior.name || '사용자 TIDY'),
            code: stringValue(source.code != null ? source.code : prior.code).trim(),
            enabled: source.enabled !== false,
            sourceName: stringValue(source.sourceName || prior.sourceName || '').trim().slice(0, 260),
            createdAt: stringValue(prior.createdAt || source.createdAt || now),
            updatedAt: stringValue(source.updatedAt || prior.updatedAt || now),
            mirrors: {
                sqlite: !!((source.mirrors || prior.mirrors) && (source.mirrors || prior.mirrors).sqlite),
                github: !!((source.mirrors || prior.mirrors) && (source.mirrors || prior.mirrors).github)
            }
        };
    }

    function normalizeList(value) {
        var seen = new Set();
        return (Array.isArray(value) ? value : []).map(function (item) {
            return normalizeRecord(item, item);
        }).filter(function (item) {
            if (!item.id || !item.name || !item.code || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        }).slice(0, 100);
    }

    function compileTransformer(code) {
        var source = stringValue(code).trim();
        if (!/^(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(/.test(source)) {
            throw new Error('코드는 function transform(source, context) { ... } 형식이어야 합니다.');
        }
        var fn = Function('"use strict"; return (' + source + ');')();
        if (typeof fn !== 'function') throw new Error('변환 함수를 찾을 수 없습니다.');
        return fn;
    }

    function utf8ToBase64(text) {
        var bytes = new TextEncoder().encode(stringValue(text));
        var binary = '';
        for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function base64ToUtf8(text) {
        var binary = atob(stringValue(text).replace(/\s+/g, ''));
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }

    function serializeGithubFile(record) {
        var metadata = {
            id: record.id,
            name: record.name,
            enabled: record.enabled !== false,
            sourceName: record.sourceName || '',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        };
        return '/* ' + FILE_HEADER + '\n' + utf8ToBase64(JSON.stringify(metadata)) + '\n*/\n' + record.code.trim() + '\n';
    }

    function parseGithubFile(text, fallbackName) {
        var source = stringValue(text);
        var match = source.match(/^\/\*\s*mdviewer-tidy-script:v1\s*\n([A-Za-z0-9+/=\r\n]+?)\n\*\/\s*\n([\s\S]*)$/);
        if (!match) {
            return normalizeRecord({
                name: stringValue(fallbackName || '업로드 JS').replace(/\.js$/i, ''),
                code: source,
                sourceName: fallbackName || ''
            });
        }
        var metadata = JSON.parse(base64ToUtf8(match[1]));
        return normalizeRecord({
            id: metadata.id,
            name: metadata.name,
            enabled: metadata.enabled,
            sourceName: metadata.sourceName || fallbackName || '',
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt,
            code: match[2]
        });
    }

    function filePath(record) {
        return GITHUB_FOLDER + '/' + stringValue(record.id).replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js';
    }

    function renderButtons() {
        var container = document.getElementById('tidy-custom-script-buttons');
        if (!container) return;
        container.replaceChildren();
        scripts.filter(function (item) { return item.enabled !== false; }).forEach(function (item) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'tidy-action-button tidy-custom-action-button px-2 py-1 rounded border border-cyan-300 dark:border-cyan-700 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20';
            button.textContent = item.name;
            button.title = '사용자 JS TIDY 실행: ' + item.name;
            button.addEventListener('click', function () { applyScript(item.id); });
            container.appendChild(button);
        });
    }

    async function refresh() {
        if (!configured || typeof deps.getSettings !== 'function') return scripts.slice();
        var settings = await deps.getSettings() || {};
        scripts = normalizeList(settings[SETTINGS_KEY]);
        renderButtons();
        return scripts.slice();
    }

    async function saveLocalList(nextList) {
        scripts = normalizeList(nextList);
        if (typeof deps.setSettings !== 'function') throw new Error('inDB 설정 저장 기능이 준비되지 않았습니다.');
        await deps.setSettings({ tidyCustomScripts: scripts });
        renderButtons();
        return scripts.slice();
    }

    async function saveSqliteList(nextList) {
        if (!global.MDPStorage || typeof global.MDPStorage.putSqliteSetting !== 'function') {
            throw new Error('SQLite 설정 저장 기능이 준비되지 않았습니다.');
        }
        var status = global.MDPStorage.getStatus ? global.MDPStorage.getStatus() : null;
        if (!status || !status.sqliteHealth || status.sqliteHealth.available !== true
            || !status.sqliteHealth.capabilities || status.sqliteHealth.capabilities.settings !== true) {
            throw new Error('SQLite 설정 저장소에 연결되지 않았습니다.');
        }
        await global.MDPStorage.putSqliteSetting({
            key: SETTINGS_KEY,
            value: normalizeList(nextList),
            group: 'collections',
            scopeType: 'workspace',
            scopeId: 'workspace_default'
        });
    }

    async function saveGithubRecord(record) {
        if (!global.GithubApp || typeof global.GithubApp.upsertTextFile !== 'function') {
            throw new Error('GitHub 파일 저장 기능이 준비되지 않았습니다.');
        }
        return global.GithubApp.upsertTextFile(
            filePath(record),
            serializeGithubFile(record),
            'tidy: save ' + record.name
        );
    }

    async function save(input) {
        var source = input && typeof input === 'object' ? input : {};
        var previous = scripts.find(function (item) { return item.id === source.id; });
        var record = normalizeRecord(source, previous);
        record.updatedAt = new Date().toISOString();
        if (!record.name) throw new Error('기능 이름을 입력하세요.');
        if (!record.code) throw new Error('JavaScript 코드를 입력하거나 업로드하세요.');
        compileTransformer(record.code);

        var requested = source.storage && typeof source.storage === 'object' ? source.storage : {};
        record.mirrors.sqlite = !!requested.sqlite;
        record.mirrors.github = !!requested.github;
        var next = scripts.filter(function (item) { return item.id !== record.id; });
        next.push(record);
        await saveLocalList(next);

        var savedTo = ['inDB'];
        var warnings = [];
        if (requested.sqlite) {
            try {
                await saveSqliteList(next);
                savedTo.push('SQLite');
            } catch (error) {
                warnings.push('SQLite: ' + (error && error.message ? error.message : error));
            }
        }
        if (requested.github) {
            try {
                await saveGithubRecord(record);
                savedTo.push('GitHub');
            } catch (error) {
                warnings.push('GitHub: ' + (error && error.message ? error.message : error));
            }
        }
        return { record: record, savedTo: savedTo, warnings: warnings };
    }

    async function remove(id, options) {
        var targetId = stringValue(id).trim();
        var target = scripts.find(function (item) { return item.id === targetId; });
        if (!target) return { removed: false, warnings: [] };
        var next = scripts.filter(function (item) { return item.id !== targetId; });
        await saveLocalList(next);
        var config = options && typeof options === 'object' ? options : {};
        var warnings = [];
        if (config.sqlite) {
            try { await saveSqliteList(next); } catch (error) {
                warnings.push('SQLite: ' + (error && error.message ? error.message : error));
            }
        }
        if (config.github && global.GithubApp && typeof global.GithubApp.deleteTextFile === 'function') {
            try { await global.GithubApp.deleteTextFile(filePath(target), 'tidy: delete ' + target.name); } catch (error) {
                warnings.push('GitHub: ' + (error && error.message ? error.message : error));
            }
        }
        return { removed: true, warnings: warnings };
    }

    async function importSqlite() {
        if (!global.MDPStorage || typeof global.MDPStorage.getResolvedSqliteSettings !== 'function') {
            throw new Error('SQLite 설정 불러오기 기능이 준비되지 않았습니다.');
        }
        var resolved = await global.MDPStorage.getResolvedSqliteSettings();
        var remote = normalizeList(resolved && resolved.values ? resolved.values[SETTINGS_KEY] : []);
        var merged = mergeLists(scripts, remote);
        await saveLocalList(merged);
        return { imported: remote.length, total: merged.length };
    }

    async function importGithub() {
        if (!global.GithubApp || typeof global.GithubApp.listTextFiles !== 'function'
            || typeof global.GithubApp.readTextFile !== 'function') {
            throw new Error('GitHub 파일 불러오기 기능이 준비되지 않았습니다.');
        }
        var files = await global.GithubApp.listTextFiles(GITHUB_FOLDER, '.js');
        var imported = [];
        for (var i = 0; i < files.length; i += 1) {
            var item = files[i];
            try {
                var content = await global.GithubApp.readTextFile(item.path);
                var parsed = parseGithubFile(content, item.path.split('/').pop());
                compileTransformer(parsed.code);
                parsed.mirrors.github = true;
                imported.push(parsed);
            } catch (error) {
                console.warn('TIDY GitHub script skipped:', item && item.path, error);
            }
        }
        var merged = mergeLists(scripts, imported);
        await saveLocalList(merged);
        return { imported: imported.length, total: merged.length };
    }

    function mergeLists(local, incoming) {
        var map = new Map();
        normalizeList(local).forEach(function (item) { map.set(item.id, item); });
        normalizeList(incoming).forEach(function (item) {
            var current = map.get(item.id);
            if (!current || stringValue(item.updatedAt) >= stringValue(current.updatedAt)) map.set(item.id, item);
        });
        return Array.from(map.values());
    }

    function getStorageStatus() {
        var storageStatus = global.MDPStorage && global.MDPStorage.getStatus ? global.MDPStorage.getStatus() : null;
        var sqliteAvailable = !!(storageStatus && storageStatus.sqliteHealth && storageStatus.sqliteHealth.available
            && storageStatus.sqliteHealth.capabilities && storageStatus.sqliteHealth.capabilities.settings);
        return Promise.resolve(typeof deps.getSettings === 'function' ? deps.getSettings() : {}).then(function (settings) {
            var github = global.GithubApp && typeof global.GithubApp.getGithubConfigFromSettings === 'function'
                ? global.GithubApp.getGithubConfigFromSettings(settings || {})
                : null;
            return {
                sqliteAvailable: sqliteAvailable,
                sqliteBackend: storageStatus && storageStatus.sqliteBackend ? storageStatus.sqliteBackend : '',
                githubAvailable: !!(github && github.enabled && github.token && github.repo && github.branch),
                githubRepo: github && github.repo ? github.repo : '',
                githubBranch: github && github.branch ? github.branch : ''
            };
        });
    }

    function runInWorker(code, source, context) {
        if (typeof Worker !== 'function' || typeof Blob !== 'function' || !global.URL || typeof global.URL.createObjectURL !== 'function') {
            return Promise.reject(new Error('안전한 실행을 위한 Web Worker를 사용할 수 없습니다.'));
        }
        return new Promise(function (resolve, reject) {
            var workerSource = ''
                + 'self.onmessage=async function(event){try{'
                + 'var data=event.data||{};var fn=(0,eval)("("+data.code+")");'
                + 'var result=await fn(data.source,Object.freeze(data.context||{}));'
                + 'self.postMessage({ok:true,result:result});'
                + '}catch(error){self.postMessage({ok:false,error:String(error&&error.message?error.message:error)});}};';
            var url = global.URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
            var worker = new Worker(url);
            var timer = global.setTimeout(function () {
                worker.terminate();
                global.URL.revokeObjectURL(url);
                reject(new Error('사용자 JS 실행이 10초를 넘어 중단되었습니다.'));
            }, 10000);
            worker.onmessage = function (event) {
                global.clearTimeout(timer);
                worker.terminate();
                global.URL.revokeObjectURL(url);
                var payload = event.data || {};
                if (payload.ok) resolve(payload.result);
                else reject(new Error(payload.error || '사용자 JS 실행 실패'));
            };
            worker.onerror = function (event) {
                global.clearTimeout(timer);
                worker.terminate();
                global.URL.revokeObjectURL(url);
                reject(new Error(event && event.message ? event.message : '사용자 JS Worker 실행 실패'));
            };
            worker.postMessage({ code: code, source: source, context: context });
        });
    }

    async function applyScript(id) {
        if (runBusy) {
            if (typeof deps.showToast === 'function') deps.showToast('사용자 TIDY 기능을 실행하고 있습니다.');
            return;
        }
        var record = scripts.find(function (item) { return item.id === id; });
        var ta = deps.editorTextarea || document.getElementById('viewer-edit-ta');
        if (!record || record.enabled === false) return;
        if (!deps.isEditMode() || !ta) {
            if (typeof deps.showToast === 'function') deps.showToast('편집 모드에서 사용하세요.');
            return;
        }
        if (global.TidyActions && typeof global.TidyActions.closeMenu === 'function') global.TidyActions.closeMenu();
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        var hasSelection = start !== end;
        var originalText = ta.value;
        var source = hasSelection ? originalText.substring(start, end) : originalText;
        runBusy = true;
        try {
            var result = await runInWorker(record.code, source, {
                hasSelection: hasSelection,
                scope: hasSelection ? 'selection' : 'document',
                scriptId: record.id,
                scriptName: record.name
            });
            var value = typeof result === 'string' ? result : (result && typeof result.value === 'string' ? result.value : null);
            if (value == null) throw new Error('변환 함수는 문자열 또는 { value: 문자열 }을 반환해야 합니다.');
            if (ta.value !== originalText) throw new Error('실행 중 문서가 변경되었습니다. 다시 실행하세요.');
            if (value === source) {
                if (typeof deps.showToast === 'function') deps.showToast(record.name + ': 바꿀 내용이 없습니다.');
                return;
            }
            var actionDeps = typeof deps.getActionDeps === 'function' ? deps.getActionDeps() : deps;
            global.TidyActions.applyResultToEditor({ value: value }, source, actionDeps);
            var message = result && typeof result === 'object' && result.message ? stringValue(result.message) : '';
            if (typeof deps.showToast === 'function') deps.showToast(message || (record.name + ' 적용 완료'));
        } catch (error) {
            if (typeof deps.showToast === 'function') deps.showToast(record.name + ' 실패: ' + (error && error.message ? error.message : error));
        } finally {
            runBusy = false;
        }
    }

    function installManagerResizeHandles(dialog) {
        if (!dialog || dialog.dataset.resizeHandlesReady === 'true') return;
        dialog.dataset.resizeHandlesReady = 'true';

        var style = document.getElementById('tidy-manager-resize-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'tidy-manager-resize-style';
            style.textContent = [
                '#tidy-manager-dialog .tidy-manager-resize-shield{display:none;position:absolute;inset:0;z-index:20;background:transparent}',
                '#tidy-manager-dialog.tidy-manager-resizing .tidy-manager-resize-shield{display:block}',
                '#tidy-manager-dialog .tidy-manager-resize-handle{position:absolute;z-index:30;touch-action:none;background:transparent}',
                '#tidy-manager-dialog .tidy-manager-resize-handle::after{content:"";position:absolute;background:#22d3ee;opacity:.72;border-radius:2px;box-shadow:0 0 0 1px rgba(2,6,23,.72)}',
                '#tidy-manager-dialog .tidy-manager-resize-n{left:18px;right:18px;top:-5px;height:10px;cursor:n-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-s{left:18px;right:18px;bottom:-5px;height:10px;cursor:s-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-w{top:18px;bottom:18px;left:-5px;width:10px;cursor:w-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-e{top:18px;bottom:18px;right:-5px;width:10px;cursor:e-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-n::after,#tidy-manager-dialog .tidy-manager-resize-s::after{left:50%;width:44px;height:4px;transform:translateX(-50%)}',
                '#tidy-manager-dialog .tidy-manager-resize-n::after{top:3px}',
                '#tidy-manager-dialog .tidy-manager-resize-s::after{bottom:3px}',
                '#tidy-manager-dialog .tidy-manager-resize-w::after,#tidy-manager-dialog .tidy-manager-resize-e::after{top:50%;width:4px;height:44px;transform:translateY(-50%)}',
                '#tidy-manager-dialog .tidy-manager-resize-w::after{left:3px}',
                '#tidy-manager-dialog .tidy-manager-resize-e::after{right:3px}',
                '#tidy-manager-dialog .tidy-manager-resize-nw,#tidy-manager-dialog .tidy-manager-resize-ne,#tidy-manager-dialog .tidy-manager-resize-sw,#tidy-manager-dialog .tidy-manager-resize-se{width:20px;height:20px}',
                '#tidy-manager-dialog .tidy-manager-resize-nw{left:-5px;top:-5px;cursor:nw-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-ne{right:-5px;top:-5px;cursor:ne-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-sw{left:-5px;bottom:-5px;cursor:sw-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-se{right:-5px;bottom:-5px;cursor:se-resize}',
                '#tidy-manager-dialog .tidy-manager-resize-nw::after,#tidy-manager-dialog .tidy-manager-resize-ne::after,#tidy-manager-dialog .tidy-manager-resize-sw::after,#tidy-manager-dialog .tidy-manager-resize-se::after{width:11px;height:11px}',
                '#tidy-manager-dialog .tidy-manager-resize-nw::after{left:4px;top:4px;border-radius:3px 0 0 0}',
                '#tidy-manager-dialog .tidy-manager-resize-ne::after{right:4px;top:4px;border-radius:0 3px 0 0}',
                '#tidy-manager-dialog .tidy-manager-resize-sw::after{left:4px;bottom:4px;border-radius:0 0 0 3px}',
                '#tidy-manager-dialog .tidy-manager-resize-se::after{right:4px;bottom:4px;border-radius:0 0 3px 0}'
            ].join('');
            document.head.appendChild(style);
        }

        var shield = document.createElement('div');
        shield.className = 'tidy-manager-resize-shield';
        shield.setAttribute('aria-hidden', 'true');
        dialog.appendChild(shield);

        ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'].forEach(function (direction) {
            var handle = document.createElement('div');
            handle.className = 'tidy-manager-resize-handle tidy-manager-resize-' + direction;
            handle.dataset.direction = direction;
            handle.setAttribute('aria-hidden', 'true');
            handle.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                event.preventDefault();
                var rect = dialog.getBoundingClientRect();
                var startX = event.clientX;
                var startY = event.clientY;
                var minWidth = Math.min(520, Math.max(320, window.innerWidth - 24));
                var minHeight = Math.min(360, Math.max(240, window.innerHeight - 24));
                var edgeGap = 6;
                dialog.classList.add('tidy-manager-resizing');
                handle.setPointerCapture(event.pointerId);

                function move(moveEvent) {
                    var dx = moveEvent.clientX - startX;
                    var dy = moveEvent.clientY - startY;
                    var left = rect.left;
                    var top = rect.top;
                    var right = rect.right;
                    var bottom = rect.bottom;
                    if (direction.indexOf('w') !== -1) left = Math.min(Math.max(edgeGap, rect.left + dx), right - minWidth);
                    if (direction.indexOf('e') !== -1) right = Math.max(Math.min(window.innerWidth - edgeGap, rect.right + dx), left + minWidth);
                    if (direction.indexOf('n') !== -1) top = Math.min(Math.max(edgeGap, rect.top + dy), bottom - minHeight);
                    if (direction.indexOf('s') !== -1) bottom = Math.max(Math.min(window.innerHeight - edgeGap, rect.bottom + dy), top + minHeight);
                    dialog.style.left = Math.round(left) + 'px';
                    dialog.style.top = Math.round(top) + 'px';
                    dialog.style.width = Math.round(right - left) + 'px';
                    dialog.style.height = Math.round(bottom - top) + 'px';
                }

                function stop() {
                    dialog.classList.remove('tidy-manager-resizing');
                    handle.removeEventListener('pointermove', move);
                    handle.removeEventListener('pointerup', stop);
                    handle.removeEventListener('pointercancel', stop);
                }
                handle.addEventListener('pointermove', move);
                handle.addEventListener('pointerup', stop);
                handle.addEventListener('pointercancel', stop);
            });
            dialog.appendChild(handle);
        });
    }

    function placeManagerDialog(dialog) {
        var rect = dialog.getBoundingClientRect();
        var width = Math.min(rect.width, window.innerWidth - 12);
        var height = Math.min(rect.height, window.innerHeight - 12);
        dialog.style.inset = 'auto';
        dialog.style.margin = '0';
        dialog.style.maxWidth = 'none';
        dialog.style.maxHeight = 'none';
        dialog.style.left = Math.max(6, Math.round((window.innerWidth - width) / 2)) + 'px';
        dialog.style.top = Math.max(6, Math.round((window.innerHeight - height) / 2)) + 'px';
        dialog.style.width = Math.round(width) + 'px';
        dialog.style.height = Math.round(height) + 'px';
    }

    function openManager() {
        if (global.TidyActions && typeof global.TidyActions.closeMenu === 'function') global.TidyActions.closeMenu();
        var dialog = document.getElementById('tidy-manager-dialog');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'tidy-manager-dialog';
            dialog.setAttribute('aria-label', 'TIDY 기능 개발');
            dialog.style.cssText = 'position:fixed;inset:0;width:96vw;max-width:1800px;height:94vh;max-height:94vh;padding:0;border:1px solid #475569;border-radius:12px;background:#020617;overflow:hidden;';
            var frame = document.createElement('iframe');
            frame.src = managerUrl;
            frame.title = 'TIDY 기능 및 JS JENA 관리';
            frame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
            dialog.appendChild(frame);
            document.body.appendChild(dialog);
        }
        installManagerResizeHandles(dialog);
        if (!dialog.open) {
            dialog.show();
            placeManagerDialog(dialog);
        }
        return true;
    }

    function configure(options) {
        deps = Object.assign({}, deps, options || {});
        configured = true;
        return refresh();
    }

    global.TidyScriptManager = {
        configure: configure,
        refresh: refresh,
        openManager: openManager,
        closeManager: function () { var dialog = document.getElementById('tidy-manager-dialog'); if (dialog) dialog.close(); },
        applyScript: applyScript,
        compileTransformer: compileTransformer,
        serializeGithubFile: serializeGithubFile,
        parseGithubFile: parseGithubFile
    };
    global.TidyScriptManagerBridge = {
        validate: compileTransformer,
        test: async function (code, source) {
            compileTransformer(code);
            var result = await runInWorker(code, source, { scope: 'document', hasSelection: false });
            var value = typeof result === 'string' ? result : result && result.value;
            if (typeof value !== 'string') throw new Error('변환 함수는 문자열 또는 { value: 문자열 }을 반환해야 합니다.');
            return value;
        },
        list: function () { return refresh(); },
        save: save,
        remove: remove,
        importSqlite: importSqlite,
        importGithub: importGithub,
        parseUpload: parseGithubFile,
        getStorageStatus: getStorageStatus
    };
})(window);

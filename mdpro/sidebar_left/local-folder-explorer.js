(function () {
    'use strict';

    const HANDLE_DB_NAME = 'md-viewer-local-folder';
    const HANDLE_STORE_NAME = 'handles';
    const HANDLE_KEY = 'active-root';
    const SEARCH_ENTRY_LIMIT = 5000;
    const SEARCH_DEPTH_LIMIT = 24;

    let rootHandle = null;
    let rootNode = null;
    let fallbackMode = false;
    let restorePromise = null;
    let searchWasTruncated = false;
    let selectedDirectoryPath = '';

    function notify(message) {
        if (typeof window.showToast === 'function') window.showToast(message);
    }

    function requestRender() {
        if (typeof window.renderDBList === 'function') window.renderDBList();
    }

    function compareNodes(a, b) {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    function makeNode(name, kind, handle, parent, file) {
        const parentPath = parent && parent.path ? parent.path : '';
        const path = parentPath ? parentPath + '/' + name : name;
        return {
            name: String(name || ''),
            kind: kind === 'directory' ? 'directory' : 'file',
            handle: handle || null,
            file: file || null,
            parent: parent || null,
            path: path,
            children: [],
            loaded: kind !== 'directory',
            expanded: false,
            error: ''
        };
    }

    function openHandleDb() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                resolve(null);
                return;
            }
            const request = indexedDB.open(HANDLE_DB_NAME, 1);
            request.onupgradeneeded = function () {
                const database = request.result;
                if (!database.objectStoreNames.contains(HANDLE_STORE_NAME)) {
                    database.createObjectStore(HANDLE_STORE_NAME);
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    async function readSavedHandle() {
        const database = await openHandleDb();
        if (!database) return null;
        return new Promise(function (resolve) {
            const request = database.transaction(HANDLE_STORE_NAME, 'readonly')
                .objectStore(HANDLE_STORE_NAME).get(HANDLE_KEY);
            request.onsuccess = function () { resolve(request.result || null); };
            request.onerror = function () { resolve(null); };
        });
    }

    async function saveHandle(handle) {
        try {
            const database = await openHandleDb();
            if (!database) return;
            await new Promise(function (resolve, reject) {
                const tx = database.transaction(HANDLE_STORE_NAME, 'readwrite');
                tx.objectStore(HANDLE_STORE_NAME).put(handle, HANDLE_KEY);
                tx.oncomplete = resolve;
                tx.onerror = function () { reject(tx.error); };
            });
        } catch (_) {
            // Some Chromium shells do not allow handle structured cloning.
        }
    }

    async function getPermission(handle, requestAccess, mode) {
        if (!handle) return 'denied';
        const permissionMode = mode === 'readwrite' ? 'readwrite' : 'read';
        try {
            let state = await handle.queryPermission({ mode: permissionMode });
            if (state === 'prompt' && requestAccess && typeof handle.requestPermission === 'function') {
                state = await handle.requestPermission({ mode: permissionMode });
            }
            return state;
        } catch (_) {
            return 'denied';
        }
    }

    async function readChildren(node) {
        if (!node || node.kind !== 'directory' || node.loaded || !node.handle) return node ? node.children : [];
        const children = [];
        try {
            for await (const entry of node.handle.values()) {
                children.push(makeNode(entry.name, entry.kind, entry, node, null));
            }
            children.sort(compareNodes);
            node.children = children;
            node.loaded = true;
            node.error = '';
        } catch (error) {
            node.loaded = true;
            node.error = error && error.message ? error.message : '폴더를 읽을 수 없습니다.';
        }
        return node.children;
    }

    async function installRootHandle(handle) {
        rootHandle = handle;
        fallbackMode = false;
        rootNode = makeNode(handle.name || '로컬 폴더', 'directory', handle, null, null);
        rootNode.expanded = true;
        selectedDirectoryPath = rootNode.path;
        await readChildren(rootNode);
    }

    async function restoreSavedHandle(requestAccess) {
        if (rootNode) return true;
        try {
            const saved = await readSavedHandle();
            if (!saved) return false;
            const permission = await getPermission(saved, !!requestAccess);
            if (permission !== 'granted') return false;
            await installRootHandle(saved);
            return true;
        } catch (_) {
            return false;
        }
    }

    function ensureRestored(requestAccess) {
        if (rootNode) return Promise.resolve(true);
        if (!restorePromise || requestAccess) restorePromise = restoreSavedHandle(!!requestAccess);
        return restorePromise;
    }

    function pickFallbackFolder() {
        return new Promise(function (resolve) {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.className = 'hidden';
            document.body.appendChild(input);
            let settled = false;
            const finish = function (value) {
                if (settled) return;
                settled = true;
                input.remove();
                resolve(value);
            };
            input.addEventListener('change', function () {
                const files = Array.from(input.files || []);
                if (!files.length) {
                    finish(false);
                    return;
                }
                buildFallbackTree(files);
                finish(true);
            }, { once: true });
            input.addEventListener('cancel', function () { finish(false); }, { once: true });
            input.click();
        });
    }

    function buildFallbackTree(files) {
        const firstPath = String(files[0] && files[0].webkitRelativePath || files[0].name || '로컬 폴더');
        const rootName = firstPath.split('/').filter(Boolean)[0] || '로컬 폴더';
        rootHandle = null;
        fallbackMode = true;
        rootNode = makeNode(rootName, 'directory', null, null, null);
        rootNode.loaded = true;
        rootNode.expanded = true;
        selectedDirectoryPath = rootNode.path;

        files.forEach(function (file) {
            const fullParts = String(file.webkitRelativePath || file.name || '').split('/').filter(Boolean);
            const parts = fullParts[0] === rootName ? fullParts.slice(1) : fullParts;
            let parent = rootNode;
            parts.slice(0, -1).forEach(function (folderName) {
                let folder = parent.children.find(function (item) {
                    return item.kind === 'directory' && item.name === folderName;
                });
                if (!folder) {
                    folder = makeNode(folderName, 'directory', null, parent, null);
                    folder.loaded = true;
                    parent.children.push(folder);
                }
                parent = folder;
            });
            const fileName = parts[parts.length - 1] || file.name;
            parent.children.push(makeNode(fileName, 'file', null, parent, file));
        });

        (function sortTree(node) {
            node.children.sort(compareNodes);
            node.children.filter(function (child) { return child.kind === 'directory'; }).forEach(sortTree);
        })(rootNode);
    }

    async function chooseFolder() {
        try {
            if (typeof window.showDirectoryPicker === 'function') {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await installRootHandle(handle);
                await saveHandle(handle);
                notify('로컬 폴더를 열었습니다: ' + rootNode.name);
                requestRender();
                return true;
            }
            const picked = await pickFallbackFolder();
            if (picked) {
                notify('로컬 폴더를 열었습니다: ' + rootNode.name);
                requestRender();
            }
            return picked;
        } catch (error) {
            if (error && error.name === 'AbortError') return false;
            notify('로컬 폴더를 열 수 없습니다: ' + (error && error.message ? error.message : error));
            return false;
        }
    }

    async function activate(options) {
        const opts = options || {};
        await ensureRestored(true);
        if (rootNode) return true;
        return opts.pickIfNeeded === false ? false : chooseFolder();
    }

    async function refresh() {
        if (!rootNode) return chooseFolder();
        if (fallbackMode) {
            notify('폴더를 다시 선택하면 최신 파일 목록을 불러옵니다.');
            return chooseFolder();
        }
        const permission = await getPermission(rootHandle, true);
        if (permission !== 'granted') {
            notify('폴더 읽기 권한이 필요합니다.');
            return false;
        }
        rootNode.loaded = false;
        rootNode.children = [];
        await readChildren(rootNode);
        requestRender();
        if (typeof window.refreshCurrentLocalFileFromDisk === 'function') {
            await window.refreshCurrentLocalFileFromDisk();
        }
        return true;
    }

    async function scanForSearch(node, counter, depth) {
        if (!node || node.kind !== 'directory') return;
        if (counter.count >= SEARCH_ENTRY_LIMIT || depth > SEARCH_DEPTH_LIMIT) {
            searchWasTruncated = true;
            return;
        }
        await readChildren(node);
        for (let i = 0; i < node.children.length; i += 1) {
            counter.count += 1;
            if (counter.count >= SEARCH_ENTRY_LIMIT) {
                searchWasTruncated = true;
                return;
            }
            if (node.children[i].kind === 'directory') {
                await scanForSearch(node.children[i], counter, depth + 1);
            }
        }
    }

    function nodeMatchesSearch(node, query) {
        if (!query) return true;
        if (String(node.name || '').toLocaleLowerCase().includes(query)) return true;
        return node.kind === 'directory' && node.children.some(function (child) {
            return nodeMatchesSearch(child, query);
        });
    }

    function iconForFile(name) {
        const extension = String(name || '').toLowerCase().split('.').pop();
        if (['md', 'mdown', 'markdown', 'txt'].includes(extension)) return 'file-text';
        if (['html', 'htm', 'css', 'js', 'json', 'xml', 'csv'].includes(extension)) return 'file-code-2';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'].includes(extension)) return 'file-image';
        if (extension === 'pdf') return 'file-type-2';
        return 'file';
    }

    async function openNodeFile(node, button) {
        if (!node || node.kind !== 'file') return;
        if (button) button.classList.add('opacity-50');
        try {
            const file = node.file || (node.handle && await node.handle.getFile());
            if (!file) throw new Error('파일을 읽을 수 없습니다.');
            if (typeof window.openFileFromLocalFolderExplorer !== 'function') {
                throw new Error('문서 열기 기능이 준비되지 않았습니다.');
            }
            await window.openFileFromLocalFolderExplorer(file, node.path, node.handle);
        } catch (error) {
            notify('파일을 열 수 없습니다: ' + (error && error.message ? error.message : error));
        } finally {
            if (button) button.classList.remove('opacity-50');
        }
    }

    function resolveProjectFilePath(documentPath, requestUrl) {
        if (!rootNode) return null;
        const rawUrl = String(requestUrl || '').trim();
        if (!rawUrl
            || rawUrl.charAt(0) === '#'
            || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(rawUrl)) return null;

        let assetPath = rawUrl.split('#')[0].split('?')[0];
        try { assetPath = decodeURIComponent(assetPath); } catch (_) {}
        assetPath = assetPath.replace(/\\/g, '/');

        const rootName = String(rootNode.name || '');
        let documentParts = String(documentPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
        if (documentParts[0] === rootName) documentParts = documentParts.slice(1);
        const parts = assetPath.charAt(0) === '/' ? [] : documentParts.slice(0, -1);

        const requestedParts = assetPath.split('/');
        for (let i = 0; i < requestedParts.length; i += 1) {
            const part = requestedParts[i];
            if (!part || part === '.') continue;
            if (part === '..') {
                if (!parts.length) return null;
                parts.pop();
                continue;
            }
            parts.push(part);
        }
        if (!parts.length) return null;
        return {
            parts: parts,
            path: (rootName ? rootName + '/' : '') + parts.join('/')
        };
    }

    async function getProjectFile(documentPath, requestUrl) {
        await ensureRestored(false);
        const resolved = resolveProjectFilePath(documentPath, requestUrl);
        if (!resolved || !rootNode) return null;

        if (rootHandle) {
            try {
                let directoryHandle = rootHandle;
                for (let i = 0; i < resolved.parts.length - 1; i += 1) {
                    directoryHandle = await directoryHandle.getDirectoryHandle(resolved.parts[i]);
                }
                const handle = await directoryHandle.getFileHandle(resolved.parts[resolved.parts.length - 1]);
                return { file: await handle.getFile(), handle: handle, path: resolved.path };
            } catch (_) {
                return null;
            }
        }

        let node = rootNode;
        for (let i = 0; i < resolved.parts.length; i += 1) {
            await readChildren(node);
            node = node.children.find(function (child) { return child.name === resolved.parts[i]; });
            if (!node) return null;
            if (i < resolved.parts.length - 1 && node.kind !== 'directory') return null;
        }
        if (!node || node.kind !== 'file') return null;
        const file = node.file || (node.handle && await node.handle.getFile());
        return file ? { file: file, handle: node.handle || null, path: resolved.path } : null;
    }

    function makeIcon(name, className) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', name);
        icon.className = className || 'h-4 w-4 shrink-0';
        return icon;
    }

    function findDirectoryByPath(node, path) {
        if (!node || node.kind !== 'directory') return null;
        if (node.path === path) return node;
        for (let i = 0; i < node.children.length; i += 1) {
            const found = findDirectoryByPath(node.children[i], path);
            if (found) return found;
        }
        return null;
    }

    function getSelectedDirectory() {
        return findDirectoryByPath(rootNode, selectedDirectoryPath) || rootNode;
    }

    function selectDirectory(node) {
        if (!node || node.kind !== 'directory') return;
        selectedDirectoryPath = node.path;
        requestRender();
    }

    function normalizeEntryName(value, kind) {
        let name = String(value == null ? '' : value).trim();
        if (!name) return '';
        if (kind === 'file' && !/\.[^./\\]+$/.test(name)) name += '.md';
        if (name === '.' || name === '..'
            || /[<>:"/\\|?*\u0000-\u001f]/.test(name)
            || /[. ]$/.test(name)
            || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
            throw new Error('이름에 사용할 수 없는 문자 또는 형식이 포함되어 있습니다.');
        }
        return name;
    }

    async function ensureDirectoryWriteAccess(node) {
        if (!node || !node.handle || fallbackMode) {
            throw new Error('이 브라우저에서는 선택한 폴더를 읽기만 할 수 있습니다. Chrome 또는 Edge에서 폴더를 다시 선택해 주세요.');
        }
        const permission = await getPermission(node.handle, true, 'readwrite');
        if (permission !== 'granted') throw new Error('파일과 폴더를 만들려면 쓰기 권한이 필요합니다.');
    }

    async function entryExists(directoryHandle, name) {
        const normalizedName = String(name || '').toLocaleLowerCase();
        for await (const entry of directoryHandle.values()) {
            if (String(entry.name || '').toLocaleLowerCase() === normalizedName) return true;
        }
        return false;
    }

    async function reloadDirectory(node) {
        node.loaded = false;
        node.children = [];
        node.expanded = true;
        await readChildren(node);
        requestRender();
    }

    async function createFile(node) {
        const directory = node && node.kind === 'directory' ? node : getSelectedDirectory();
        if (!directory) {
            notify('먼저 로컬 폴더를 선택해 주세요.');
            return false;
        }
        const input = window.prompt('새 파일 이름 (.md 자동 추가)', 'untitled.md');
        if (input == null) return false;
        try {
            const name = normalizeEntryName(input, 'file');
            if (!name) return false;
            await ensureDirectoryWriteAccess(directory);
            if (await entryExists(directory.handle, name)) throw new Error('같은 이름의 파일 또는 폴더가 이미 있습니다.');
            const fileHandle = await directory.handle.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write('');
            await writable.close();
            await reloadDirectory(directory);
            const createdNode = directory.children.find(function (child) {
                return child.kind === 'file' && child.name === name;
            });
            notify('파일을 만들었습니다: ' + name);
            if (createdNode) await openNodeFile(createdNode, null);
            return true;
        } catch (error) {
            notify('파일을 만들 수 없습니다: ' + (error && error.message ? error.message : error));
            return false;
        }
    }

    async function createFolder(node) {
        const directory = node && node.kind === 'directory' ? node : getSelectedDirectory();
        if (!directory) {
            notify('먼저 로컬 폴더를 선택해 주세요.');
            return false;
        }
        const input = window.prompt('새 폴더 이름', '새 폴더');
        if (input == null) return false;
        try {
            const name = normalizeEntryName(input, 'directory');
            if (!name) return false;
            await ensureDirectoryWriteAccess(directory);
            if (await entryExists(directory.handle, name)) throw new Error('같은 이름의 파일 또는 폴더가 이미 있습니다.');
            await directory.handle.getDirectoryHandle(name, { create: true });
            await reloadDirectory(directory);
            notify('폴더를 만들었습니다: ' + name);
            return true;
        } catch (error) {
            notify('폴더를 만들 수 없습니다: ' + (error && error.message ? error.message : error));
            return false;
        }
    }

    function renderTreeNode(node, depth, container, query) {
        if (!nodeMatchesSearch(node, query)) return;
        const row = document.createElement('div');
        row.className = 'group flex min-w-0 items-center gap-1 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800';
        row.style.paddingLeft = Math.min(12 + depth * 14, 180) + 'px';
        row.dataset.localFolderPath = node.path;

        if (node.kind === 'directory') {
            if (node.path === selectedDirectoryPath) {
                row.classList.add('bg-indigo-100', 'text-indigo-800', 'dark:bg-indigo-950/60', 'dark:text-indigo-200');
            }
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-300 dark:hover:bg-slate-700';
            const expanded = query ? true : node.expanded;
            toggle.title = expanded ? '폴더 접기' : '폴더 펼치기';
            toggle.appendChild(makeIcon(expanded ? 'chevron-down' : 'chevron-right', 'h-3.5 w-3.5'));
            toggle.onclick = async function () {
                node.expanded = !node.expanded;
                if (node.expanded) await readChildren(node);
                requestRender();
            };
            row.appendChild(toggle);
            row.appendChild(makeIcon(expanded ? 'folder-open' : 'folder', 'h-4 w-4 shrink-0 text-amber-500'));
            const label = document.createElement('span');
            label.className = 'min-w-0 flex-1 truncate font-semibold';
            label.textContent = node.name;
            label.title = node.path;
            label.setAttribute('role', 'button');
            label.setAttribute('tabindex', '0');
            label.setAttribute('aria-pressed', node.path === selectedDirectoryPath ? 'true' : 'false');
            label.onclick = function () { selectDirectory(node); };
            label.onkeydown = function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectDirectory(node);
                }
            };
            label.ondblclick = function () { toggle.click(); };
            row.appendChild(label);
            container.appendChild(row);

            if (node.error) {
                const error = document.createElement('div');
                error.className = 'py-1 pr-2 text-[10px] text-red-500';
                error.style.paddingLeft = Math.min(42 + depth * 14, 210) + 'px';
                error.textContent = node.error;
                container.appendChild(error);
            }
            if (expanded && node.loaded && !node.children.length && !node.error) {
                const empty = document.createElement('div');
                empty.className = 'py-1 pr-2 text-[10px] italic text-slate-400';
                empty.style.paddingLeft = Math.min(42 + depth * 14, 210) + 'px';
                empty.textContent = '빈 폴더';
                container.appendChild(empty);
            }
            if (expanded) node.children.forEach(function (child) {
                renderTreeNode(child, depth + 1, container, query);
            });
            return;
        }

        const spacer = document.createElement('span');
        spacer.className = 'inline-block h-5 w-5 shrink-0';
        row.appendChild(spacer);
        row.appendChild(makeIcon(iconForFile(node.name), 'h-4 w-4 shrink-0 text-sky-500'));
        const fileButton = document.createElement('button');
        fileButton.type = 'button';
        fileButton.className = 'min-w-0 flex-1 truncate text-left';
        fileButton.textContent = node.name;
        fileButton.title = '열기: ' + node.path;
        fileButton.onclick = function () { openNodeFile(node, fileButton); };
        row.appendChild(fileButton);
        container.appendChild(row);
    }

    function renderEmpty(container) {
        const wrap = document.createElement('div');
        wrap.className = 'flex flex-col items-center gap-3 px-4 py-10 text-center';
        wrap.appendChild(makeIcon('folder-open', 'h-10 w-10 text-amber-500'));
        const title = document.createElement('p');
        title.className = 'text-sm font-bold text-slate-700 dark:text-slate-200';
        title.textContent = '로컬 폴더 열기';
        wrap.appendChild(title);
        const detail = document.createElement('p');
        detail.className = 'text-[11px] leading-relaxed text-slate-500 dark:text-slate-400';
        detail.textContent = '내 컴퓨터의 폴더를 선택하면 이곳에 탐색기 형태로 표시됩니다.';
        wrap.appendChild(detail);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700';
        button.textContent = '폴더 선택';
        button.onclick = chooseFolder;
        wrap.appendChild(button);
        container.appendChild(wrap);
    }

    async function render(container, searchTerm) {
        if (!container) return;
        await ensureRestored(false);
        if (!rootNode) {
            renderEmpty(container);
            return;
        }

        const query = String(searchTerm || '').trim().toLocaleLowerCase();
        searchWasTruncated = false;
        if (query) await scanForSearch(rootNode, { count: 0 }, 0);

        const header = document.createElement('div');
        header.className = 'sticky top-0 z-10 mb-1 flex items-center gap-1 border-b border-slate-200 bg-slate-100 px-2 py-2 dark:border-slate-700 dark:bg-slate-900';
        header.appendChild(makeIcon('hard-drive', 'h-4 w-4 shrink-0 text-indigo-500'));
        const title = document.createElement('strong');
        title.className = 'min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200';
        title.textContent = rootNode.name;
        const selectedDirectory = getSelectedDirectory();
        title.title = '생성 위치: ' + (selectedDirectory ? selectedDirectory.path : rootNode.name);
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        title.setAttribute('aria-label', '루트 폴더를 생성 위치로 선택');
        title.onclick = function () { selectDirectory(rootNode); };
        title.onkeydown = function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectDirectory(rootNode);
            }
        };
        header.appendChild(title);

        const createFileButton = document.createElement('button');
        createFileButton.type = 'button';
        createFileButton.id = 'local-folder-new-file';
        createFileButton.className = 'inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700';
        createFileButton.title = fallbackMode ? '읽기 전용 모드에서는 파일을 만들 수 없습니다.' : '선택한 폴더에 새 파일 만들기';
        createFileButton.setAttribute('aria-label', '선택한 폴더에 새 파일 만들기');
        createFileButton.disabled = fallbackMode;
        createFileButton.appendChild(makeIcon('file-plus-2', 'h-3.5 w-3.5'));
        createFileButton.onclick = function () { createFile(); };
        header.appendChild(createFileButton);

        const createFolderButton = document.createElement('button');
        createFolderButton.type = 'button';
        createFolderButton.id = 'local-folder-new-folder';
        createFolderButton.className = 'inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700';
        createFolderButton.title = fallbackMode ? '읽기 전용 모드에서는 폴더를 만들 수 없습니다.' : '선택한 폴더에 새 폴더 만들기';
        createFolderButton.setAttribute('aria-label', '선택한 폴더에 새 폴더 만들기');
        createFolderButton.disabled = fallbackMode;
        createFolderButton.appendChild(makeIcon('folder-plus', 'h-3.5 w-3.5'));
        createFolderButton.onclick = function () { createFolder(); };
        header.appendChild(createFolderButton);

        const refreshButton = document.createElement('button');
        refreshButton.type = 'button';
        refreshButton.className = 'inline-flex h-7 w-7 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700';
        refreshButton.title = '새로고침';
        refreshButton.appendChild(makeIcon('refresh-cw', 'h-3.5 w-3.5'));
        refreshButton.onclick = refresh;
        header.appendChild(refreshButton);

        const changeButton = document.createElement('button');
        changeButton.type = 'button';
        changeButton.className = 'rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold hover:bg-slate-200 dark:border-slate-600 dark:hover:bg-slate-700';
        changeButton.textContent = '변경';
        changeButton.title = '다른 로컬 폴더 선택';
        changeButton.onclick = chooseFolder;
        header.appendChild(changeButton);
        container.appendChild(header);

        const tree = document.createElement('div');
        tree.className = 'pb-2';
        rootNode.children.forEach(function (child) { renderTreeNode(child, 0, tree, query); });
        if (!tree.childNodes.length) {
            const empty = document.createElement('div');
            empty.className = 'px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400';
            empty.textContent = query ? '검색 결과가 없습니다.' : '이 폴더는 비어 있습니다.';
            tree.appendChild(empty);
        }
        container.appendChild(tree);

        if (searchWasTruncated) {
            const status = document.createElement('div');
            status.className = 'border-t border-amber-200 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-900 dark:text-amber-300';
            status.textContent = '검색 범위가 커서 처음 ' + SEARCH_ENTRY_LIMIT + '개 항목만 확인했습니다.';
            container.appendChild(status);
        }
    }

    window.LocalFolderExplorer = {
        activate: activate,
        chooseFolder: chooseFolder,
        refresh: refresh,
        render: render,
        createFile: createFile,
        createFolder: createFolder,
        getProjectFile: getProjectFile,
        resolveProjectFilePath: resolveProjectFilePath,
        getRootName: function () { return rootNode ? rootNode.name : ''; },
        getRootHandle: function () { return rootHandle || null; },
        hasFolder: function () { return !!rootNode; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { ensureRestored(false); }, { once: true });
    } else {
        ensureRestored(false);
    }
})();

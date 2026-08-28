(function () {
    'use strict';
    const embedded = new URLSearchParams(location.search).get('webdav') === '1';
    if (!embedded) return;

    function requestExplorer() {
        window.parent.postMessage({ type: 'webdav-toggle-explorer' }, location.origin);
    }

    function publishTheme() {
        window.parent.postMessage({
            type: 'mdpro-theme-changed',
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
        }, location.origin);
    }

    function installUi() {
        const exportButton = document.getElementById('header-export-file-button');
        if (exportButton && !document.getElementById('header-webdav-save-button')) {
            const wrap = document.createElement('div');
            wrap.id = 'webdav-save-dropdown-wrap';
            wrap.className = 'relative flex shrink-0';
            const button = document.createElement('button');
            button.id = 'header-webdav-save-button';
            button.type = 'button';
            button.className = 'p-1.5 sm:p-2 hover:bg-white/15 rounded-l-md transition-colors text-white flex items-center gap-1 shrink-0';
            button.title = '현재 문서를 WebDAV 원본 위치에 저장';
            button.innerHTML = '<i data-lucide="cloud-upload" class="w-[18px] h-[18px] sm:w-5 sm:h-5"></i><span class="header-file-action-label text-sm font-bold">WDsave</span>';
            button.addEventListener('click', function () {
                if (typeof window.saveCurrentDocumentToWebDav === 'function') {
                    window.saveCurrentDocumentToWebDav();
                } else if (typeof window.showToast === 'function') {
                    window.showToast('WDsave 기능을 불러오지 못했습니다.', 'error');
                }
            });
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'px-1 sm:px-1.5 hover:bg-white/15 text-white rounded-r-md transition-colors flex items-center';
            toggle.title = 'WebDAV 저장 메뉴';
            toggle.setAttribute('aria-label', 'WebDAV 저장 메뉴');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.innerHTML = '<i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>';
            const menu = document.createElement('div');
            menu.id = 'webdav-save-dropdown-menu';
            menu.className = 'hidden absolute z-[90] right-0 top-[calc(100%+6px)] min-w-40 p-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl';
            menu.innerHTML = '<button type="button" class="w-full px-3 py-2 rounded flex items-center gap-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"><i data-lucide="cloud-upload" class="w-4 h-4"></i><span>WDSaveAs</span></button>';
            toggle.addEventListener('click', function (event) {
                event.stopPropagation();
                const opening = menu.classList.contains('hidden');
                menu.classList.toggle('hidden', !opening);
                toggle.setAttribute('aria-expanded', String(opening));
            });
            menu.querySelector('button').addEventListener('click', function () {
                menu.classList.add('hidden');
                toggle.setAttribute('aria-expanded', 'false');
                if (typeof window.saveCurrentDocumentToWebDavAs === 'function') window.saveCurrentDocumentToWebDavAs();
            });
            document.addEventListener('click', function (event) {
                if (!wrap.contains(event.target)) {
                    menu.classList.add('hidden');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
            wrap.append(button, toggle, menu);
            exportButton.insertAdjacentElement('afterend', wrap);
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !document.getElementById('mdpro-webdav-sidebar-button')) {
            const button = document.createElement('button');
            button.id = 'mdpro-webdav-sidebar-button';
            button.type = 'button';
            button.className = 'mdpro-webdav-sidebar-button';
            button.innerHTML = '<span aria-hidden="true">☁</span><span>WebDAV</span>';
            button.title = 'WebDAV 탐색기 열기/접기';
            button.addEventListener('click', requestExplorer);
            sidebar.prepend(button);
        }
        const settings = document.getElementById('settings-modal-body');
        if (settings && !document.getElementById('webdav-settings-card')) {
            const card = document.createElement('div');
            card.id = 'webdav-settings-card';
            card.className = 'rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-3';
            card.innerHTML = '<div class="flex items-center justify-between gap-3"><div><strong class="text-sm text-slate-800 dark:text-slate-100">WebDAV</strong><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">WDsave는 WebDAV 원본 경로에 저장합니다. 내보내기는 기존 파일 내보내기 기능을 유지합니다.</p></div><button type="button" id="webdav-settings-open" class="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">탐색기 열기</button></div>';
            settings.prepend(card);
            card.querySelector('#webdav-settings-open').addEventListener('click', requestExplorer);
        }
    }

    function applyEmbeddedDefaultLayout() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && getComputedStyle(sidebar).display !== 'none' && typeof window.toggleSidebarVisibility === 'function') {
            window.toggleSidebarVisibility();
        }
        const editButton = document.querySelector('[onclick*="toggleMode"][onclick*="edit"]');
        if (editButton && editButton.getAttribute('aria-pressed') === 'false') editButton.click();
    }

    async function openImageInsertFromFma(image) {
        const src = String(image && image.src || '');
        if (!src) return;
        const response = await fetch(src);
        if (!response.ok) throw new Error('FMA 이미지를 읽지 못했습니다.');
        const blob = await response.blob();
        const dataUrl = await new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(reader.error || new Error('이미지 변환 실패')); };
            reader.readAsDataURL(blob);
        });
        try {
            if (typeof isEditMode !== 'undefined' && !isEditMode && typeof toggleMode === 'function') {
                toggleMode('edit');
            }
        } catch (_) {}
        if (typeof window.openImageInsertModal !== 'function' || typeof window.applyImageInsertDataUrl !== 'function') {
            throw new Error('왼쪽 문서의 IMG 기능이 아직 준비되지 않았습니다.');
        }
        window.openImageInsertModal();
        if (typeof window.applyImageInsertDataUrl === 'function') {
            window.applyImageInsertDataUrl(dataUrl, String(image.name || 'fma-image.png'));
        }
        if (typeof window.setImageInsertStatus === 'function') {
            window.setImageInsertStatus('FMA 이미지가 IMG로 전달되었습니다. 저장 방식을 선택한 뒤 문서에 삽입하세요.', false);
        }
    }

    window.addEventListener('message', function (event) {
        const data = event.data;
        if (event.source !== window.parent || event.origin !== location.origin) return;
        if (data?.type === 'webdav-open-image-insert') {
            openImageInsertFromFma(data.image).catch(function (error) {
                if (typeof window.showToast === 'function') window.showToast(error.message || String(error), 'error');
            });
            return;
        }
        if (data?.type !== 'webdav-open-document') return;
        window.__webdavHostDocument = { path: String(data.path || ''), fileName: String(data.fileName || 'document.md') };
        if (data.binaryContent && /\.docx$/i.test(window.__webdavHostDocument.fileName) && typeof window.openDocxInEditor === 'function') {
            const file = new File([data.binaryContent], window.__webdavHostDocument.fileName, {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            window.openDocxInEditor(file, {
                skipSavePrompt: true,
                source: 'webdav-dmerge',
                successMessage: 'DMerge 묶음의 DOCX 문서를 열었습니다.'
            });
            return;
        }
        if (typeof window.loadFromExternalContent === 'function') {
            window.loadFromExternalContent(String(data.content ?? ''), window.__webdavHostDocument.fileName, { notebookLmSeparators: false });
            if (typeof window.showToast === 'function') window.showToast('WebDAV 문서를 MDPRO로 열었습니다.');
        }
    });
    window.addEventListener('DOMContentLoaded', installUi, { once: true });
    window.addEventListener('DOMContentLoaded', publishTheme, { once: true });
    new MutationObserver(publishTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setTimeout(installUi, 800);
    setTimeout(applyEmbeddedDefaultLayout, 850);
    setTimeout(publishTheme, 100);
    window.parent.postMessage({ type: 'mdpro-ready' }, location.origin);
})();

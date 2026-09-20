// Image insert/upload/gallery logic moved from js/app.js
function insertMarkdownImageAtCursor(imageUrl, altText) {
    if (!isEditMode) {
        showToast('Use this in edit mode.');
        return;
    }
    const u = String(imageUrl || '').trim();
    if (!u) {
        showToast('Enter an image URL.');
        return;
    }
    const alt = String(altText || 'image').trim().replace(/[\[\]]/g, '') || 'image';
    const md = '![' + alt + '](' + u + ')';
    const ta = editorTextarea;
    const scrollTop = ta.scrollTop;
    ta.focus();
    document.execCommand('insertText', false, md);
    currentMarkdown = ta.value;
    ta.scrollTop = scrollTop;
    performAutoSave();
    if (activeSidebarTab === 'toc') renderTOC();
    showToast('Markdown image inserted.');
}

function insertHtmlImageAtCursor(imageUrl, altText) {
    if (!isEditMode) {
        showToast('Use this in edit mode.');
        return;
    }
    const u = String(imageUrl || '').trim();
    if (!u) {
        showToast('Enter an image URL.');
        return;
    }
    const alt = String(altText || 'image')
        .trim()
        .replace(/"/g, '&quot;')
        .replace(/[<>]/g, '') || 'image';
    const html = '<img src="' + u + '" alt="' + alt + '" border="0" />';
    const ta = editorTextarea;
    const scrollTop = ta.scrollTop;
    ta.focus();
    document.execCommand('insertText', false, html);
    currentMarkdown = ta.value;
    ta.scrollTop = scrollTop;
    performAutoSave();
    if (activeSidebarTab === 'toc') renderTOC();
    showToast('HTML image tag inserted.');
}

function getImageAltTextFromUrl(imageUrl) {
    const u = String(imageUrl || '').trim();
    if (!u) return 'image';
    try {
        const path = u.split('?')[0].split('#')[0];
        const name = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1) || 'image')
            .replace(/\.[^.]+$/, '')
            .trim();
        return name || 'image';
    } catch (e) {
        return 'image';
    }
}

function setImageInsertStatus(msg, isError) {
    const el = document.getElementById('img-insert-status');
    if (!el) return;
    el.textContent = String(msg || '');
    el.className = 'mt-3 text-xs ' + (isError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400');
}

function setImageUploadProgress(pct, active) {
    const wrap = document.getElementById('img-insert-progress-wrap');
    const fill = document.getElementById('img-insert-progress-fill');
    const text = document.getElementById('img-insert-progress-text');
    if (!wrap || !fill || !text) return;
    const safe = Math.max(0, Math.min(100, Number(pct) || 0));
    fill.style.width = safe + '%';
    text.textContent = safe + '%';
    if (active) wrap.classList.remove('hidden');
    else if (safe >= 100 || safe <= 0) setTimeout(function () { wrap.classList.add('hidden'); }, 700);
}

function setImageInsertPreview(dataUrl) {
    const img = document.getElementById('img-insert-preview');
    if (!img) return;
    if (!dataUrl) {
        img.classList.add('hidden');
        img.removeAttribute('src');
        return;
    }
    img.src = dataUrl;
    img.classList.remove('hidden');
}

function applyImageInsertDataUrl(dataUrl, fileName) {
    const value = String(dataUrl || '');
    if (value.indexOf('data:image') !== 0) return false;
    imageInsertCurrentDataUrl = value;
    imageInsertCurrentFileName = fileName || ('sketch_' + Date.now() + '.png');
    clearImageInsertInternalSavedState();
    imageInsertChangedByCrop = false;
    setImageInsertPreview(value);
    renderImageInsertInternalInfo();
    const input = document.getElementById('img-insert-url');
    if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setImageInsertStatus('Sketchpad image loaded. You can crop, upload, save internally, or insert it.', false);
    return true;
}

function revokeImageInsertGalleryObjectUrls() {
    if (!Array.isArray(imageInsertGalleryObjectUrls) || imageInsertGalleryObjectUrls.length === 0) return;
    imageInsertGalleryObjectUrls.forEach(function (u) {
        try { URL.revokeObjectURL(u); } catch (e) {}
    });
    imageInsertGalleryObjectUrls = [];
}

function setImageInsertGalleryToggleActive(active) {
    const btn = document.getElementById('img-insert-gallery-toggle');
    if (!btn) return;
    if (active) {
        btn.classList.add('ring-2', 'ring-fuchsia-300');
    } else {
        btn.classList.remove('ring-2', 'ring-fuchsia-300');
    }
}

function blobToDataUrlForImageInsert(blob) {
    return new Promise(function (resolve, reject) {
        const r = new FileReader();
        r.onload = function () { resolve(String(r.result || '')); };
        r.onerror = function () { reject(r.error || new Error('Failed to read blob')); };
        r.readAsDataURL(blob);
    });
}

async function ensureImageInsertDataUrlFromInternalSelection() {
    if (imageInsertCurrentDataUrl && imageInsertCurrentDataUrl.indexOf('data:image') === 0) return true;
    if (!db || !window.ImageDB || typeof window.ImageDB.getImage !== 'function') return false;
    const id = String(imageInsertSavedInternalId || '').trim();
    if (!id) return false;
    const rec = await window.ImageDB.getImage(db, id);
    if (!rec || !rec.blob) return false;
    const dataUrl = await blobToDataUrlForImageInsert(rec.blob);
    if (!dataUrl || dataUrl.indexOf('data:image') !== 0) return false;
    imageInsertCurrentDataUrl = dataUrl;
    imageInsertCurrentFileName = rec.name || ('gallery_' + id + '.png');
    setImageInsertPreview(dataUrl);
    return true;
}

async function getImageInsertGalleryDataUrl(id, blob) {
    const key = String(id || '').trim();
    if (!key || !blob) return '';
    if (imageInsertGalleryDataUrlCache.has(key)) return imageInsertGalleryDataUrlCache.get(key) || '';
    const dataUrl = await blobToDataUrlForImageInsert(blob);
    imageInsertGalleryDataUrlCache.set(key, dataUrl);
    return dataUrl;
}

async function syncImageInsertFullscreenGallery(items, currentId, currentDataUrl) {
    if (typeof window.viewerSSPSetFullscreenGallery !== 'function') return;
    const src = Array.isArray(items) ? items : [];
    const list = src
        .filter(function (it) { return it && it.blob && String(it.id || '').trim(); })
        .slice(0, 80);
    if (!list.length) {
        window.viewerSSPSetFullscreenGallery([], '');
        return;
    }
    const entries = [];
    for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const id = String(it.id || '').trim();
        let dataUrl = '';
        if (id === currentId && currentDataUrl && currentDataUrl.indexOf('data:image') === 0) dataUrl = currentDataUrl;
        else {
            try { dataUrl = await getImageInsertGalleryDataUrl(id, it.blob); } catch (e) { dataUrl = ''; }
        }
        if (!dataUrl || dataUrl.indexOf('data:image') !== 0) continue;
        entries.push({
            id: 'idb_' + encodeURIComponent(id),
            dataURL: dataUrl,
            prompt: String(it.name || id),
            createdAt: Number(it.createdAt || Date.now())
        });
    }
    window.viewerSSPSetFullscreenGallery(entries, currentDataUrl || '');
}

function openImageInsertGalleryFullscreen(src) {
    const safeSrc = String(src || '').trim();
    if (!safeSrc) return;
    if (typeof window.viewerSSPOpenFullscreen === 'function') {
        window.viewerSSPOpenFullscreen(safeSrc);
        return;
    }
    try {
        window.open(safeSrc, '_blank', 'noopener,noreferrer');
    } catch (e) {}
}

async function loadImageInsertGallery() {
    const panel = document.getElementById('img-insert-gallery-panel');
    const list = document.getElementById('img-insert-gallery-list');
    if (!panel || !list) return;
    if (!db) {
        list.innerHTML = '<div class="text-xs text-red-500">DB not ready.</div>';
        return;
    }

    revokeImageInsertGalleryObjectUrls();
    list.innerHTML = '<div class="text-xs text-slate-500">불러오는 중...</div>';

    try {
        const items = await new Promise(function (resolve, reject) {
            const tx = db.transaction('images', 'readonly');
            const req = tx.objectStore('images').getAll();
            req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
            req.onerror = function () { reject(req.error || new Error('Failed to load images')); };
        });

        items.sort(function (a, b) { return Number(b && b.createdAt || 0) - Number(a && a.createdAt || 0); });

        if (!items.length) {
            list.innerHTML = '<div class="text-xs text-slate-500">IndexedDB 이미지가 없습니다.</div>';
            return;
        }

        const html = [];
        items.forEach(function (it, idx) {
            const id = String(it && it.id || '').trim();
            if (!id || !it.blob) return;
            const objectUrl = URL.createObjectURL(it.blob);
            imageInsertGalleryObjectUrls.push(objectUrl);
            const title = String(it.name || id).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html.push(
                '<button type="button" class="img-gallery-item rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-1 text-left" data-idx="' + idx + '" data-id="' + encodeURIComponent(id) + '" title="' + title + '">' +
                '<img src="' + objectUrl + '" class="w-full h-20 object-contain rounded bg-slate-100 dark:bg-slate-900">' +
                '<div class="mt-1 text-[10px] text-slate-600 dark:text-slate-300 truncate">' + title + '</div>' +
                '</button>'
            );
        });
        list.innerHTML = html.join('');

        Array.from(list.querySelectorAll('.img-gallery-item')).forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const encId = String(btn.getAttribute('data-id') || '');
                const id = decodeURIComponent(encId);
                const target = items.find(function (x) { return String(x && x.id || '') === id; });
                if (!target) return;

                const internalUrl = (window.ImageDB && typeof window.ImageDB.internalUrlFromId === 'function')
                    ? window.ImageDB.internalUrlFromId(id)
                    : ('internal://' + encodeURIComponent(id));

                const input = document.getElementById('img-insert-url');
                if (input) input.value = internalUrl;
                imageInsertSavedInternalId = id;
                imageInsertSavedInternalUrl = internalUrl;
                imageInsertSavedFingerprint = '';
                renderImageInsertInternalInfo();

                try {
                    const dataUrl = await getImageInsertGalleryDataUrl(id, target.blob);
                    imageInsertCurrentDataUrl = dataUrl;
                    imageInsertCurrentFileName = target.name || ('gallery_' + id + '.png');
                    setImageInsertPreview(dataUrl);

                    if (typeof window.viewerSSPSetFullscreenGallery === 'function') {
                        window.viewerSSPSetFullscreenGallery([{
                            id: 'idb_' + encodeURIComponent(id),
                            dataURL: dataUrl,
                            prompt: String(target.name || id),
                            createdAt: Number(target.createdAt || Date.now())
                        }], dataUrl);
                    }
                    openImageInsertGalleryFullscreen(dataUrl);
                    syncImageInsertFullscreenGallery(items, id, dataUrl).catch(function () {});
                } catch (e) {
                    setImageInsertPreview('');
                }

                Array.from(list.querySelectorAll('.img-gallery-item')).forEach(function (el) {
                    el.classList.remove('ring-2', 'ring-indigo-400');
                });
                btn.classList.add('ring-2', 'ring-indigo-400');

                setImageInsertStatus('갤러리 이미지 선택됨: ' + internalUrl, false);
            });
        });
    } catch (e) {
        list.innerHTML = '<div class="text-xs text-red-500">갤러리 로드 실패</div>';
        setImageInsertStatus('IndexedDB 갤러리 로드 실패: ' + (e && e.message ? e.message : e), true);
    }
}

function refreshImageInsertGallery() {
    if (imageInsertGalleryWindow && !imageInsertGalleryWindow.closed) {
        imageInsertGalleryWindow.postMessage({ type: 'image-gallery-refresh' }, '*');
        return;
    }
    if (imageInsertGalleryOpen) loadImageInsertGallery();
}

async function downloadImageInsertGalleryZip() {
    if (!db || typeof JSZip === 'undefined') {
        setImageInsertStatus('ZIP export is not available.', true);
        return;
    }
    setImageInsertStatus('Preparing gallery ZIP...', false);
    try {
        const items = await new Promise(function (resolve, reject) {
            const tx = db.transaction('images', 'readonly');
            const req = tx.objectStore('images').getAll();
            req.onsuccess = function () { resolve(Array.isArray(req.result) ? req.result : []); };
            req.onerror = function () { reject(req.error || new Error('Failed to load images')); };
        });
        if (!items.length) {
            setImageInsertStatus('No IndexedDB images to export.', true);
            return;
        }

        const zip = new JSZip();
        const used = new Set();
        let added = 0;
        items.forEach(function (it, idx) {
            if (!it || !it.blob) return;
            const id = String(it.id || ('img_' + idx));
            const rawName = String(it.name || id || ('image_' + idx)).trim();
            const extFromMime = (String(it.mime || it.blob.type || '').split('/')[1] || 'bin').replace(/[^a-zA-Z0-9]/g, '');
            const safeBase = rawName.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || ('image_' + idx);
            const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(safeBase);
            const baseName = hasExt ? safeBase : (safeBase + '.' + extFromMime);
            let fileName = baseName;
            let seq = 2;
            while (used.has(fileName.toLowerCase())) {
                const dot = baseName.lastIndexOf('.');
                if (dot > 0) fileName = baseName.slice(0, dot) + '_' + seq + baseName.slice(dot);
                else fileName = baseName + '_' + seq;
                seq += 1;
            }
            used.add(fileName.toLowerCase());
            zip.file('images/' + fileName, it.blob);
            added += 1;
        });
        if (!added) {
            setImageInsertStatus('No valid images found for ZIP export.', true);
            return;
        }
        zip.file('manifest.json', JSON.stringify({
            format: 'mdviewer-indexeddb-gallery',
            createdAt: new Date().toISOString(),
            count: added
        }, null, 2));

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'indexeddb_gallery_' + new Date().toISOString().slice(0, 10) + '.zip';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 400);
        setImageInsertStatus('Gallery ZIP downloaded (' + added + ' images).', false);
    } catch (e) {
        setImageInsertStatus('Failed to export gallery ZIP: ' + (e && e.message ? e.message : e), true);
    }
}

function toggleImageInsertGallery() {
    if (imageInsertGalleryWindow && !imageInsertGalleryWindow.closed) {
        imageInsertGalleryWindow.focus();
        imageInsertGalleryWindow.postMessage({ type: 'image-gallery-refresh' }, '*');
        return;
    }

    const galleryUrl = new URL('./imageDB/image-gallery.html?v=20260806-fma-choice-3', document.baseURI || window.location.href);
    const width = Math.max(900, Math.min(1440, Math.round((window.screen && window.screen.availWidth || 1400) * 0.86)));
    const height = Math.max(620, Math.min(960, Math.round((window.screen && window.screen.availHeight || 900) * 0.86)));
    const left = Math.max(0, Math.round(((window.screen && window.screen.availWidth || width) - width) / 2));
    const top = Math.max(0, Math.round(((window.screen && window.screen.availHeight || height) - height) / 2));
    imageInsertGalleryWindow = window.open(
        galleryUrl.href,
        'mdviewer-indb-image-gallery',
        'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=no'
    );

    if (!imageInsertGalleryWindow) {
        setImageInsertGalleryToggleActive(false);
        setImageInsertStatus('갤러리 새 창이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.', true);
        return;
    }

    setImageInsertGalleryToggleActive(true);
    imageInsertGalleryWindow.focus();
}

async function applyImageInsertGalleryPopupSelection(id) {
    const safeId = String(id || '').trim();
    if (!safeId || !db || !window.ImageDB || typeof window.ImageDB.getImage !== 'function') return;

    try {
        const record = await window.ImageDB.getImage(db, safeId);
        if (!record || !record.blob) throw new Error('선택한 이미지를 inDB에서 찾지 못했습니다.');
        const internalUrl = typeof window.ImageDB.internalUrlFromId === 'function'
            ? window.ImageDB.internalUrlFromId(safeId)
            : ('internal://' + encodeURIComponent(safeId));
        const dataUrl = await getImageInsertGalleryDataUrl(safeId, record.blob);

        imageInsertSavedInternalId = safeId;
        imageInsertSavedInternalUrl = internalUrl;
        imageInsertSavedFingerprint = '';
        imageInsertCurrentDataUrl = dataUrl;
        imageInsertCurrentFileName = record.name || ('gallery_' + safeId + '.png');

        const input = document.getElementById('img-insert-url');
        if (input) {
            input.value = internalUrl;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setImageInsertPreview(dataUrl);
        renderImageInsertInternalInfo();
        setImageInsertStatus('새 창 갤러리에서 선택됨: ' + (record.name || internalUrl), false);
    } catch (error) {
        setImageInsertStatus('갤러리 이미지 선택 실패: ' + (error && error.message ? error.message : error), true);
    }
}

function getImageInsertGalleryRecords() {
    if (!db) return Promise.reject(new Error('내부 데이터베이스가 준비되지 않았습니다.'));
    return new Promise(function (resolve, reject) {
        try {
            const tx = db.transaction('images', 'readonly');
            const request = tx.objectStore('images').getAll();
            request.onsuccess = function () {
                resolve((Array.isArray(request.result) ? request.result : []).filter(function (record) {
                    return record && record.blob && String(record.id || '').trim();
                }));
            };
            request.onerror = function () {
                reject(request.error || new Error('inDB 이미지를 읽지 못했습니다.'));
            };
        } catch (error) {
            reject(error);
        }
    });
}

async function sendImageInsertGalleryRecords(targetWindow) {
    if (!targetWindow || targetWindow.closed) return;
    try {
        const records = await getImageInsertGalleryRecords();
        targetWindow.postMessage({ type: 'image-gallery-records', records: records }, '*');
    } catch (error) {
        targetWindow.postMessage({
            type: 'image-gallery-error',
            message: error && error.message ? error.message : String(error)
        }, '*');
    }
}

async function openImageInsertGalleryInFma(selectedId, requestedImportMode) {
    try {
        const records = await getImageInsertGalleryRecords();
        const safeId = String(selectedId || '');
        const selected = records.find(function (record) { return String(record.id) === safeId; }) || records[0];
        if (!selected) throw new Error('FMA Viewer에서 볼 이미지가 없습니다.');
        if (!window.InternalImageApp || typeof window.InternalImageApp.openFiles !== 'function') {
            throw new Error('FMA Viewer를 불러오지 못했습니다.');
        }
        const ordered = [selected].concat(records.filter(function (record) {
            return String(record.id) !== String(selected.id);
        }));
        const files = ordered.map(function (record) {
            return new File([record.blob], String(record.name || ('image_' + record.id + '.png')), {
                type: record.mime || record.blob.type || 'application/octet-stream',
                lastModified: Number(record.createdAt || Date.now())
            });
        });
        const importMode = requestedImportMode === 'append' ? 'append' : 'replace';
        window.InternalImageApp.openFiles(files, String(selected.name || selected.id), {
            importMode: importMode
        });
        setImageInsertStatus(importMode === 'append'
            ? 'inDB 이미지를 기존 FMA Viewer 갤러리에 추가했습니다.'
            : 'FMA Viewer를 초기화하고 inDB 이미지를 열었습니다.', false);
    } catch (error) {
        setImageInsertStatus('FMA Viewer 열기 실패: ' + (error && error.message ? error.message : error), true);
    }
}

window.addEventListener('message', function (event) {
    if (!event || !event.data || !imageInsertGalleryWindow || event.source !== imageInsertGalleryWindow) return;
    if (event.data.type === 'image-gallery-ready' || event.data.type === 'image-gallery-request-records') {
        sendImageInsertGalleryRecords(event.source);
        return;
    }
    if (event.data.type === 'image-gallery-select') {
        applyImageInsertGalleryPopupSelection(event.data.id);
        return;
    }
    if (event.data.type === 'image-gallery-request-fma-open') {
        const targetWindow = event.source;
        const selectedId = String(event.data.id || '');
        const countOperation = window.InternalImageApp &&
            typeof window.InternalImageApp.requestViewerImageCount === 'function'
            ? window.InternalImageApp.requestViewerImageCount()
            : Promise.resolve(0);
        Promise.resolve(countOperation).then(function (count) {
            if (!targetWindow || targetWindow.closed) return;
            targetWindow.postMessage({
                type: 'image-gallery-fma-open-choice',
                id: selectedId,
                existingCount: Math.max(0, Number(count) || 0)
            }, '*');
        }).catch(function (error) {
            if (!targetWindow || targetWindow.closed) return;
            targetWindow.postMessage({
                type: 'image-gallery-error',
                message: 'FMA Viewer 상태 확인 실패: ' + (error && error.message ? error.message : error)
            }, '*');
        });
        return;
    }
    if (event.data.type === 'image-gallery-open-fma') {
        openImageInsertGalleryInFma(event.data.id, event.data.importMode);
        return;
    }
    if (event.data.type === 'image-gallery-closed') {
        imageInsertGalleryWindow = null;
        setImageInsertGalleryToggleActive(false);
    }
});
function openImageInsertModal() {
    const modal = document.getElementById('image-insert-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.toggleCaptionInsertPanel) {
        try { window.toggleCaptionInsertPanel('figure', true); } catch (e) {}
    } else if (window.prepareCaptionPanel) {
        try { window.prepareCaptionPanel('figure'); } catch (e) {}
    }
    applyImageInsertPanelLayout();
    bindImageInsertModalDrag();
    bindImageInsertResize();
    if (!imageInsertCropBound) {
        imageInsertCropBound = true;
        window.addEventListener('message', function (ev) {
            if (!ev || !ev.data || !imageInsertCropWindow || ev.source !== imageInsertCropWindow) return;
            if (ev.data.type === 'crop-ready') {
                if (!imageInsertCurrentDataUrl) return;
                try { imageInsertCropWindow.postMessage({ type: 'crop', image: imageInsertCurrentDataUrl }, '*'); } catch (e) {}
                return;
            }
            if (ev.data.type === 'aiimg-cropped' && ev.data.dataUrl) {
                imageInsertCurrentDataUrl = String(ev.data.dataUrl);
                imageInsertCurrentFileName = 'cropped_' + Date.now() + '.png';
                resetImageInsertForNewImage(true);
                setImageInsertPreview(imageInsertCurrentDataUrl);
                setImageInsertStatus('Image pasted. Click [imgBB] Upload to continue.', false);
                try { imageInsertCropWindow.postMessage({ type: 'crop-applied' }, '*'); } catch (e) {}
            }
        });
    }

    const galleryPanel = document.getElementById('img-insert-gallery-panel');
    if (galleryPanel) {
        galleryPanel.classList.toggle('hidden', !imageInsertGalleryOpen);
    }
    setImageInsertGalleryToggleActive(
        imageInsertGalleryOpen || (imageInsertGalleryWindow && !imageInsertGalleryWindow.closed)
    );
    if (imageInsertGalleryOpen) {
        loadImageInsertGallery();
    }

    setImageUploadProgress(0, false);
    renderImageInsertInternalInfo();
    setImageInsertStatus('Image pasted. Click [imgBB] Upload to continue.', false);
    if (typeof window.setInputModalImagePanelToggleState === 'function') window.setInputModalImagePanelToggleState();
}

function closeImageInsertModal() {
    const modal = document.getElementById('image-insert-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const panel = document.getElementById('image-insert-panel');
    if (panel) {
        panel.style.left = '';
        panel.style.top = '';
        panel.style.margin = '';
        panel.style.position = '';
        panel.style.width = '';
        panel.style.height = '';
        panel.style.maxWidth = '';
    }

    const galleryPanel = document.getElementById('img-insert-gallery-panel');
    imageInsertGalleryOpen = false;
    if (galleryPanel) {
        galleryPanel.classList.add('hidden');
    }
    setImageInsertGalleryToggleActive(!!(imageInsertGalleryWindow && !imageInsertGalleryWindow.closed));
    revokeImageInsertGalleryObjectUrls();
    imageInsertGalleryDataUrlCache.clear();

    imageInsertDragging = false;
    setImageUploadProgress(0, false);
    if (typeof window.setInputModalImagePanelToggleState === 'function') window.setInputModalImagePanelToggleState();
}

function applyImageInsertPanelLayout() {
    const modal = document.getElementById('image-insert-modal');
    const panel = document.getElementById('image-insert-panel');
    if (!modal || !panel) return;
    if (imageInsertDockRight) {
        modal.classList.remove('justify-center');
        modal.classList.add('justify-end');
        panel.classList.remove('max-w-2xl');
        panel.classList.add('max-w-xl');
        panel.style.marginRight = '12px';
    } else {
        modal.classList.remove('justify-end');
        modal.classList.add('justify-center');
        panel.classList.remove('max-w-xl');
        panel.classList.add('max-w-2xl');
        panel.style.marginRight = '';
    }
}

function toggleImageInsertDockRight() {
    imageInsertDockRight = !imageInsertDockRight;
    applyImageInsertPanelLayout();
}

function openImageInsertExternalLink(type) {
    const targetUrl = type === 'imgbb'
        ? 'https://imgbb.com/'
        : 'https://www.google.co.kr/imghp';
    try {
        const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
            setImageInsertStatus('Popup blocked. Please allow popups in your browser settings.', true);
            return;
        }
        setImageInsertStatus('Image pasted. Click [imgBB] Upload to continue.', false);
    } catch (e) {
        setImageInsertStatus('Could not open external link. Please try again.', true);
    }
}

function bindImageInsertModalDrag() {
    if (imageInsertDragBound) return;
    imageInsertDragBound = true;
    const header = document.getElementById('image-insert-header');
    const panel = document.getElementById('image-insert-panel');
    if (!header || !panel) return;

    header.addEventListener('mousedown', function (e) {
        const target = e.target;
        if (target && (target.closest('button') || target.tagName === 'BUTTON')) return;
        imageInsertDragging = true;
        const rect = panel.getBoundingClientRect();
        imageInsertDragOffsetX = e.clientX - rect.left;
        imageInsertDragOffsetY = e.clientY - rect.top;
        panel.style.position = 'fixed';
        panel.style.margin = '0';
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!imageInsertDragging) return;
        const panelEl = document.getElementById('image-insert-panel');
        if (!panelEl) return;
        const nextLeft = Math.max(8, Math.min(window.innerWidth - panelEl.offsetWidth - 8, e.clientX - imageInsertDragOffsetX));
        const nextTop = Math.max(8, Math.min(window.innerHeight - panelEl.offsetHeight - 8, e.clientY - imageInsertDragOffsetY));
        panelEl.style.left = nextLeft + 'px';
        panelEl.style.top = nextTop + 'px';
    });

    document.addEventListener('mouseup', function () {
        imageInsertDragging = false;
    });
}

function focusImageInsertPasteZone() {
    setImageInsertStatus('Image pasted. Click [imgBB] Upload to continue.', false);
}

function handleImageInsertFile(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    readImageFileForInsertModal(file);
    if (event && event.target) event.target.value = '';
}

function readImageFileForInsertModal(file) {
    if (!file || String(file.type || '').indexOf('image') !== 0) {
        setImageInsertStatus('Please select an image file.', true);
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        imageInsertCurrentDataUrl = String(reader.result || '');
        imageInsertCurrentFileName = file.name || ('upload_' + Date.now() + '.png');
        clearImageInsertInternalSavedState();
        imageInsertChangedByCrop = false;
        setImageInsertPreview(imageInsertCurrentDataUrl);
        renderImageInsertInternalInfo();
        setImageInsertStatus('Image pasted. Click [imgBB] Upload to continue.', false);
    };
    reader.readAsDataURL(file);
}

function selectImageInsertCaptureArea(dataUrl) {
    return new Promise(function (resolve, reject) {
        const image = new Image();
        image.onload = function () {
            const overlay = document.createElement('div');
            overlay.id = 'img-insert-capture-area-modal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'img-insert-capture-area-title');
            Object.assign(overlay.style, {
                position: 'fixed', inset: '0', zIndex: '2147483647', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '16px',
                background: 'rgba(2, 6, 23, .88)'
            });

            const panel = document.createElement('div');
            Object.assign(panel.style, {
                display: 'flex', flexDirection: 'column', gap: '10px', width: 'fit-content',
                maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', padding: '14px',
                overflow: 'auto', border: '1px solid #64748b', borderRadius: '12px',
                background: '#0f172a', color: '#e2e8f0', boxShadow: '0 24px 70px rgba(0,0,0,.5)'
            });
            const title = document.createElement('h3');
            title.id = 'img-insert-capture-area-title';
            title.textContent = '캡처 영역 선택';
            Object.assign(title.style, { margin: '0', fontSize: '16px', fontWeight: '800' });
            const help = document.createElement('p');
            help.textContent = '가져올 영역을 마우스로 드래그하세요. 탭·창·전체 화면 모두 영역을 선택할 수 있습니다.';
            Object.assign(help.style, { margin: '0', color: '#cbd5e1', fontSize: '12px' });

            const stage = document.createElement('div');
            Object.assign(stage.style, { position: 'relative', display: 'inline-block', alignSelf: 'center', lineHeight: '0', cursor: 'crosshair', userSelect: 'none' });
            const canvas = document.createElement('canvas');
            canvas.id = 'img-insert-capture-area-canvas';
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            Object.assign(canvas.style, { display: 'block', width: 'auto', height: 'auto', maxWidth: 'calc(100vw - 64px)', maxHeight: 'calc(100vh - 190px)', touchAction: 'none' });
            canvas.getContext('2d').drawImage(image, 0, 0);
            const selectionBox = document.createElement('div');
            selectionBox.id = 'img-insert-capture-area-selection';
            Object.assign(selectionBox.style, {
                position: 'absolute', display: 'none', pointerEvents: 'none', boxSizing: 'border-box',
                border: '2px solid #38bdf8', background: 'rgba(14, 165, 233, .18)',
                boxShadow: '0 0 0 9999px rgba(2, 6, 23, .42)'
            });
            stage.append(canvas, selectionBox);

            const selectionStatus = document.createElement('div');
            selectionStatus.textContent = '영역을 드래그하거나 전체 이미지를 가져오세요.';
            Object.assign(selectionStatus.style, { minHeight: '18px', color: '#bae6fd', fontSize: '12px' });
            const actions = document.createElement('div');
            Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' });
            const makeButton = function (label, background) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                Object.assign(button.style, { padding: '8px 12px', border: '1px solid #64748b', borderRadius: '7px', background: background, color: '#fff', fontWeight: '700', cursor: 'pointer' });
                return button;
            };
            const cancelButton = makeButton('취소', '#334155');
            const fullButton = makeButton('전체 이미지 가져오기', '#475569');
            const cropButton = makeButton('선택 영역 가져오기', '#0284c7');
            cropButton.disabled = true;
            cropButton.style.opacity = '.5';
            actions.append(cancelButton, fullButton, cropButton);
            panel.append(title, help, stage, selectionStatus, actions);
            overlay.appendChild(panel);

            let selection = null;
            let startPoint = null;
            let pointerId = null;
            const getPoint = function (event) {
                const rect = canvas.getBoundingClientRect();
                return {
                    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
                    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
                };
            };
            const updateSelection = function (point) {
                const left = Math.min(startPoint.x, point.x);
                const top = Math.min(startPoint.y, point.y);
                const width = Math.abs(point.x - startPoint.x);
                const height = Math.abs(point.y - startPoint.y);
                selection = { left: left, top: top, width: width, height: height };
                Object.assign(selectionBox.style, { display: 'block', left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
                const valid = width >= 3 && height >= 3;
                cropButton.disabled = !valid;
                cropButton.style.opacity = valid ? '1' : '.5';
                const rect = canvas.getBoundingClientRect();
                const naturalWidth = Math.round(width * canvas.width / rect.width);
                const naturalHeight = Math.round(height * canvas.height / rect.height);
                selectionStatus.textContent = valid ? ('선택 영역: ' + naturalWidth + ' × ' + naturalHeight + ' px') : '조금 더 넓은 영역을 선택하세요.';
            };
            canvas.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                pointerId = event.pointerId;
                startPoint = getPoint(event);
                canvas.setPointerCapture(pointerId);
                updateSelection(startPoint);
                event.preventDefault();
            });
            canvas.addEventListener('pointermove', function (event) {
                if (pointerId !== event.pointerId || !startPoint) return;
                updateSelection(getPoint(event));
            });
            const finishPointer = function (event) {
                if (pointerId !== event.pointerId) return;
                updateSelection(getPoint(event));
                pointerId = null;
                startPoint = null;
            };
            canvas.addEventListener('pointerup', finishPointer);
            canvas.addEventListener('pointercancel', function () { pointerId = null; startPoint = null; });

            const cleanup = function () {
                document.removeEventListener('keydown', onKeyDown);
                overlay.remove();
            };
            const complete = function (result) { cleanup(); resolve(result); };
            const onKeyDown = function (event) {
                if (event.key === 'Escape') complete(null);
            };
            cancelButton.addEventListener('click', function () { complete(null); });
            fullButton.addEventListener('click', function () { complete({ dataUrl: dataUrl, cropped: false }); });
            cropButton.addEventListener('click', function () {
                if (!selection || selection.width < 3 || selection.height < 3) return;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const sx = Math.max(0, Math.round(selection.left * scaleX));
                const sy = Math.max(0, Math.round(selection.top * scaleY));
                const sw = Math.max(1, Math.min(canvas.width - sx, Math.round(selection.width * scaleX)));
                const sh = Math.max(1, Math.min(canvas.height - sy, Math.round(selection.height * scaleY)));
                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = sw;
                croppedCanvas.height = sh;
                croppedCanvas.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
                complete({ dataUrl: croppedCanvas.toDataURL('image/png'), cropped: true });
            });
            document.addEventListener('keydown', onKeyDown);
            document.body.appendChild(overlay);
            canvas.focus();
        };
        image.onerror = function () { reject(new Error('캡처 이미지를 영역 선택 화면에 표시하지 못했습니다.')); };
        image.src = dataUrl;
    });
}

async function captureScreenForImageInsert() {
    const captureButton = document.getElementById('img-insert-screen-capture');
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        setImageInsertStatus('이 브라우저는 화면 캡처를 지원하지 않습니다. Windows에서 Win+Shift+S로 캡처한 뒤 Ctrl+V로 붙여넣어 주세요.', true);
        return false;
    }

    let stream = null;
    if (captureButton) {
        captureButton.disabled = true;
        captureButton.setAttribute('aria-busy', 'true');
    }
    setImageInsertStatus('부분 영역을 캡처할 탭, 창 또는 전체 화면을 먼저 선택하세요.', false);
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const track = stream.getVideoTracks()[0];
        if (!track) throw new Error('선택한 화면의 영상 정보를 가져오지 못했습니다.');

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await new Promise(function (resolve, reject) {
            const timer = setTimeout(function () { reject(new Error('화면 준비 시간이 초과되었습니다.')); }, 10000);
            video.onloadedmetadata = function () {
                clearTimeout(timer);
                Promise.resolve(video.play()).then(resolve, reject);
            };
            video.onerror = function () {
                clearTimeout(timer);
                reject(new Error('선택한 화면을 읽지 못했습니다.'));
            };
        });
        await new Promise(function (resolve) {
            requestAnimationFrame(function () { requestAnimationFrame(resolve); });
        });

        const settings = track.getSettings ? track.getSettings() : {};
        const width = Math.max(1, video.videoWidth || Number(settings.width) || 1);
        const height = Math.max(1, video.videoHeight || Number(settings.height) || 1);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('캡처 이미지를 만들 수 없습니다.');
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        stream.getTracks().forEach(function (track) { track.stop(); });
        stream = null;
        const selectedCapture = await selectImageInsertCaptureArea(dataUrl);
        if (!selectedCapture) {
            setImageInsertStatus('캡처 이미지의 영역 선택을 취소했습니다.', false);
            return false;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        applyImageInsertDataUrl(selectedCapture.dataUrl, 'screen-capture-' + timestamp + '.png');
        setImageInsertStatus(selectedCapture.cropped
            ? '선택한 캡처 영역을 가져왔습니다. 문서내부저장 또는 imgBB 업로드를 사용할 수 있습니다.'
            : '전체 화면 캡처를 가져왔습니다. 자르기, 문서내부저장 또는 imgBB 업로드를 사용할 수 있습니다.', false);
        return true;
    } catch (error) {
        const cancelled = error && (error.name === 'NotAllowedError' || error.name === 'AbortError');
        setImageInsertStatus(cancelled
            ? '화면 캡처가 취소되었습니다. Windows 캡처는 Win+Shift+S 후 Ctrl+V로 가져올 수 있습니다.'
            : '화면 캡처 실패: ' + (error && error.message ? error.message : error), !cancelled);
        return false;
    } finally {
        if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
        if (captureButton) {
            captureButton.disabled = false;
            captureButton.removeAttribute('aria-busy');
        }
    }
}

function onImageInsertUploadDragOver(event) {
    if (!event) return;
    event.preventDefault();
    const zone = document.getElementById('img-insert-upload-zone');
    if (zone) {
        zone.classList.add('bg-indigo-50');
        zone.classList.add('dark:bg-indigo-900/30');
    }
}

function onImageInsertUploadDragLeave(event) {
    if (event) event.preventDefault();
    const zone = document.getElementById('img-insert-upload-zone');
    if (zone) {
        zone.classList.remove('bg-indigo-50');
        zone.classList.remove('dark:bg-indigo-900/30');
    }
}

function onImageInsertUploadDrop(event) {
    if (!event) return;
    event.preventDefault();
    onImageInsertUploadDragLeave(event);
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (!file) {
        setImageInsertStatus('No file was dropped.', true);
        return;
    }
    readImageFileForInsertModal(file);
}

function getCropPageUrlForImageInsert() {
    try {
        return new URL('js/crop/crop.html', document.baseURI || window.location.href).href;
    } catch (e) {
        return './js/crop/crop.html';
    }
}

function cropImageInsertCurrent() {
    if (!imageInsertCurrentDataUrl) {
        setImageInsertStatus('Select or paste an image before cropping.', true);
        return;
    }
    imageInsertCropWindow = window.open(getCropPageUrlForImageInsert(), 'img_insert_crop', 'width=700,height=620,scrollbars=yes,resizable=yes');
    if (!imageInsertCropWindow) {
        setImageInsertStatus('Failed to open crop window. Please allow popups and try again.', true);
        return;
    }
    try { imageInsertCropWindow.focus(); } catch (e) {}
    try { imageInsertCropWindow.postMessage({ type: 'crop', image: imageInsertCurrentDataUrl }, '*'); } catch (e) {}
}

async function uploadImageInsertToImgbb() {
    if (!imageInsertCurrentDataUrl || imageInsertCurrentDataUrl.indexOf('data:image') !== 0) {
        try { await ensureImageInsertDataUrlFromInternalSelection(); } catch (e) {}
    }
    if (!imageInsertCurrentDataUrl || imageInsertCurrentDataUrl.indexOf('data:image') !== 0) {
        setImageInsertStatus('Select or paste an image before uploading.', true);
        return;
    }
    const apiKey = String(getImgbbApiKey() || '').trim();
    if (!apiKey) {
        setImageInsertStatus('imgBB API key is missing. Please save it in settings first.', true);
        return;
    }
    setImageInsertStatus('Uploading to imgBB...', false);
    setImageUploadProgress(0, true);
    try {
        const comma = imageInsertCurrentDataUrl.indexOf(',');
        const base64Data = comma >= 0 ? imageInsertCurrentDataUrl.slice(comma + 1) : imageInsertCurrentDataUrl;
        const form = new FormData();
        form.append('image', base64Data);
        form.append('name', 'img_insert_' + Date.now());

        const payload = await new Promise(function (resolve, reject) {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://api.imgbb.com/1/upload?key=' + encodeURIComponent(apiKey), true);
            xhr.upload.onprogress = function (ev) {
                if (!ev || !ev.lengthComputable) return;
                const pct = Math.round((ev.loaded / ev.total) * 100);
                setImageUploadProgress(pct, true);
                setImageInsertStatus('Uploading to imgBB... ' + pct + '%', false);
            };
            xhr.onload = function () {
                try {
                    const data = JSON.parse(xhr.responseText || '{}');
                    if (xhr.status >= 200 && xhr.status < 300 && data && data.success !== false) resolve(data);
                    else {
                        const msg = data && data.error && data.error.message ? data.error.message : ('imgBB upload failed (' + xhr.status + ')');
                        reject(new Error(msg));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            xhr.onerror = function () { reject(new Error('Network error during imgBB upload.')); };
            xhr.send(form);
        });

        const data = payload.data || {};
        const directUrl = data.url || (data.image && data.image.url) || data.display_url || '';
        const input = document.getElementById('img-insert-url');
        if (input) input.value = directUrl || '';
        setImageUploadProgress(100, false);
        setImageInsertStatus(directUrl ? ('Upload complete: ' + directUrl) : 'Upload complete.', false);
    } catch (e) {
        setImageUploadProgress(0, false);
        setImageInsertStatus('imgBB upload failed: ' + (e && e.message ? e.message : e), true);
    }
}

async function saveImageInsertToInternalDb() {
    if (!db) {
        setImageInsertStatus('Database is not ready yet.', true);
        return;
    }
    if (!window.ImageDB || typeof window.ImageDB.saveDataUrl !== 'function') {
        setImageInsertStatus('ImageDB module is not available.', true);
        return;
    }
    if (!imageInsertCurrentDataUrl || imageInsertCurrentDataUrl.indexOf('data:image') !== 0) {
        setImageInsertStatus('Select or paste an image before saving internally.', true);
        return;
    }
    const nowFingerprint = getImageInsertFingerprint(imageInsertCurrentDataUrl);
    if (imageInsertSavedInternalUrl) {
        if (imageInsertSavedFingerprint === nowFingerprint) {
            const inputEl = document.getElementById('img-insert-url');
            if (inputEl) inputEl.value = imageInsertSavedInternalUrl;
            setImageInsertStatus('Already saved internally. Reusing the existing internal link.', false);
            renderImageInsertInternalInfo();
            return;
        }
        if (!imageInsertChangedByCrop) {
            setImageInsertStatus('An internal link already exists. Delete the saved internal image first to save a new one.', true);
            return;
        }
    }
    try {
        const saved = await window.ImageDB.saveDataUrl(db, imageInsertCurrentDataUrl, {
            name: imageInsertCurrentFileName || ('internal_' + Date.now() + '.png')
        });
        const input = document.getElementById('img-insert-url');
        if (input) input.value = saved.url;
        imageInsertSavedInternalId = saved.id;
        imageInsertSavedInternalUrl = saved.url;
        imageInsertSavedFingerprint = nowFingerprint;
        imageInsertChangedByCrop = false;
        renderImageInsertInternalInfo();
        setImageInsertStatus('Saved to internal image DB. Insert with Markdown/HTML buttons.', false);
        refreshImageInsertGallery();
        showToast('Image saved to internal DB.');
    } catch (e) {
        setImageInsertStatus('Failed to save image internally: ' + (e && e.message ? e.message : e), true);
    }
}

async function deleteSavedInternalImage() {
    if (!db || !imageInsertSavedInternalId) return;
    try {
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').delete(imageInsertSavedInternalId);
        await new Promise(function (resolve, reject) {
            tx.oncomplete = resolve;
            tx.onerror = function () { reject(tx.error || new Error('Failed to delete image.')); };
        });
        clearImageInsertInternalSavedState();
        imageInsertChangedByCrop = false;
        const input = document.getElementById('img-insert-url');
        if (input && String(input.value || '').trim().startsWith('internal://')) input.value = '';
        renderImageInsertInternalInfo();
        refreshImageInsertGallery();
        setImageInsertStatus('Deleted saved internal image. You can save a new internal image now.', false);
    } catch (e) {
        setImageInsertStatus('Failed to delete saved internal image: ' + (e && e.message ? e.message : e), true);
    }
}

function insertImageFromModal(type) {
    const urlInput = document.getElementById('img-insert-url');
    const url = String(urlInput && urlInput.value ? urlInput.value : '').trim();
    const source = url || imageInsertCurrentDataUrl;
    if (!source) {
        setImageInsertStatus('Enter an image URL or upload an image first.', true);
        return;
    }
    const alt = getImageAltTextFromUrl(source);
    if (!isEditMode) {
        showToast('Use this in edit mode.');
        return;
    }
    const closeAfterInsert = !!document.getElementById('img-insert-close-after')?.checked;
    if (type === 'html') insertHtmlImageAtCursor(source, alt);
    else insertMarkdownImageAtCursor(source, alt);
    if (closeAfterInsert) closeImageInsertModal();
}

// Global exports for inline handlers in index.html toolbar/modal.
let imageUploadToolbarVisible = false;
try { imageUploadToolbarVisible = localStorage.getItem('mdpro.imageUploadToolbarVisible') === 'true'; } catch (_) {}
window.syncImageUploadToolbarVisibility = function (enabled) {
    const option = document.getElementById('image-upload-toolbar-enabled');
    const button = document.getElementById('btn-image-upload-toolbar');
    if (option) option.checked = imageUploadToolbarVisible;
    if (button) button.classList.toggle('hidden', !(enabled && imageUploadToolbarVisible));
};
window.setImageUploadToolbarVisible = function (visible) {
    imageUploadToolbarVisible = !!visible;
    try { localStorage.setItem('mdpro.imageUploadToolbarVisible', String(imageUploadToolbarVisible)); } catch (_) {}
    window.syncImageUploadToolbarVisibility(!!document.getElementById('image-upload-enabled')?.checked);
};
function initializeImageUploadToolbar() {
    window.syncImageUploadToolbarVisibility(!!document.getElementById('image-upload-enabled')?.checked);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeImageUploadToolbar);
else initializeImageUploadToolbar();

function bindImageInsertResize() {
    const panel = document.getElementById('image-insert-panel');
    if (!panel || panel.dataset.resizeBound) return;
    panel.dataset.resizeBound = 'true';
    const content = document.createElement('div');
    content.className = 'image-insert-scroll-content';
    while (panel.firstChild) content.appendChild(panel.firstChild);
    panel.appendChild(content);
    const labels = { n: '위', s: '아래', w: '왼쪽', e: '오른쪽', se: '오른쪽 아래' };
    for (const direction of Object.keys(labels)) {
        const handle = document.createElement('div');
        handle.className = 'image-insert-resize-handle resize-' + direction;
        handle.title = labels[direction] + ' 크기 조절';
        handle.addEventListener('pointerdown', function (event) {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = panel.getBoundingClientRect();
            const startX = event.clientX;
            const startY = event.clientY;
            Object.assign(panel.style, { position: 'fixed', margin: '0', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', maxWidth: 'calc(100vw - 16px)' });
            handle.setPointerCapture(event.pointerId);
            const move = function (next) {
                const dx = next.clientX - startX;
                const dy = next.clientY - startY;
                const minW = Math.min(300, window.innerWidth - 16);
                const minH = Math.min(220, window.innerHeight - 16);
                let left = rect.left, right = rect.right, top = rect.top, bottom = rect.bottom;
                if (direction.includes('w')) left = Math.max(8, Math.min(right - minW, rect.left + dx));
                if (direction.includes('e')) right = Math.min(window.innerWidth - 8, Math.max(left + minW, rect.right + dx));
                if (direction.includes('n')) top = Math.max(8, Math.min(bottom - minH, rect.top + dy));
                if (direction.includes('s')) bottom = Math.min(window.innerHeight - 8, Math.max(top + minH, rect.bottom + dy));
                Object.assign(panel.style, { left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px' });
            };
            const stop = function () {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', stop);
                handle.removeEventListener('pointercancel', stop);
                handle.removeEventListener('lostpointercapture', stop);
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', stop);
            handle.addEventListener('pointercancel', stop);
            handle.addEventListener('lostpointercapture', stop);
        });
        panel.appendChild(handle);
    }
}

window.insertMarkdownImageAtCursor = insertMarkdownImageAtCursor;
window.insertHtmlImageAtCursor = insertHtmlImageAtCursor;
window.openImageInsertModal = openImageInsertModal;
window.closeImageInsertModal = closeImageInsertModal;
window.toggleImageInsertDockRight = toggleImageInsertDockRight;
window.openImageInsertExternalLink = openImageInsertExternalLink;
window.focusImageInsertPasteZone = focusImageInsertPasteZone;
window.handleImageInsertFile = handleImageInsertFile;
window.onImageInsertUploadDragOver = onImageInsertUploadDragOver;
window.onImageInsertUploadDragLeave = onImageInsertUploadDragLeave;
window.onImageInsertUploadDrop = onImageInsertUploadDrop;
window.captureScreenForImageInsert = captureScreenForImageInsert;
window.cropImageInsertCurrent = cropImageInsertCurrent;
window.uploadImageInsertToImgbb = uploadImageInsertToImgbb;
window.saveImageInsertToInternalDb = saveImageInsertToInternalDb;
window.toggleImageInsertGallery = toggleImageInsertGallery;
window.refreshImageInsertGallery = refreshImageInsertGallery;
window.downloadImageInsertGalleryZip = downloadImageInsertGalleryZip;
window.insertImageFromModal = insertImageFromModal;
window.applyImageInsertDataUrl = applyImageInsertDataUrl;

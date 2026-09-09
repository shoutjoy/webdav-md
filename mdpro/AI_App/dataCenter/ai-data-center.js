(function (root) {
  'use strict';

  var DB_NAME = 'AIDataCenterDB';
  var DB_VERSION = 2;
  var STORE_NAME = 'traces';
  var MIGRATION_KEY = 'mdpro_ai_data_center_migrated_v1';
  var dbPromise = null;
  var records = [];
  var syncRunning = false;
  var syncTimer = null;
  var syncedRecords = new Map();
  var syncStatus = 'WebDAV 연결 대기';
  var remoteRecords = null;
  var folderRequestVersion = 0;
  var HIDDEN_FOLDER_KEY = 'mdpro_jena_hidden_folder_access';
  var selectedId = '';
  var activeType = 'all';
  var answersOnly = false;
  var messageView = Object.create(null);
  var messageZoom = Object.create(null);
  var dragState = null;
  var THEME_KEY = 'mdpro_ai_data_center_theme';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function markdownHtml(value) {
    var raw = String(value || '');
    if (root.AIChatMarkdown && typeof root.AIChatMarkdown.toHtml === 'function') return root.AIChatMarkdown.toHtml(raw);
    if (!root.marked || typeof root.marked.parse !== 'function') return '<pre>' + escapeHtml(raw) + '</pre>';
    var html = root.marked.parse(raw, { breaks: true, gfm: true });
    return root.DOMPurify && typeof root.DOMPurify.sanitize === 'function' ? root.DOMPurify.sanitize(html) : '<pre>' + escapeHtml(raw) + '</pre>';
  }

  function copyText(value) {
    var text = String(value || '');
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    return Promise.resolve();
  }

  async function copyRendered(value) {
    var raw = String(value || '');
    if (root.AIChatMarkdown && typeof root.AIChatMarkdown.copyRendered === 'function') {
      return new Promise(function (resolve) { root.AIChatMarkdown.copyRendered(raw, resolve); });
    }
    var html = markdownHtml(raw);
    var plainBox = document.createElement('div'); plainBox.innerHTML = html;
    var plain = String(plainBox.innerText || plainBox.textContent || '').trim();
    if (navigator.clipboard && root.ClipboardItem && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
    } else await copyText(plain);
  }

  function openAnswerWindow(raw, question) {
    var payloadKey = 'aiJenaAnswerViewPayload:' + Date.now() + ':' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(payloadKey, JSON.stringify({ markdown: String(raw || ''), question: String(question || ''), createdAt: Date.now() }));
    var url = new URL('./AI_App/aiChat/ai-chat-answer-view.html', root.location.href);
    url.searchParams.set('payload', payloadKey);
    var popup = root.open(url.href, 'ai-jena-answer-' + Date.now(), 'popup=yes,width=940,height=820,resizable=yes,scrollbars=yes');
    if (!popup) throw new Error('팝업이 차단되었습니다.');
  }

  function questionForMessage(messages, index) {
    for (var i = index - 1; i >= 0; i--) if (messages[i] && messages[i].role === 'user') return messages[i].content || '';
    return '';
  }

  function fitNextToAIJena(app) {
    var candidates = [document.getElementById('ai-chat-panel'), document.getElementById('ai-chat-dock-slot')];
    var jena = candidates.find(function (node) {
      if (!node) return false;
      var rect = node.getBoundingClientRect(); var style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 180 && rect.height > 240;
    });
    if (!jena) return false;
    var rect = jena.getBoundingClientRect(); var gap = 8;
    var leftSpace = rect.left - gap * 2; var rightSpace = innerWidth - rect.right - gap * 2;
    app.classList.remove('fullscreen');
    document.getElementById('aic-fullscreen').textContent = '전체화면';
    if (leftSpace >= 620 || leftSpace >= rightSpace) {
      app.style.left = gap + 'px'; app.style.width = Math.max(420, leftSpace) + 'px';
    } else if (rightSpace >= 420) {
      app.style.left = (rect.right + gap) + 'px'; app.style.width = rightSpace + 'px';
    } else return false;
    app.style.top = gap + 'px'; app.style.height = (innerHeight - gap * 2) + 'px';
    return true;
  }

  function applyResponsiveScale() {
    var app = document.getElementById('ai-data-center-app');
    if (!app) return;
    var width = app.getBoundingClientRect().width;
    var scale = Math.max(.78, Math.min(1.12, width / 1180));
    app.style.setProperty('--aic-scale', scale.toFixed(3));
    app.classList.toggle('compact', width < 820);
  }

  function setupWindowControls(app) {
    if (app.dataset.windowReady) return;
    app.dataset.windowReady = '1';
    var header = app.querySelector(':scope > header');
    header.addEventListener('pointerdown', function (event) {
      if (app.classList.contains('fullscreen') || event.target.closest('button,input')) return;
      var rect = app.getBoundingClientRect();
      dragState = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener('pointermove', function (event) {
      if (!dragState) return;
      var left = Math.max(0, Math.min(innerWidth - 180, dragState.left + event.clientX - dragState.x));
      var top = Math.max(0, Math.min(innerHeight - 80, dragState.top + event.clientY - dragState.y));
      app.style.left = left + 'px'; app.style.top = top + 'px';
    });
    header.addEventListener('pointerup', function (event) { dragState = null; try { header.releasePointerCapture(event.pointerId); } catch (_) {} saveWindowRect(); });
    if (root.ResizeObserver) new ResizeObserver(function () { applyResponsiveScale(); saveWindowRect(); }).observe(app);
  }

  function saveWindowRect() {
    var app = document.getElementById('ai-data-center-app');
    if (!app || app.classList.contains('fullscreen')) return;
    var rect = app.getBoundingClientRect();
    try { localStorage.setItem('mdpro_ai_data_center_rect_v1', JSON.stringify({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })); } catch (_) {}
  }

  function restoreWindowRect(app) {
    var value = null;
    try { value = JSON.parse(localStorage.getItem('mdpro_ai_data_center_rect_v1') || 'null'); } catch (_) {}
    if (!value) return;
    app.style.left = Math.max(0, Math.min(innerWidth - 180, Number(value.left) || 20)) + 'px';
    app.style.top = Math.max(0, Math.min(innerHeight - 80, Number(value.top) || 20)) + 'px';
    app.style.width = Math.max(620, Math.min(innerWidth, Number(value.width) || 1180)) + 'px';
    app.style.height = Math.max(460, Math.min(innerHeight, Number(value.height) || 780)) + 'px';
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains('deleted')) database.createObjectStore('deleted', { keyPath: 'id' });
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          var store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('recordType', 'recordType', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = function () {
        request.result.onversionchange = function () { request.result.close(); dbPromise = null; };
        resolve(request.result);
      };
      request.onblocked = function () { setSyncStatus('다른 AI JENA 탭을 닫거나 새로고침해 주세요.'); };
      request.onerror = function () { dbPromise = null; reject(request.error || new Error('AI 데이터 센터 DB를 열지 못했습니다.')); };
    });
    return dbPromise;
  }

  async function save(record) {
    if (!record || !record.id) return false;
    var database = await openDb();
    var value = Object.assign({}, record, { updatedAt: Number(record.updatedAt || Date.now()) });
    return new Promise(function (resolve, reject) {
      var tx = database.transaction([STORE_NAME, 'deleted'], 'readwrite');
      tx.objectStore(STORE_NAME).put(value);
      tx.objectStore('deleted').delete(value.id);
      tx.oncomplete = function () { scheduleSync(); resolve(true); };
      tx.onerror = function () { reject(tx.error || new Error('AI 사용 기록 저장 실패')); };
    });
  }

  async function readAll() {
    var database = await openDb();
    return new Promise(function (resolve) {
      var request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = function () { resolve(Array.isArray(request.result) ? request.result : []); };
      request.onerror = function () { resolve([]); };
    });
  }

  async function remove(id) {
    var database = await openDb();
    return new Promise(function (resolve) {
      var tx = database.transaction([STORE_NAME, 'deleted'], 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.objectStore('deleted').put({ id: id, deleted: true, updatedAt: Date.now() });
      tx.oncomplete = function () { scheduleSync(); resolve(true); };
      tx.onerror = function () { resolve(false); };
    });
  }

  function setSyncStatus(text) {
    syncStatus = text;
    var node = document.getElementById('aic-sync-status');
    if (node) node.textContent = text;
  }

  function sendRecord(record) {
    return new Promise(function (resolve, reject) {
      var requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      var timer = setTimeout(function () { finish(new Error('WebDAV 응답 지연 · 자동 재시도 예정')); }, 60000);
      function finish(error) {
        clearTimeout(timer);
        root.removeEventListener('message', receive);
        if (error) reject(error); else resolve();
      }
      function receive(event) {
        if (event.source !== root.parent || event.origin !== root.location.origin) return;
        var data = event.data;
        if (!data || data.type !== 'jena-save-result' || data.requestId !== requestId) return;
        finish(data.ok ? null : new Error(data.error || 'WebDAV 저장 실패'));
      }
      root.addEventListener('message', receive);
      root.parent.postMessage({ type: 'jena-save-record', requestId: requestId, record: record }, root.location.origin);
    });
  }

  function scheduleSync() {
    if (root.parent === root || new URLSearchParams(root.location.search).get('webdav') !== '1') return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncWebDAV, 1500);
  }

  async function syncWebDAV() {
    if (syncRunning || root.parent === root) return;
    syncRunning = true;
    try {
      setSyncStatus('JENA_DATA 저장 중…');
      await migrateLegacyOnce();
      // Pull before pushing so a new browser/device cannot overwrite a newer
      // WebDAV conversation with its stale local IndexedDB copy.
      var remote = await readRemoteFolder();
      var localBeforeMerge = await readAll();
      var localById = new Map(localBeforeMerge.map(function (record) { return [record.id, record]; }));
      for (var remoteRecord of remote) {
        if (!remoteRecord || !remoteRecord.id) continue;
        var localRecord = localById.get(remoteRecord.id);
        if (!localRecord || Number(remoteRecord.updatedAt || remoteRecord.createdAt || 0) > Number(localRecord.updatedAt || localRecord.createdAt || 0)) {
          await save(remoteRecord);
          localById.set(remoteRecord.id, remoteRecord);
        }
      }
      var all = await readAll();
      var database = await openDb();
      var deleted = await new Promise(function (resolve, reject) {
        var request = database.transaction('deleted', 'readonly').objectStore('deleted').getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
      for (var record of all.concat(deleted)) {
        var serialized = JSON.stringify(record);
        if (syncedRecords.get(record.id) === serialized) continue;
        await sendRecord(record);
        syncedRecords.set(record.id, serialized);
      }
      setSyncStatus('WebDAV /JENA_DATA 자동 저장 완료');
      root.dispatchEvent(new CustomEvent('ai-data-center-synced'));
    } catch (error) {
      setSyncStatus('로컬 보관 · 재시도 예정: ' + error.message);
    } finally {
      syncRunning = false;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncWebDAV, 30000);
    }
  }

  function sanitizeLegacyRecord(record) {
    var copy = Object.assign({}, record);
    if (copy.recordType === 'document') copy.recordType = 'attachment';
    if (copy.recordType === 'attachment') {
      copy.textLength = Number(copy.textLength || String(copy.text || '').length);
      delete copy.text;
      delete copy.dataUrl;
    }
    if (copy.recordType === 'conversation' && Array.isArray(copy.messages)) {
      copy.messages = copy.messages.map(function (message) {
        var item = Object.assign({}, message);
        if (Array.isArray(item.attachments)) item.attachments = item.attachments.map(function (attachment) {
          return { kind: attachment.kind, name: attachment.name, type: attachment.type, size: attachment.size,
            textLength: Number(attachment.textLength || String(attachment.text || '').length), source: attachment.source || 'upload' };
        });
        return item;
      });
    }
    return copy;
  }

  async function migrateLegacyOnce() {
    try { if (localStorage.getItem(MIGRATION_KEY) === '1') return; } catch (_) {}
    var legacy;
    try {
      legacy = await new Promise(function (resolve) {
        var request = indexedDB.open('MarkdownProDB');
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { resolve(null); };
      });
      if (legacy && legacy.objectStoreNames.contains('AI_data')) {
        var oldRecords = await new Promise(function (resolve) {
          var request = legacy.transaction('AI_data', 'readonly').objectStore('AI_data').getAll();
          request.onsuccess = function () { resolve(request.result || []); };
          request.onerror = function () { resolve([]); };
        });
        for (var i = 0; i < oldRecords.length; i++) await save(sanitizeLegacyRecord(oldRecords[i]));
        if (oldRecords.length) await new Promise(function (resolve) {
          var tx = legacy.transaction('AI_data', 'readwrite');
          tx.objectStore('AI_data').clear();
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      }
      if (legacy) legacy.close();
      try { localStorage.setItem(MIGRATION_KEY, '1'); } catch (_) {}
    } catch (_) {}
  }

  function typeLabel(type) {
    return ({ conversation: '대화', academic_search: '학술검색', image: '이미지', attachment: '첨부 사용' })[type] || 'AI 기록';
  }

  function titleOf(record) {
    return record.recordType === 'academic_search' ? (record.question || record.query || '학술검색')
      : (record.title || record.name || record.conversationTitle || 'AI 사용 기록');
  }

  function searchable(record) {
    return [titleOf(record), record.query, record.question, record.model, record.provider]
      .concat((record.messages || []).map(function (message) { return message.content; }))
      .concat((record.results || []).map(function (result) { return result.title; })).filter(Boolean).join(' ').toLowerCase();
  }

  function ensureUi() {
    if (document.getElementById('ai-data-center-app')) return;
    document.body.insertAdjacentHTML('beforeend', '<div id="ai-data-center-app" class="aic-app" hidden>'
      + '<header><div class="aic-brand"><span>D</span><div><h2>AI 데이터 센터</h2><p>AI JENA의 질문·답변·학술검색·이미지 사용 흔적을 확인합니다.</p><p id="aic-sync-status" role="status"></p></div></div>'
      + '<input id="aic-search" type="search" placeholder="질문·답변·검색어·논문 제목 검색">'
      + '<button id="aic-theme" class="aic-theme-button" type="button" title="다크/라이트 전환" aria-label="다크/라이트 전환">☀</button><button id="aic-answer-filter" type="button" title="답변만 보기">답변만</button><button id="aic-fullscreen" type="button">전체화면</button><button id="aic-close" type="button">닫기</button></header>'
      + '<details class="aic-storage-settings"><summary>저장 폴더 설정</summary><label><input id="aic-hidden-folder" type="checkbox"> 숨겨진 JENA_DATA 폴더 열기 허용</label><button id="aic-open-folder" type="button" disabled>JENA_DATA 열기</button><button id="aic-local-records" type="button">로컬 기록 보기</button><p id="aic-folder-status" role="status">일반 탐색기에서는 숨김 · 폴더 기록은 읽기 전용으로 열립니다.</p></details>'
      + '<div class="aic-layout"><aside><nav id="aic-tabs"></nav><div id="aic-list"></div></aside><main id="aic-detail"></main></div></div>');
    var app = document.getElementById('ai-data-center-app');
    document.getElementById('aic-close').onclick = close;
    setSyncStatus(syncStatus);
    setupStorageSettings();
    var themeButton = document.getElementById('aic-theme');
    var lightTheme = false;
    try { lightTheme = localStorage.getItem(THEME_KEY) === 'light'; } catch (_) {}
    app.classList.toggle('light', lightTheme);
    themeButton.textContent = lightTheme ? '◐' : '☀';
    themeButton.onclick = function () {
      var light = !app.classList.contains('light');
      app.classList.toggle('light', light);
      themeButton.textContent = light ? '◐' : '☀';
      try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (_) {}
    };
    document.getElementById('aic-fullscreen').onclick = function () {
      app.classList.toggle('fullscreen');
      this.textContent = app.classList.contains('fullscreen') ? '창으로' : '전체화면';
      applyResponsiveScale();
    };
    document.getElementById('aic-search').oninput = render;
    document.getElementById('aic-answer-filter').onclick = function () { answersOnly = !answersOnly; this.classList.toggle('active', answersOnly); renderDetail(); };
    restoreWindowRect(app);
    setupWindowControls(app);
    applyResponsiveScale();
  }

  function setupStorageSettings() {
    var checkbox = document.getElementById('aic-hidden-folder');
    var openButton = document.getElementById('aic-open-folder');
    var status = document.getElementById('aic-folder-status');
    try { checkbox.checked = localStorage.getItem(HIDDEN_FOLDER_KEY) === 'true'; } catch (_) {}
    openButton.disabled = !checkbox.checked;
    checkbox.onchange = function () {
      folderRequestVersion++;
      try { localStorage.setItem(HIDDEN_FOLDER_KEY, String(checkbox.checked)); } catch (_) {}
      openButton.disabled = !checkbox.checked;
      if (!checkbox.checked) {
        remoteRecords = null; selectedId = ''; refresh();
        status.textContent = '숨김 폴더 열기 해제 · 로컬 기록을 표시합니다.';
      }
    };
    document.getElementById('aic-local-records').onclick = function () {
      folderRequestVersion++; remoteRecords = null; selectedId = ''; refresh();
      openButton.disabled = !checkbox.checked;
      status.textContent = '로컬 기록을 표시합니다.';
    };
    openButton.onclick = async function () {
      if (!checkbox.checked) return;
      var version = ++folderRequestVersion;
      openButton.disabled = true;
      status.textContent = '숨겨진 JENA_DATA 폴더를 불러오는 중…';
      try {
        var result = await readRemoteFolder();
        if (!checkbox.checked || version !== folderRequestVersion) return;
        remoteRecords = result; selectedId = ''; activeType = 'all';
        document.getElementById('aic-search').value = '';
        await refresh();
        status.textContent = 'WebDAV /JENA_DATA · ' + result.length + '개 기록 · 읽기 전용';
      } catch (error) {
        if (version === folderRequestVersion) status.textContent = '폴더 열기 실패: ' + error.message;
      } finally {
        if (version === folderRequestVersion) openButton.disabled = !checkbox.checked;
      }
    };
  }

  function readRemoteFolder() {
    return new Promise(function (resolve, reject) {
      if (root.parent === root) { reject(new Error('WebDAV 앱에서 AI 데이터센터를 열어 주세요.')); return; }
      var requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      var timer = setTimeout(function () { finish(new Error('WebDAV 응답 시간이 초과되었습니다.')); }, 60000);
      function finish(error, records) {
        clearTimeout(timer); root.removeEventListener('message', receive);
        if (error) reject(error); else resolve(records);
      }
      function receive(event) {
        if (event.source !== root.parent || event.origin !== root.location.origin) return;
        var data = event.data;
        if (!data || data.type !== 'jena-read-result' || data.requestId !== requestId) return;
        finish(data.ok ? null : new Error(data.error || '기록 읽기 실패'), data.records || []);
      }
      root.addEventListener('message', receive);
      root.parent.postMessage({ type: 'jena-read-records', requestId: requestId }, root.location.origin);
    });
  }

  function renderTabs() {
    var types = [['all', '전체'], ['conversation', '대화'], ['academic_search', '학술검색'], ['image', '이미지'], ['attachment', '첨부 사용']];
    document.getElementById('aic-tabs').innerHTML = types.map(function (item) {
      var count = item[0] === 'all' ? records.length : records.filter(function (record) { return record.recordType === item[0]; }).length;
      return '<button type="button" data-type="' + item[0] + '" class="' + (activeType === item[0] ? 'active' : '') + '">' + item[1] + ' <b>' + count + '</b></button>';
    }).join('');
    document.querySelectorAll('#aic-tabs button').forEach(function (button) { button.onclick = function () { activeType = button.dataset.type; selectedId = ''; render(); }; });
  }

  function render() {
    renderTabs();
    var query = String(document.getElementById('aic-search').value || '').trim().toLowerCase();
    var filtered = records.filter(function (record) { return (activeType === 'all' || record.recordType === activeType) && (!query || searchable(record).includes(query)); });
    if (!selectedId && filtered[0]) selectedId = filtered[0].id;
    document.getElementById('aic-list').innerHTML = filtered.length ? filtered.map(function (record) {
      var count = record.recordType === 'conversation' ? (record.messages || []).length : record.recordType === 'academic_search' ? (record.results || []).length : '';
      return '<button type="button" data-id="' + escapeHtml(record.id) + '" class="aic-list-item ' + (selectedId === record.id ? 'active' : '') + '"><small>' + typeLabel(record.recordType) + '</small><strong>' + escapeHtml(titleOf(record)) + '</strong><span>' + (count !== '' ? count + '개 · ' : '') + escapeHtml(new Date(record.updatedAt || record.createdAt || 0).toLocaleString()) + '</span></button>';
    }).join('') : '<p class="aic-empty">표시할 AI 사용 기록이 없습니다.</p>';
    document.querySelectorAll('.aic-list-item').forEach(function (button) { button.onclick = function () { selectedId = button.dataset.id; render(); }; });
    renderDetail();
  }

  function academicResults(record) {
    return '<section class="aic-results"><h3>학술검색 결과 ' + (record.results || []).length + '건</h3>' + (record.results || []).map(function (source, index) {
      var url = source.url || (source.doi ? 'https://doi.org/' + source.doi : '');
      return '<article><b>' + (index + 1) + '</b><div><strong>' + escapeHtml(source.title || '제목 없음') + '</strong><p>' + escapeHtml([source.authorLabel, source.year, source.journal].filter(Boolean).join(' · ')) + '</p>'
        + (source.abstract ? '<details><summary>초록 보기</summary><div>' + escapeHtml(source.abstract) + '</div></details>' : '')
        + (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">원문/DOI 열기</a>' : '') + '</div></article>';
    }).join('') + '</section>';
  }

  function renderDetail() {
    var host = document.getElementById('aic-detail');
    var record = records.find(function (item) { return item.id === selectedId; });
    if (!record) { host.innerHTML = '<div class="aic-detail-empty">왼쪽에서 AI 사용 기록을 선택하세요.</div>'; return; }
    var content = '';
    if (record.recordType === 'conversation') {
      var messages = (record.messages || []).map(function (message, index) { return { message: message, index: index }; }).filter(function (entry) { return !answersOnly || entry.message.role === 'assistant'; });
      content = '<section class="aic-messages">' + messages.map(function (entry) {
        var message = entry.message; var key = record.id + ':' + entry.index; var assistant = message.role === 'assistant';
        var mode = messageView[key] || 'pv'; var zoom = messageZoom[key] || 100;
        var actions = assistant ? '<div class="aic-answer-actions"><button data-action="window">새창에서 보기</button><button data-action="zoom-out">A−</button><span>' + zoom + '%</span><button data-action="zoom-in">A+</button><button data-action="md" class="' + (mode === 'md' ? 'active' : '') + '">MD</button><button data-action="pv" class="' + (mode === 'pv' ? 'active' : '') + '">PV</button><button data-action="raw-copy">rawMD 복사</button><button data-action="render-copy">Render 복사</button><button data-action="delete">삭제</button></div>' : '';
        var body = mode === 'md' ? '<pre class="aic-answer-raw">' + escapeHtml(message.content || '') + '</pre>' : '<div class="aic-answer-preview">' + markdownHtml(message.content || '') + '</div>';
        return '<article class="' + (assistant ? 'assistant' : 'user') + '" data-message-index="' + entry.index + '" data-message-key="' + escapeHtml(key) + '"><header><b>' + (assistant ? 'AI 답변' : '질문') + '</b>' + actions + '</header><div class="aic-answer-body" style="font-size:' + zoom + '%">' + body + '</div></article>';
      }).join('') + '</section>';
    } else if (record.recordType === 'academic_search') content = '<div class="aic-query"><b>검색어</b><p>' + escapeHtml(record.query || '') + '</p></div>' + academicResults(record);
    else if (record.recordType === 'image' && record.dataUrl) content = '<img class="aic-image" src="' + escapeHtml(record.dataUrl) + '" alt="' + escapeHtml(record.name || 'AI 이미지') + '">';
    else content = '<div class="aic-query"><b>AI 입력에 사용된 첨부 기록</b><p>원문은 저장하지 않습니다. ' + escapeHtml(record.name || '') + ' · ' + escapeHtml(record.mimeType || '') + '</p></div>';
    host.innerHTML = '<header class="aic-detail-head"><div><small>' + typeLabel(record.recordType) + '</small><h2>' + escapeHtml(titleOf(record)) + '</h2><p>' + escapeHtml([record.provider, record.model, record.conversationTitle].filter(Boolean).join(' · ')) + '</p></div><button id="aic-delete" type="button">기록 삭제</button></header>' + content;
    document.getElementById('aic-delete').hidden = remoteRecords !== null;
    host.querySelectorAll('[data-action=delete]').forEach(function (button) { button.hidden = remoteRecords !== null; });
    document.getElementById('aic-delete').onclick = async function () { if (remoteRecords !== null) return; if (!confirm('이 AI 사용 기록을 삭제할까요?')) return; await remove(record.id); await refresh(); };
    host.querySelectorAll('.aic-answer-actions button').forEach(function (button) {
      button.onclick = async function () {
        var card = button.closest('[data-message-index]'); var index = Number(card.dataset.messageIndex); var key = card.dataset.messageKey;
        var message = record.messages[index]; var action = button.dataset.action; if (!message) return;
        if (action === 'window') openAnswerWindow(message.content, questionForMessage(record.messages, index));
        else if (action === 'zoom-out' || action === 'zoom-in') { messageZoom[key] = Math.max(70, Math.min(180, (messageZoom[key] || 100) + (action === 'zoom-in' ? 10 : -10))); renderDetail(); }
        else if (action === 'md' || action === 'pv') { messageView[key] = action; renderDetail(); }
        else if (action === 'raw-copy') await copyText(message.content || '');
        else if (action === 'render-copy') await copyRendered(message.content || '');
        else if (remoteRecords === null && action === 'delete' && confirm('이 AI 답변만 삭제할까요?')) { record.messages.splice(index, 1); record.updatedAt = Date.now(); await save(record); await refresh(); }
      };
    });
  }

  async function refresh() { records = (remoteRecords !== null ? remoteRecords.slice() : await readAll()).sort(function (a, b) { return Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0); }); render(); }
  async function open() {
    ensureUi();
    if (root.AIChat && typeof root.AIChat.close === 'function') root.AIChat.close();
    await migrateLegacyOnce();
    var app = document.getElementById('ai-data-center-app');
    app.hidden = false;
    fitNextToAIJena(app);
    applyResponsiveScale();
    await refresh();
    syncWebDAV().then(refresh).catch(function () {});
  }
  function close() { var app = document.getElementById('ai-data-center-app'); if (app) app.hidden = true; }

  root.addEventListener('online', scheduleSync);
  scheduleSync();

  root.AIDataCenter = { save: save, remove: remove, readAll: readAll, syncNow: syncWebDAV, open: open, close: close, refresh: refresh, databaseName: DB_NAME };
})(window);

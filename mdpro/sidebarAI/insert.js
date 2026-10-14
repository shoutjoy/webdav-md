(function () {
  'use strict';
  if (window.SidebarAIInsert && window.SidebarAIInsert.__ready) return;

  function deps() {
    return window.SidebarAIInsertDeps || {};
  }

  function getSelectionState() {
    var d = deps();
    if (typeof d.getSelectionState === 'function') return d.getSelectionState();
    return {
      selStart: null,
      selEnd: null,
      cursorPos: null,
      lastSelectionTarget: null
    };
  }

  function setSelectionState(next) {
    var d = deps();
    if (typeof d.setSelectionState === 'function') d.setSelectionState(next || {});
  }

  function isTextSelectionControl(el) {
    var d = deps();
    if (typeof d.isTextSelectionControl === 'function') return !!d.isTextSelectionControl(el);
    return false;
  }

  function isAiPanelElement(node) {
    var d = deps();
    if (typeof d.isAiPanelElement === 'function') return !!d.isAiPanelElement(node);
    return false;
  }

  function getInsertResultText() {
    var d = deps();
    if (typeof d.getInsertResultText === 'function') return String(d.getInsertResultText() || '');
    return '';
  }

  function getTranslationFootnoteText() {
    var d = deps();
    if (typeof d.getTranslationFootnoteText === 'function') return String(d.getTranslationFootnoteText() || '');
    return '';
  }

  function setResultTabInsert() {
    var d = deps();
    if (typeof d.setResultTab === 'function') d.setResultTab('insert');
  }

  function toggleScholarAIInsertMenu() {
    var menu = document.getElementById('scholar-ai-insert-menu');
    refreshInsertMode();
    if (menu) menu.classList.toggle('open');
  }

  function closeScholarAIInsertMenu() {
    var menu = document.getElementById('scholar-ai-insert-menu');
    if (menu) menu.classList.remove('open');
  }

  var modeKey = 'ss_scholar_ai_insert_mode';
  var labels = {0:'커서위치삽입',1:'문서 한줄 아래에 삽입',2:'선택 내용 대체',3:'ToGenslide',4:'Mermaid 삽입',6:'번역 각주 삽입'};
  var selectedMode = 0;
  try { var stored = Number(localStorage.getItem(modeKey)); if (labels[stored]) selectedMode = stored; } catch (_) {}
  function refreshInsertMode() {
    var button = document.getElementById('scholar-ai-insert-mode-button');
    if (button) button.textContent = labels[selectedMode];
    var menu = document.getElementById('scholar-ai-insert-menu');
    if (menu) menu.querySelectorAll('[data-insert-mode]').forEach(function (item) {
      var active = Number(item.dataset.insertMode) === selectedMode;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }
  function selectInsertMode(mode) {
    if (!labels[mode]) return;
    selectedMode = mode;
    try { localStorage.setItem(modeKey, String(mode)); } catch (_) {}
    refreshInsertMode();
    closeScholarAIInsertMenu();
  }
  function handleScholarAIInsertClick() { return scholarAIInsertDoc(selectedMode); }
  function preserveScroll(target) {
    var nodes = [], node = target;
    while (node) { nodes.push([node, node.scrollLeft, node.scrollTop]); node = node.parentElement; }
    ['content-viewport','viewer-edit-wrap'].forEach(function (id) {
      var n = document.getElementById(id); if (n) nodes.push([n,n.scrollLeft,n.scrollTop]);
    });
    var x = window.scrollX, y = window.scrollY;
    function restore() {
      nodes.forEach(function (entry) { entry[0].scrollLeft = entry[1]; entry[0].scrollTop = entry[2]; });
      if (window.scrollTo) window.scrollTo(x,y);
    }
    return function () { restore(); if (window.requestAnimationFrame) window.requestAnimationFrame(function () { restore(); window.requestAnimationFrame(restore); }); };
  }
  var captured = null, live = null;
  function captureReplacement(target, start, end, passage) {
    captured = { target:target, start:start, end:end, original:String(target.value).slice(start,end), passage:passage, base:String(target.value) };
  }
  function capturePassage() {
    captured = null;
    try {
      var tx = resolveReplacement();
      var passage = document.getElementById('scholar-ai-selected');
      captured = Object.assign(tx, {passage:String(passage.value || ''),base:String(tx.target.value)});
    } catch (_) { /* Ambiguous rendered selections must be selected in the editor. */ }
  }
  function resolveReplacement() {
    var passageEl = document.getElementById('scholar-ai-selected');
    var passage = passageEl ? String(passageEl.value || '') : '';
    var target = document.getElementById('viewer-edit-ta');
    if (captured && captured.passage === passage) {
      if (!captured.target.isConnected || captured.target.disabled || captured.target.readOnly || String(captured.target.value) !== captured.base) throw new Error('선택 이후 원문이 변경되었습니다. 원문을 다시 선택하세요.');
      return Object.assign({}, captured);
    }
    var viewport = document.getElementById('content-viewport');
    var viewing = viewport && !viewport.classList.contains('viewer-edit-active');
    var raw = target && String(viewing && typeof window.__rawText === 'string' ? window.__rawText : (target.value || window.__rawText || ''));
    var start = passage && raw ? raw.indexOf(passage) : -1;
    if (start < 0 || raw.indexOf(passage,start+1) >= 0) throw new Error('문서 내 일치하는 위치가 없거나 여러 곳입니다. 원문을 다시 선택하세요.');
    if (!target || target.disabled || target.readOnly) throw new Error('편집할 문서를 먼저 여세요.');
    if (String(target.value) !== raw) target.value = raw;
    return {target:target,start:start,end:start+passage.length,original:passage};
  }
  function activateDocumentEditor(tx) {
    var vp = document.getElementById('content-viewport');
    if (tx.target === document.getElementById('viewer-edit-ta') && vp && !vp.classList.contains('viewer-edit-active')) {
      var restore = preserveScroll(tx.target);
      vp.classList.add('viewer-edit-active');
      var wrap = document.getElementById('viewer-edit-wrap'); if (wrap) wrap.style.display = 'flex';
      tx.target.style.display = 'block';
      var edit = document.getElementById('viewer-btn-edit'), view = document.getElementById('viewer-btn-view');
      if (edit) edit.style.display = 'none'; if (view) view.style.display = 'inline-block';
      if (window.viewerBuildNav) window.viewerBuildNav(); restore();
    }
  }
  function writeReplacement(tx, text) {
    var raw = String(tx.target.value);
    var current = tx.current == null ? tx.original : tx.current;
    if (raw.slice(tx.start,tx.start+current.length) !== current || raw.slice(0,tx.start) !== tx.before || raw.slice(tx.start+current.length) !== tx.after) throw new Error('작성 중 문서가 변경되었습니다. 원문을 다시 선택하세요.');
    var restore = preserveScroll(tx.target);
    tx.target.value = tx.before + text + tx.after;
    tx.current = text;
    if (tx.target === document.getElementById('viewer-edit-ta')) window.__rawText = tx.target.value;
    tx.target.dispatchEvent(new Event('input',{bubbles:true}));
    restore();
  }
  function beginReplacement() {
    var checkbox = document.getElementById('scholar-ai-live-replace');
    if (!checkbox || !checkbox.checked) return null;
    if (live) throw new Error('실시간 작성이 이미 실행 중입니다.');
    var tx = resolveReplacement();
    var raw = String(tx.target.value);
    tx.before = raw.slice(0,tx.start); tx.after = raw.slice(tx.end); tx.current = tx.original;
    activateDocumentEditor(tx);
    live = tx;
    writeReplacement(tx,'');
    return tx;
  }
  function updateReplacement(tx,text) { if (tx && live === tx) { try { writeReplacement(tx,text); } catch (error) { cancelReplacement(); throw error; } } }
  function finishReplacement(tx,text) {
    if (!tx || live !== tx) return;
    if (!String(text || '').trim()) { cancelReplacement(); return; }
    writeReplacement(tx,text); live = null; captured = null;
  }
  function cancelReplacement(expected) {
    if (expected && live !== expected) return;
    var tx = live; live = null;
    if (!tx) return;
    // Restore only our owned range; never overwrite unrelated user edits.
    var raw = String(tx.target.value), start = tx.start;
    if (raw.slice(start,start+tx.current.length) === tx.current) {
      var restore = preserveScroll(tx.target);
      tx.target.value = raw.slice(0,start)+tx.original+raw.slice(start+tx.current.length);
      if (tx.target === document.getElementById('viewer-edit-ta')) window.__rawText = tx.target.value;
      tx.target.dispatchEvent(new Event('input',{bubbles:true})); restore();
    }
  }
  window.scholarAISelectInsertMode = selectInsertMode;
  window.ScholarAIReplacement = {isActive:function () { return !!live; },capture:captureReplacement,capturePassage:capturePassage,resolve:resolveReplacement,begin:beginReplacement,update:updateReplacement,finish:finishReplacement,cancel:cancelReplacement};
  window.scholarAIRefreshInsertMode = refreshInsertMode;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',refreshInsertMode); else refreshInsertMode();

  function showInsertNotice(message, isError) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(message); return; } catch (e) {}
    }
    if (isError) alert(message);
  }

  function ensureGenSlidePanelOpen() {
    if (typeof window.openHtml2pptPanel === 'function') {
      try { window.openHtml2pptPanel(); } catch (e) {}
    }
    var frame = document.getElementById('html2ppt-frame') || document.querySelector('iframe[title="GenSlide"]');
    if (frame && !frame.getAttribute('src') && frame.dataset && frame.dataset.src) {
      frame.setAttribute('src', frame.dataset.src);
    }
    return frame;
  }

  function waitForGenSlideEditor(frame, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      function check() {
        if (!frame || !frame.isConnected) {
          reject(new Error('GenSlide frame is unavailable.'));
          return;
        }
        try {
          var docRef = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (docRef && docRef.getElementById('code')) {
            resolve(docRef);
            return;
          }
        } catch (e) {}
        if (Date.now() - started >= timeoutMs) {
          reject(new Error('GenSlide editor did not finish loading.'));
          return;
        }
        setTimeout(check, 60);
      }
      check();
    });
  }

  function postSlidesToGenSlide(frame, resultText) {
    return new Promise(function (resolve, reject) {
      var targetWindow = frame && frame.contentWindow;
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') {
        reject(new Error('GenSlide message channel is unavailable.'));
        return;
      }
      var settled = false;
      var timer = null;
      function cleanup() {
        window.removeEventListener('message', onMessage);
        if (timer) clearTimeout(timer);
      }
      function finish(ok, error) {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(true);
        else reject(error || new Error('GenSlide did not confirm the transfer.'));
      }
      function onMessage(event) {
        var data = event && event.data;
        if (event.source !== targetWindow || !data || data.type !== 'mdv-scholar-genslide-insert-result') return;
        finish(data.ok === true, data.ok === true ? null : new Error('GenSlide rejected the slide HTML.'));
      }
      window.addEventListener('message', onMessage);
      timer = setTimeout(function () { finish(false); }, 2200);
      try {
        targetWindow.postMessage({
          type: 'mdv-scholar-genslide-insert',
          mode: 'multi',
          strategy: 'replace-all',
          text: String(resultText || '')
        }, '*');
      } catch (e) {
        finish(false, e);
      }
    });
  }

  async function sendScholarAIResultToGenSlide(resultText) {
    var frame = ensureGenSlidePanelOpen();
    if (!frame) {
      alert('GenSlide 창을 찾지 못했습니다. GenSlide 기능이 활성화되어 있는지 확인해주세요.');
      return false;
    }
    try {
      await waitForGenSlideEditor(frame, 6000);
      await postSlidesToGenSlide(frame, resultText);
      showInsertNotice('슬라이드 HTML을 GenSlide로 보냈습니다.', false);
      return true;
    } catch (error) {
      var docRef = null;
      try { docRef = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); } catch (e) {}
      var fallbackTarget = findWritableControlInDoc(docRef, 'code');
      if (fallbackTarget && insertIntoTextControl(fallbackTarget, resultText, false)) {
        showInsertNotice('슬라이드 HTML을 GenSlide 코드창으로 보냈습니다.', false);
        return true;
      }
      alert('GenSlide로 보내지 못했습니다: ' + ((error && error.message) || '연결 오류'));
      return false;
    }
  }

  function findDocFromFrames(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var frame = document.querySelector(selectors[i]);
      if (!frame) continue;
      try {
        var d = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
        if (d) return d;
      } catch (e) {}
    }
    return null;
  }

  function findWritableControlInDoc(docRef, preferredId) {
    if (!docRef) return null;
    if (preferredId) {
      var preferred = docRef.getElementById(preferredId);
      if (isTextSelectionControl(preferred) && !preferred.disabled && !preferred.readOnly) return preferred;
    }
    var active = docRef.activeElement;
    if (isTextSelectionControl(active) && !active.disabled && !active.readOnly) return active;
    var first = docRef.querySelector('textarea:not([disabled]):not([readonly]),input[type="text"]:not([disabled]):not([readonly])');
    if (isTextSelectionControl(first)) return first;
    return null;
  }

  function insertIntoTextControl(target, text, appendMode) {
    if (!target) return false;
    var restoreScroll = preserveScroll(target);
    var raw = String(target.value || '');
    var s = isFinite(target.selectionStart) ? target.selectionStart : raw.length;
    var e = isFinite(target.selectionEnd) ? target.selectionEnd : s;
    s = Math.max(0, Math.min(s, raw.length));
    e = Math.max(0, Math.min(e, raw.length));
    var before = raw.slice(0, s);
    var selected = raw.slice(s, e);
    var after = raw.slice(e);
    var next = appendMode ? (before + selected + '\n\n' + text + after) : (before + text + after);
    target.value = next;
    var caret = appendMode ? (s + selected.length + 2 + text.length) : (s + text.length);
    if (typeof target.focus === 'function') target.focus({ preventScroll: true });
    if (typeof target.setSelectionRange === 'function') target.setSelectionRange(caret, caret);
    try {
      var evCtor = (target.ownerDocument && target.ownerDocument.defaultView && target.ownerDocument.defaultView.Event) || Event;
      target.dispatchEvent(new evCtor('input', { bubbles: true }));
      target.dispatchEvent(new evCtor('change', { bubbles: true }));
    } catch (e2) {}
    restoreScroll();
    return true;
  }

  function scholarAIInsertDoc(mode) {
    var resultText = mode === 6 ? getTranslationFootnoteText() : getInsertResultText();
    if (!resultText) {
      alert(mode === 6 ? '삽입할 학술번역 주요 용어 풀이가 없습니다.' : 'There is no ScholarAI result to insert.');
      return;
    }

    if (mode === 3) {
      sendScholarAIResultToGenSlide(resultText);
      return;
    }

    if (mode === 4) {
      var mmDoc = findDocFromFrames([
        '#mermaid-editor-frame',
        'iframe[title="Mermaid Editor"]',
        'iframe[src*="mermaid-editor/index.html"]'
      ]);
      var mmTarget = findWritableControlInDoc(mmDoc, 'raw-code-editor');
      if (!mmTarget) {
        alert('Mermaid 코드 입력창을 찾지 못했습니다. Mermaid Editor를 먼저 열어주세요.');
        return;
      }
      insertIntoTextControl(mmTarget, resultText, false);
      setSelectionState({
        selStart: null,
        selEnd: null,
        cursorPos: isFinite(mmTarget.selectionStart) ? mmTarget.selectionStart : String(mmTarget.value || '').length,
        lastSelectionTarget: mmTarget
      });
      return;
    }

    if (mode === 2) {
      try {
        var tx = resolveReplacement(), rawReplacement = String(tx.target.value);
        tx.before = rawReplacement.slice(0,tx.start); tx.after = rawReplacement.slice(tx.end); tx.current = tx.original;
        activateDocumentEditor(tx);
        writeReplacement(tx,resultText); captured = null;
      } catch (error) { alert(error.message); }
      return;
    }
    var state = getSelectionState();
    var ta = document.getElementById('viewer-edit-ta');
    var restoreDocumentScroll = preserveScroll(ta);
    var isEdit = document.getElementById('content-viewport') && document.getElementById('content-viewport').classList.contains('viewer-edit-active');
    var viewerBuildNav = typeof window.viewerBuildNav === 'function' ? window.viewerBuildNav : function () {};

    var target = (isEdit && ta) ? ta : null;

    if (!target && state.lastSelectionTarget && state.lastSelectionTarget.isConnected && isTextSelectionControl(state.lastSelectionTarget)) {
      target = state.lastSelectionTarget;
    }
    if (!target && isTextSelectionControl(document.activeElement) && !isAiPanelElement(document.activeElement)) {
      target = document.activeElement;
    }

    if (!target) {
      var gsFrame = document.getElementById('html2ppt-frame');
      try {
        var gsDoc2 = gsFrame && (gsFrame.contentDocument || (gsFrame.contentWindow && gsFrame.contentWindow.document));
        if (gsDoc2) {
          var gsActive = gsDoc2.activeElement;
          if (isTextSelectionControl(gsActive) && !gsActive.disabled && !gsActive.readOnly) target = gsActive;
          if (!target) {
            var gsCode = gsDoc2.getElementById('code');
            if (isTextSelectionControl(gsCode) && !gsCode.disabled && !gsCode.readOnly) target = gsCode;
          }
          if (!target) {
            var gsAny = gsDoc2.querySelector('textarea:not([disabled]):not([readonly]),input[type="text"]:not([disabled]):not([readonly])');
            if (isTextSelectionControl(gsAny)) target = gsAny;
          }
        }
      } catch (e) {}
    }

    if (!target) {
      var vp = document.getElementById('content-viewport');
      var wrap = document.getElementById('viewer-edit-wrap');
      if (vp) vp.classList.add('viewer-edit-active');
      if (wrap) wrap.style.display = 'flex';
      ta = document.getElementById('viewer-edit-ta');
      if (ta) {
        ta.value = window.__rawText || '';
        ta.style.display = 'block';
      }
      var eb = document.getElementById('viewer-btn-edit');
      var vb = document.getElementById('viewer-btn-view');
      if (eb) eb.style.display = 'none';
      if (vb) vb.style.display = 'inline-block';
      viewerBuildNav();
      target = document.getElementById('viewer-edit-ta');
    }
    if (!target) return;

    var restoreScroll = preserveScroll(target);
    var start;
    var end;
    var raw = String(target.value || '');
    if (mode === 0) {
      var fallbackPos = isFinite(target.selectionStart) ? target.selectionStart : raw.length;
      start = end = (state.cursorPos != null ? state.cursorPos : fallbackPos);
    } else if (state.selStart != null && state.selEnd != null && state.lastSelectionTarget === target) {
      start = state.selStart;
      end = state.selEnd;
    } else {
      var selTa = document.getElementById('scholar-ai-selected');
      var selText = (selTa && selTa.value) ? selTa.value.trim() : '';
      var idx = selText ? raw.indexOf(selText) : -1;
      if (idx >= 0) {
        start = idx;
        end = idx + selText.length;
      } else {
        start = isFinite(target.selectionStart) ? target.selectionStart : raw.length;
        end = isFinite(target.selectionEnd) ? target.selectionEnd : start;
      }
    }
    start = Math.max(0, Math.min(start, raw.length));
    end = Math.max(0, Math.min(end, raw.length));
    var before = raw.slice(0, start);
    var after = raw.slice(end);
    var newVal = mode === 1 ? before + raw.slice(start, end) + '\n\n' + resultText + after : before + resultText + after;
    target.value = newVal;
    if (target === document.getElementById('viewer-edit-ta')) window.__rawText = newVal;
    var insertEnd = mode === 1 ? start + (end - start) + 2 + resultText.length : start + resultText.length;
    setSelectionState({
      cursorPos: insertEnd,
      selStart: null,
      selEnd: null,
      lastSelectionTarget: target
    });
    target.focus({ preventScroll: true });
    if (typeof target.setSelectionRange === 'function') target.setSelectionRange(insertEnd, insertEnd);
    try {
      var evCtor = (target.ownerDocument && target.ownerDocument.defaultView && target.ownerDocument.defaultView.Event) || Event;
      target.dispatchEvent(new evCtor('input', { bubbles: true }));
      target.dispatchEvent(new evCtor('change', { bubbles: true }));
    } catch (e) {}
    restoreScroll();
    restoreDocumentScroll();
  }

  window.SidebarAIInsert = {
    __ready: true,
    handleScholarAIInsertClick: handleScholarAIInsertClick,
    toggleScholarAIInsertMenu: toggleScholarAIInsertMenu,
    closeScholarAIInsertMenu: closeScholarAIInsertMenu,
    scholarAIInsertDoc: scholarAIInsertDoc
  };

  window.handleScholarAIInsertClick = handleScholarAIInsertClick;
  window.toggleScholarAIInsertMenu = toggleScholarAIInsertMenu;
  window.closeScholarAIInsertMenu = closeScholarAIInsertMenu;
  window.scholarAIInsertDoc = scholarAIInsertDoc;
  window.scholarAIToGenSlide = function () { return scholarAIInsertDoc(3); };
})();

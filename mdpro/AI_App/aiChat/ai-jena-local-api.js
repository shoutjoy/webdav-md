/* AI Jena web-search adapter: integrated service first, same-origin API fallback. */
(function (root) {
  'use strict';

  var INTEGRATED_BASE = 'http://127.0.0.1:8765/api';

  async function readJson(response) {
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || payload.detail || '인터넷 검색에 실패했습니다.');
    }
    return payload;
  }

  async function webSearch(query, count, mode, options) {
    var value = String(query || '').trim().slice(0, 500);
    if (!value) throw new Error('인터넷 검색어를 입력하세요.');
    var limit = Math.max(1, Math.min(50, Math.round(Number(count) || 10)));
    var searchMode = mode === 'reasoning' ? 'reasoning' : 'quick';
    var params = new URLSearchParams({ q: value, count: String(limit), mode: searchMode });
    var request = { cache: 'no-store', signal: options && options.signal };
    var primaryError = null;
    try {
      return await readJson(await fetch(INTEGRATED_BASE + '/web-search/?' + params, request));
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      primaryError = error;
    }
    try {
      var payload = await readJson(await fetch('/api/web-search/?' + params, request));
      payload.fallbackUsed = true;
      if (!payload.fallbackMessage) payload.fallbackMessage = '통합 검색 서비스 대신 앱 검색을 사용했습니다.';
      return payload;
    } catch (fallbackError) {
      if (fallbackError && fallbackError.name === 'AbortError') throw fallbackError;
      if (primaryError && /Failed to fetch|fetch failed|NetworkError|Load failed/i.test(String(primaryError.message || primaryError))) {
        throw new Error('AI Jena 로컬 검색 서버(127.0.0.1:8765)가 실행되지 않았거나 이 페이지의 접근이 허용되지 않았습니다. AI Studio를 선택하면 내장 Google 검색을 사용할 수 있습니다.');
      }
      throw new Error((fallbackError && fallbackError.message) || (primaryError && primaryError.message) || '인터넷 검색 서비스를 사용할 수 없습니다.');
    }
  }

  root.AIJenaLocalAPI = Object.freeze({ webSearch: webSearch });
})(window);

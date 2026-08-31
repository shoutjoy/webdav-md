/* Portable AI JENA Mermaid syntax gate. No provider or editor dependency. */
(function (root) {
  'use strict';
  var caches = new WeakMap();
  var rules = 'Mermaid: use the host-supported syntax (this app targets 11.14.0). Use simple IDs N1,N2; quote flowchart labels, e.g. N1["입력"] --> N2["처리"]. Declare nodes and edges on separate lines. Escape embedded quotes as #quot;. Do not use end as a node ID. Close every subgraph and code fence. Prefer basic shapes; omit HTML, icons, click actions and custom themes unless requested. Return complete fenced mermaid blocks.';

  function blocks(text) {
    var lines = String(text).split(/(?<=\n)/);
    var result = [], offset = 0, open = null;
    lines.forEach(function (line) {
      var match = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)/);
      if (!open && match) {
        open = { marker: match[1][0], length: match[1].length, mermaid: /^mermaid\s*$/i.test(match[2].trim()), start: offset, body: offset + line.length };
      } else if (open && match && match[1][0] === open.marker && match[1].length >= open.length && !match[2].trim()) {
        if (open.mermaid) result.push({ start: open.start, end: offset + line.length, code: text.slice(open.body, offset).trim(), closed: true });
        open = null;
      }
      offset += line.length;
    });
    if (open && open.mermaid) result.push({ start: open.start, end: text.length, code: text.slice(open.body).trim(), closed: false });
    if (!result.length && !/^\s*[`~]{3}/m.test(text) && /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|block-beta|sankey-beta)\b/.test(text)) {
      result.push({ start: 0, end: text.length, code: text.trim(), closed: true });
    }
    return result;
  }

  async function validate(text, engine) {
    var found = blocks(text), errors = [];
    if (!found.length) return { ok: true, blocks: found, errors: errors };
    if (!engine || typeof engine.parse !== 'function') throw new Error('Mermaid 검증 엔진을 사용할 수 없습니다.');
    var cache = caches.get(engine);
    if (!cache) { cache = new Set(); caches.set(engine, cache); }
    for (var i = 0; i < found.length; i++) {
      var block = found[i];
      try {
        if (!block.closed) throw new Error('Mermaid 코드 블록이 닫히지 않았습니다.');
        if (!block.code) throw new Error('Mermaid 코드가 비어 있습니다.');
        if (block.code.length > 50000) throw new Error('빠른 검증 한도(50,000자)를 초과했습니다. 다이어그램을 나누세요.');
        if (!cache.has(block.code)) {
          var parsed = await engine.parse(block.code);
          if (parsed === false) throw new Error('Mermaid 문법 검사 실패');
          cache.add(block.code);
          if (cache.size > 40) cache.delete(cache.values().next().value);
        }
      } catch (error) {
        errors.push({ index: i, message: String(error.message || error).slice(0, 1200) });
      }
    }
    return { ok: !errors.length, blocks: found, errors: errors };
  }

  async function guard(text, options) {
    if (!blocks(text).length) return { text: text, ok: true, repaired: false };
    options.checkActive();
    var engine = await options.loadEngine();
    options.checkActive();
    var check = await validate(text, engine);
    options.checkActive();
    if (check.ok || !options.repair) return { text: text, ok: check.ok, errors: check.errors, repaired: false };
    var invalid = check.errors.map(function (error) { return { code: check.blocks[error.index].code, error: error.message }; });
    // One request for all failed diagrams. Valid diagrams and surrounding prose are untouched.
    var response = await options.repair(invalid);
    options.checkActive();
    var replacements = blocks(response);
    if (replacements.length !== invalid.length || !(await validate(response, engine)).ok) {
      return { text: text, ok: false, errors: check.errors, repaired: false };
    }
    var output = text;
    for (var i = check.errors.length - 1; i >= 0; i--) {
      var original = check.blocks[check.errors[i].index];
      output = output.slice(0, original.start) + '```mermaid\n' + replacements[i].code + '\n```\n' + output.slice(original.end);
    }
    options.checkActive();
    return { text: output, ok: true, repaired: true };
  }
  root.AIJenaMermaidGuard = { rules: rules, blocks: blocks, validate: validate, guard: guard };
})(globalThis);

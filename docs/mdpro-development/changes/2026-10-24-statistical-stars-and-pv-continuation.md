# 통계 유의성 별표 보존과 PV 표 연결 표시 이식

- 변경 ID: `MDPRO-20261024-STATS-PV`
- 작성일: 2026-10-24
- 원본: `C:\CusorApps\Webdav_md\webdav-md`
- 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 원본 상태: 로컬 미커밋 구현. 이번 대화의 두 기능만 정리한다.
- 대상 상태: 소스 구조 읽기 완료, **런타임 미이식**. 이 문서 설치는 기능 설치가 아니다.
- Tauri 상태: 미이식·미빌드·설치 앱 미검증. [대기 목록](../TAURI_BUILD_QUEUE.md) 참조.

## 1. 기능 계약과 원인

### 통계 별표

`sig_star` 셀의 `*`, `**`, `***`, `ipa_label`의 `1***`, 추정치 `.42**`, 유의수준 설명 `*p<.05, **p<.01, ***p<.001`을 원문 그대로 표시한다. 기존 강조, 코드, 명시적 수식, 취소선, 수평선은 보존한다. 저장된 Markdown에는 엔티티를 쓰지 않고 렌더링 사본에서만 처리한다.

원인: Smart Bold의 `***...***`/`**...**` 정규식이 한 행의 서로 다른 표 셀에 있는 별표를 강조 쌍으로 묶었다. 마크다운 파서 이후에 고쳐서는 이미 사라진 별표를 복원할 수 없다.

원본 구현:

1. `mdpro/js/math_render/math_render.js`의 `MathRender.protectStatisticalMarkers(text)`가 통계 문맥의 별표만 `&#42;`로 바꾼다. 별표만 있는 표 셀, 숫자 접미 별표, p값 설명 접두 별표가 대상이다.
2. `protectMathSegments()`의 `protectChunk()`가 코드와 수식 보호 후 같은 함수를 호출한다. 공통 Markdown 진입점과 AI Jena 경로에 적용된다.
3. 메인 보기에서는 Smart Bold가 공통 Markdown 파싱보다 먼저 실행되므로 `Markdown_bold.js`의 `preprocessInlineCodeAware()`에서도 **코드·수식을 먼저 보호한 후** 같은 함수를 호출한다.
4. 브라우저가 엔티티를 실제 별표로 표시한다. 렌더링 함수를 반복 호출해도 엔티티를 이중 변환하지 않는다.

### PV 표 연결

넓은 표를 열 방향으로 나누어 아래에 붙일 때 두 번째 조각부터 표 바로 위에 우측 정렬로 `표 연결 (2/2)`, `표 연결 (2/3)` 등을 표시한다. 단일 표에는 붙이지 않는다. 긴 표가 행 방향으로 다음 페이지에 이어지면 `표 연결 (이전 페이지에서 계속)`을 표시한다.

원본 `previewPopupSetTableContinuation(table, label)`은 출력 사본의 네이티브 `<caption data-pv-table-continuation="true">`을 만든다. 별도 문단이 아니므로 표와 함께 높이를 측정하고 배치하며, 페이지 끝에 문구만 남지 않는다. 원래 제목은 첫 조각에 남긴다. 작은 글자·상속 색상을 사용해 다크/라이트와 출력 사본에서 읽을 수 있도록 했다.

`previewPopupFitTableWidth()`에서 두 번째 열 조각부터 라벨을 설정한다. `previewPopupSplitTableRows()`는 이어지는 행 조각에 자동 캡션을 보존하고, 자동 캡션이 없으면 페이지 연결 캡션을 생성한다. 원본 표·헤더·데이터·첫 키 열 반복·열 비율·rowspan 묶음·마지막 footer를 유지해야 한다. 이 표시는 PV 출력 사본에서만 생성하며 편집 원문에 추가하지 않는다.

## 2. 대상 앱에서 확인한 실제 차이

2026-10-24 파일 읽기 기준이다. 이식 시 다시 확인한다.

| 원본 | MDproViewer 대응 | 실제 차이와 조치 |
| --- | --- | --- |
| `mdpro/js/math_render/math_render.js` | `js/math_render/math_render.js` | 대상에 `protectMathSegments`는 있으나 신규 통계 보호 함수는 없다. 기존 수식 수정들을 보존하면서 helper와 호출만 이식한다. |
| `mdpro/js/Markdown_bold.js` | `js/Markdown_bold.js` | 대상은 `preprocessBoldText()` 내부에서 인라인 코드를 보호하고, `preprocessInlineCodeAware()`는 수식만 보호한다. 통계 보호를 수식 보호 직후 넣기만 하면 코드 안의 `1***`까지 바꿀 수 있다. **코드도 보호한 뒤** 통계 보호를 실행하도록 대상 구조에 맞춘다. 기존 코드 사이 굵게 처리도 유지한다. |
| `mdpro/js/UI_PV/editpv.js` | `js/UI_PV/editpv.js` | 대상에 행 분할 함수는 있으나 원본의 `previewPopupFitTableWidth`가 없다. 라벨 호출만 추가해도 첨부처럼 열 방향 분할이 발생하지 않는다. 아래 선행 이식이 필요하다. |
| `mdpro/index.html` | `index.html` | 스크립트 순서와 캐시 URL을 대상 기준으로 확인한다. `window.MathRender`가 실행 시 준비되어야 한다. |
| `mdpro/Apps/PWA/service-worker.js` | 실제 PWA 등록 URL 확인 | 대상 루트에도 `service-worker.js`가 있다. 이름만 보고 경로를 동일하게 가정하지 않는다. 실제 등록 경로·캐시 버전을 갱신한다. |
| `tests/markdownMathPlaceholders.test.mjs` | 신규 또는 기존 수식 회귀 테스트에 통합 | 원본은 `markdown-it` 의존성이 있다. 대상 루트에는 package.json이 없고 `Tauri/node_modules`에는 Marked가 있으므로 테스트 환경을 명시하고 실제 Marked 검증도 포함한다. |
| `tests/pvTablePagination.browser.cjs` | 기존 PV 회귀 테스트 조사 후 추가 | 대상의 함수·부트스트랩·테스트 경로에 맞춘다. 원본 테스트의 경로·함수 추출 범위를 그대로 복사하지 않는다. |

### 넓은 표 분할 선행 이식

원본에서 `previewPopupFitTableWidth()` 전체와 `previewPopupRenderPaginatedPages()`의 호출 지점을 읽고 대상에 대응 구현한다. 전체 `editpv.js` 덮어쓰기를 금지한다.

- 실제 용지 본문 폭으로 측정하고, 가독성 최소 배율은 `max(0.8, 11/fontSize)`로 계산한다.
- rowspan을 포함한 논리 열을 만들고, colspan을 가로지르는 열 경계에서는 자르지 않는다.
- 분할된 후속 표에는 안전할 때 첫 키 열을 반복한다. 모든 열·행·셀 값이 원래 순서로 보존되어야 한다.
- 너비 정규화·줄바꿈·조각 생성은 출력 사본에서만 한다. 측정 DOM에서 임시 사본을 제거한다.
- 열 조각을 기존 행 페이지 분할에 전달한다. 대상의 행 분할·남은 높이 재측정 흐름과 통합해 모든 조각이 실제 용지에 들어가게 한다.
- 첫 조각만 원본 caption을 유지하고 후속 조각은 연결 caption을 붙인다. 문구 높이도 페이지 높이에 포함한다.

## 3. 적용 순서

1. 대상 변경 상태와 AGENTS 및 수식·인쇄 계약을 확인한다. 기존 독립 수정은 보존한다.
2. 통계 보호 helper와 대상의 코드/수식 보호 순서를 먼저 수정하고 회귀 검증한다.
3. 대상의 넓은 표 분할 선행 기능을 이식하고 열·행·병합·footer 보존을 확인한다.
4. 연결 caption helper 및 열/행 분할 호출을 이식한다. 자동 caption 중복 생성과 원문 유입을 막는다.
5. 대상 스크립트 URL·PWA 캐시를 갱신한다. 원본 버전 문자열을 기계적으로 덮어쓰지 않는다.
6. 대상의 메인 보기, 실제 PV, AI 답변 경로와 필요한 출력 경로를 검증한다.
7. 문서·목록·Tauri 대기 목록을 증거에 맞춰 갱신한다. Tauri 빌드 요청이면 별도 runbook을 수행한다.

## 4. 재현 자료

```markdown
| item | sig_star | ipa_label | estimate |
| --- | --- | --- | --- |
| 1 | * | 1* | .42* |
| 2 | ** | 2** | .42** |
| 3 | *** | 3*** | .42*** |

유의성: *p<.05, **p<.01, ***p<.001

**굵게** *기울임* ***굵은 기울임*** **2024**

`1*** | **p<.01`

***

$x_i * y_i$ 및 \(*p<.05, **p<.01, ***p<.001\)
```

넓은 표 회귀: `domain,N,I_mean,I_sd,P_mean,P_sd,Gap,item,quadrant,Gap_sd,t,df,p_t,p_t_holm,CI_low,CI_high,dz,sig_t,Priority,rank`의 20열과 5행을 사용한다. `domain`은 한글 영역명, `sig_t`는 `***`, 수치는 `2.929` 등으로 채운다. A4 PV의 후속 열 조각에 연결 문구·반복 키 열·별표가 있어야 한다.

긴 표 회귀: 2열 90행(`항목 1`~`항목 90`, 결과 `1.42***`~`90.42***`)을 만든다. 첫 조각은 추가 문구 없이 시작하고 후속 조각은 페이지 연결 문구와 반복 헤더를 가진다. 전체 행이 순서대로 정확히 한 번씩 있고 세로 넘침이 없어야 한다. 페이지 수와 페이지별 행 수는 환경에 따라 달라도 된다.

추가 보존 사례: `rowspan=0` 및 4행 병합, colspan 경계, 빈 TD, 중첩 표, footer 한 번, 원래 caption 첫 조각 유지, 분할 없는 작은 표에 라벨 없음, 재렌더 중복 없음, 다크/라이트, 코드·수식·링크·속성·명시적 강조 보존.

## 5. 원본 검증과 남은 검증

- 별표 수정: Node 테스트 25개와 WebDAV 빌드 통과. 실제 로컬 메인 보기와 PV의 별표 확인.
- 표 연결 수정: 인쇄/PDF·수식 회귀 Node 테스트 30개와 빌드 통과. 이 30개만으로 신규 표 연결 UI를 검증했다고 주장하지 않는다.
- 실제 Edge PV: 20열 표가 12열/9열 조각(키 열 반복)으로 분할되고 각각 5행, 후속 caption `표 연결 (2/2)`, 가로 넘침 없음 확인.
- 실제 Edge PV: 90행이 19/21/21/21/8행으로 나뉘고 후속 caption, 끝 문장, 모든 행 순서 유지, 5페이지 세로 넘침 0 확인. 원문에 `표 연결` 없음 확인.
- `tests/pvTablePagination.browser.cjs`의 caption·열 연결 기대값은 수정했지만 그 스크립트 자체는 이번 작업에서 실행하지 않았다. 실제 앱 UI로 위 별도 검증을 수행했다.
- 원본 코드 `node --check`, `git diff --check` 통과. 대상 MDproViewer 실행·테스트·Tauri 빌드·설치 앱·실제 인쇄·저장 PDF는 미검증이다.
- 원본 화면 증거: `C:\CusorApps\Webdav_md\statistical-stars-proof.png`, `C:\CusorApps\Webdav_md\pv-table-continuation-proof.png`. 두 번째 이미지는 실제 PV의 생성 DOM을 정적 사본으로 열어 촬영했다. 이미지 자체를 대상 앱 검증 증거로 사용하지 않는다.

원본 검사 명령(원본 저장소에서):

```powershell
node --check mdpro/js/math_render/math_render.js
node --check mdpro/js/Markdown_bold.js
node --check mdpro/js/UI_PV/editpv.js
node --test tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/docxMermaidExport.test.mjs
node --test tests/printPdfLayout.test.mjs tests/printMathFit.test.mjs tests/pdfMathPreservation.test.mjs tests/pdfMermaidExport.test.mjs tests/pdfImageResize.test.mjs tests/markdownMathPlaceholders.test.mjs
git diff --check
npm run build
```

원본 변경 파일: 위 JS 3개, `mdpro/index.html`, `mdpro/Apps/PWA/service-worker.js`, `tests/markdownMathPlaceholders.test.mjs`, `tests/pvTablePagination.browser.cjs`. 캐시는 통계 보호 `20261024-statistical-stars-1`, PV 추가 파라미터 `tableContinuation=20261024-1`, 최종 PWA `20261024-table-continuation-1`이다.

## 6. Tauri 영향

대상 웹 루트의 `js/math_render/math_render.js`, `js/Markdown_bold.js`, `js/UI_PV/editpv.js`, `index.html` 및 필요한 PWA 자산을 수정한 후 Tauri 프런트엔드를 다시 생성해야 한다. `Tauri/dist`를 직접 고치는 것으로 이식을 완료하지 않는다. 일반 JS 3개는 원본과 dist의 SHA256을 비교할 수 있다. `index.html`과 일부 자산은 빌드 스크립트가 CDN URL·캐시·서비스 워커 처리를 변환하므로 단순 파일 동일성 대신 변환된 링크와 기능 포함 여부를 검증한다.

설치 앱에서도 통계 별표, 넓은 표 연결, 긴 표 연결, 원본 보존을 확인한다. 웹 검증과 설치 앱 검증을 각각 기록한다.

## 7. MDproViewer에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘.
AGENTS.md와 Docs/mdpro-development/README.md,
Docs/mdpro-development/changes/2026-10-24-statistical-stars-and-pv-continuation.md를 읽고
WebDAV MDpro의 통계 유의성 별표 보존과 PV 표 연결 표시를 이식해줘.
대상의 코드 보호 순서가 다른 점과 넓은 표 열 분할 선행 기능이 없는 점을 먼저 해결해줘.
전체 파일을 덮어쓰지 말고 기존 기능과 변경사항을 보존해줘.
기술문서의 재현 자료로 실제 보기/PV를 검증하고 문서·목록·Tauri 대기 상태를 갱신해줘.
이번 명령은 웹 소스 이식까지이며, 네이티브 빌드는 별도 요청 전에는 실행하지 마.
미검증 항목은 구분해서 보고해줘.
```

빌드까지 요청할 때:

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 타우리앱으로 빌드해줘.
Docs/mdpro-development/TAURI_BUILD.md와 TAURI_BUILD_QUEUE.md를 읽고,
MDPRO-20261024-STATS-PV의 미이식 기능을 먼저 적용·검증한 뒤
프런트엔드와 네이티브 실행파일·NSIS 설치파일을 만들어줘.
포함 기능, 실행 명령, 자산 확인, 산출물 경로·시각·해시, 설치 앱 검증 여부를 기록해줘.
```

## 8. 원본의 실제 적용 코드 발췌

아래 코드는 작성 시점 원본에서 추출한 구현이다. 대상의 전체 파일 교체용이 아니며, 위 대상 구조 차이와 선행 이식 절차를 우선한다.

### 8.1 통계 보호 helper (MathRender 객체 내부)

```javascript
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
```

### 8.2 Smart Bold의 보호 순서 (원본 구현)

```javascript
    function preprocessInlineCodeAware(line) {
        const opaqueTokens = [];
        const protect = function (match) {
            const token = '\uE000MDPRO_OPAQUE_' + opaqueTokens.length + '\uE001';
            opaqueTokens.push(match);
            return token;
        };
        // MathRender의 수식 보호보다 이 전처리기가 먼저 실행된다. 수식 안의
        // **p 및 < 비교기호를 Markdown 강조/HTML로 오인하지 않도록 선보호한다.
        const mathRe = /\\{1,2}\([\s\S]*?\\{1,2}\)|\\{1,2}\[[\s\S]*?\\{1,2}\]|\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]+\$/g;
        let protectedLine = line.replace(mathRe, protect);
        const codeRe = /(`+)([\s\S]*?)\1/g;
        protectedLine = protectedLine.replace(codeRe, protect);
        // The main view runs Smart Bold before Markdown parsing. Protect report
        // stars here too, before *** | 1*** can become a bold/italic pair.
        if (typeof window !== 'undefined' && window.MathRender) {
            protectedLine = window.MathRender.protectStatisticalMarkers(protectedLine);
        }
        let output = preprocessBoldText(protectedLine);
        opaqueTokens.forEach(function (content, index) {
            output = output.split('\uE000MDPRO_OPAQUE_' + index + '\uE001').join(content);
        });
        return output;
    }
```

### 8.3 연결 caption과 열 분할 (대상에는 열 분할 선행 이식 필요)

```javascript
function previewPopupSetTableContinuation(table, label) {
    // A caption travels with its table through measurement, pagination and
    // printing, so the indicator cannot be orphaned at the end of a page.
    if (table.caption) table.caption.remove();
    const caption = table.createCaption();
    caption.setAttribute('data-pv-table-continuation', 'true');
    caption.textContent = label;
    caption.style.cssText = 'caption-side:top;text-align:right;font-size:0.85em;font-weight:600;line-height:1.4;padding:0 0 6px;color:inherit;';
}

function previewPopupFitTableWidth(source, content) {
    const table = source.cloneNode(true);
    const available = content.clientWidth;
    if (!available) return [table];
    const normalize = function (target) {
        target.removeAttribute('width');
        target.style.setProperty('width', '100%', 'important');
        target.style.setProperty('min-width', '0', 'important');
        target.style.setProperty('max-width', '100%', 'important');
        target.style.setProperty('table-layout', 'auto', 'important');
        target.style.setProperty('white-space', 'normal', 'important');
        Array.from(target.querySelectorAll('th,td')).forEach(function (cell) {
            cell.style.setProperty('min-width', '0', 'important');
            cell.style.setProperty('white-space', 'normal', 'important');
        });
    };
    normalize(table);
    content.appendChild(table);
    const win = table.ownerDocument.defaultView;
    const fontSize = parseFloat(win.getComputedStyle(table).fontSize) || 16;
    const width = Math.max(table.getBoundingClientRect().width, table.scrollWidth);
    if (width <= available + 1) { table.remove(); return [table]; }

    // Build logical columns, including cells occupied by a preceding rowspan.
    // Only cut at boundaries that no colspan crosses.
    const entries = [];
    let columns = 0;
    Array.from(table.children).filter(function (section) { return /^(THEAD|TBODY|TFOOT)$/.test(section.tagName); }).forEach(function (section) {
        const occupied = [];
        Array.from(section.rows).forEach(function (row, rowIndex) {
            let column = 0;
            Array.from(row.cells).forEach(function (cell) {
                while (occupied[column] > rowIndex) column += 1;
                const end = column + cell.colSpan;
                entries.push({ cell, start: column, end });
                const rowEnd = cell.rowSpan === 0 ? section.rows.length : rowIndex + cell.rowSpan;
                for (let c = column; c < end; c += 1) occupied[c] = rowEnd;
                column = end;
                columns = Math.max(columns, end);
            });
        });
    });
    const safe = function (boundary) { return !entries.some(function (entry) { return entry.start < boundary && entry.end > boundary; }); };
    const widths = Array(columns).fill(0);
    entries.forEach(function (entry) {
        const each = entry.cell.getBoundingClientRect().width / (entry.end - entry.start);
        for (let c = entry.start; c < entry.end; c += 1) widths[c] = Math.max(widths[c], each);
    });
    table.remove();
    const minimumScale = Math.max(0.8, 11 / fontSize);
    const bands = [];
    const repeatKey = columns > 2 && safe(1);
    let start = 0;
    if (available / width < minimumScale && columns > 1) {
        while (start < columns) {
            let best = start;
            let total = start > 0 && repeatKey ? widths[0] : 0;
            for (let end = start + 1; end <= columns; end += 1) {
                total += widths[end - 1];
                if (total * minimumScale <= available && safe(end)) best = end;
            }
            // A merged column group can be wider than the paper. Preserve it
            // intact and allow wrapping instead of cutting its cell contents.
            if (best === start) {
                best = start + 1;
                while (best < columns && !safe(best)) best += 1;
            }
            bands.push([start, best]);
            start = best;
        }
    }
    if (bands.length < 2) bands.splice(0, bands.length, [0, columns]);
    return bands.map(function (band, index) {
        const clone = table.cloneNode(true);
        const copied = Array.from(clone.rows).filter(function (row) { return row.closest('table') === clone; }).flatMap(function (row) { return Array.from(row.cells); });
        entries.forEach(function (entry, i) {
            if (!(entry.start >= band[0] && entry.end <= band[1]) && !(index > 0 && repeatKey && entry.end <= 1)) copied[i].remove();
        });
        Array.from(clone.children).filter(function (child) { return child.tagName === 'COLGROUP'; }).forEach(function (group) { group.remove(); });
        if (index > 0) previewPopupSetTableContinuation(clone, '표 연결 (' + (index + 1) + '/' + bands.length + ')');
        normalize(clone);
        content.appendChild(clone);
        const naturalWidth = Math.max(clone.getBoundingClientRect().width, clone.scrollWidth);
        const scale = Math.min(1, available / naturalWidth);
        clone.style.setProperty('font-size', Math.max(11, fontSize * scale) + 'px', 'important');
        Array.from(clone.querySelectorAll('th,td')).forEach(function (cell) {
            const style = win.getComputedStyle(cell);
            cell.style.setProperty('padding-left', Math.max(2, parseFloat(style.paddingLeft) * scale) + 'px', 'important');
            cell.style.setProperty('padding-right', Math.max(2, parseFloat(style.paddingRight) * scale) + 'px', 'important');
            cell.style.setProperty('overflow-wrap', 'anywhere', 'important');
        });
        if (clone.scrollWidth > available + 1) clone.style.setProperty('table-layout', 'fixed', 'important');
        clone.remove();
        return clone;
    });
}
```

### 8.4 행 분할과 자동 caption 보존

```javascript
function previewPopupSplitTableRows(table, content) {
    if (String(table.tagName || '').toLowerCase() !== 'table') return null;
    const rows = Array.from(table.querySelectorAll('tbody > tr')).filter(function (row) {
        return row.closest('table') === table;
    });
    if (rows.length < 2) return null;

    // Measure the complete table at the paper width, before removing rows.
    // Otherwise auto layout recalculates different column widths per page.
    const template = table.cloneNode(true);
    content.appendChild(template);
    try {
        const ownRows = Array.from(template.rows).filter(function (row) { return row.closest('table') === template; });
        const columnCount = Math.max(...ownRows.map(function (row) {
            return Array.from(row.cells).reduce(function (sum, cell) { return sum + cell.colSpan; }, 0);
        }));
        const fullRow = ownRows.find(function (row) {
            return row.cells.length === columnCount && Array.from(row.cells).every(function (cell) { return cell.colSpan === 1; });
        });
        const widths = fullRow && Array.from(fullRow.cells, function (cell) { return cell.getBoundingClientRect().width; });
        const total = widths && widths.reduce(function (sum, width) { return sum + width; }, 0);
        if (total > 0) {
            Array.from(template.children).filter(function (child) { return child.tagName === 'COLGROUP'; }).forEach(function (group) { group.remove(); });
            const group = table.ownerDocument.createElement('colgroup');
            widths.forEach(function (width) {
                const col = table.ownerDocument.createElement('col');
                col.style.width = (100 * width / total) + '%';
                group.appendChild(col);
            });
            template.insertBefore(group, template.querySelector('thead, tbody, tfoot, tr'));
            template.style.tableLayout = 'fixed';
        }
    } finally {
        template.remove();
    }
    const makeTable = function (start, end) {
        const clone = template.cloneNode(true);
        const copiedRows = Array.from(clone.querySelectorAll('tbody > tr')).filter(function (row) { return row.closest('table') === clone; });
        copiedRows.forEach(function (row, index) { if (index < start || index >= end) row.remove(); });
        Array.from(clone.children).forEach(function (child) {
            if (child.tagName === 'TBODY' && !child.children.length) child.remove();
            if (child.tagName === 'TFOOT' && end < rows.length) child.remove();
            if (child.tagName === 'CAPTION' && start > 0 && !child.hasAttribute('data-pv-table-continuation')) child.remove();
        });
        if (start > 0 && !clone.querySelector('caption[data-pv-table-continuation]')) {
            previewPopupSetTableContinuation(clone, '표 연결 (이전 페이지에서 계속)');
        }
        return clone;
    };

    // Only split off the rows that fit on the *current* page. The remainder is
    // deliberately kept as one table so place() can measure it again after it
    // advances to a fresh page. Building every fragment against `content` here
    // used the first page's remaining height for all subsequent pages, which
    // commonly turned a four-row table into four one-row tables.
    let splitIndex = 0;
    let spanEnd = 0;
    for (let index = 0; index < rows.length; index += 1) {
        const sectionEnd = rows.lastIndexOf(rows[index].parentElement.lastElementChild) + 1;
        Array.from(rows[index].cells).forEach(function (cell) {
            const end = cell.rowSpan === 0 ? sectionEnd : Math.min(sectionEnd, index + cell.rowSpan);
            spanEnd = Math.max(spanEnd, end);
        });
        const boundary = index + 1;
        // A continuation must never lose cells originating on the previous page.
        if (boundary < spanEnd || boundary === rows.length) continue;
        if (!previewPopupMeasureCandidate(content, makeTable(0, boundary))) break;
        splitIndex = boundary;
    }

    // No row fits in the remaining space: let place() move the intact table to
    // the next page before attempting a split there.
    if (splitIndex <= 0 || splitIndex >= rows.length) return null;

    return [makeTable(0, splitIndex), makeTable(splitIndex, rows.length)];
}
```

공통 보호 호출: `protectChunk()`의 반환문은 `return MathRender.protectStatisticalMarkers(out.join(''));`이다. 열 분할 호출은 원본 `previewPopupRenderPaginatedPages()`에서 최상위 표마다 `table.replaceWith(...previewPopupFitTableWidth(table, current.content))`로 연결된다. 대상 페이지 배치 알고리즘과 함께 적용한다.

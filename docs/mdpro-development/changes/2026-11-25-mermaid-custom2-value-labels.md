# 2026-11-25 커스텀 설명과 커스터마이즈 2 숫자 항목

- 변경 ID: `MDPRO-20261125-MERMAID-CUSTOM2`
- 작성·소스 확인: 2026-11-25, WebDAV 미커밋 구현.
- 원본: `C:/CusorApps/Webdav_md/webdav-md`. 상대: `C:/CusorApps/md-viewerVscode/md_viewer`.
- 문서 사본: 원본의 이 문서만 작성. 상대 소스는 읽기 비교, 미수정.
- 선행: [커스텀 생성 도구](2026-11-25-mermaid-custom-tool-builder.md), [다중 선택](2026-11-25-mermaid-custom-multiselect.md), `appearance-types.js`·`appearance-source.js`·기존 명시적 코드 적용/저장 경로.
- 상태: WebDAV 구현·실제 전체 앱 Chrome·SVG/PNG·웹 빌드 완료. Viewer 웹 이식/frontend/Tauri/native/설치/배포 없음.
- 증거: `tests/mermaidAppearanceCustom2.test.cjs`, `tests/mermaidAppearanceCustom2.browser.cjs`, `artifacts/mermaid-custom2-20261125/`.
- 작업 전 기존 Mermaid·도구 모음 소스와 문서·증거가 수정된 상태였다. 해당 기존 작업을 보존하고 아래 기능만 추가했다.

## 요청과 완료 기준

1. 커스텀 도구에 마우스를 올리면 해당 버튼/속성의 용도, 대상, 초기화/삭제 범위, 숫자 증감 방법을 설명한다.
2. 기존 SVG 개체 수정과 별개로 **커스터마이즈 2 · 숫자 항목 추가** 영역을 제공한다. 사용자가 제시한 XY 막대그래프에서 `bar [5000, 6200, 7800, 5500, 8900, 9200]`을 읽어 실제 막대 위에 숫자를 추가한다.
3. 원본 `bar`·`line` 데이터, 축/제목, 기존 개별 스타일/생성 도구, 선택 상태 저장을 보존한다. 미리보기 조절만으로 Markdown을 저장하지 않는다.
4. 추가한 숫자는 글자 크기·색·막대 끝 바깥/안쪽/가운데·간격·가로/세로 이동·천 단위 구분·소수 자릿수·접두/접미 문자로 조절한다. 전체 또는 일부 숫자, 복수 막대 계열, 가로 차트를 지원한다.

## 사용 순서

도표의 ✎ → `커스터마이즈 2 · 숫자 항목 추가`의 `도구 펼치기`를 열고 막대 계열과 숫자를 선택하고 `막대 위에 숫자 추가`를 누른다. 처음에는 모든 숫자가 선택된다. Ctrl/⌘·Shift 다중 선택으로 일부만 표시할 수 있다.

생성된 카드에서 모양을 바꾼 뒤 기존 `코드에 적용`을 누르고 문서의 기존 저장 기능을 사용한다. 숫자 자체를 바꾸려면 원본 Mermaid 데이터를 편집한다. 코드가 달라지면 기존 숫자 설정을 다른 막대에 강제로 붙이지 않고 다시 추가하도록 안내한다.

숫자 카드 삭제는 해당 묶음만 삭제한다. 기존 커스텀 영역의 `커스텀 전체 초기화`와 JSON은 기존 개체 수정/도구만 다룬다. 도표 공통 `초기화`는 custom과 custom2를 함께 제거한다. 문서에 저장된 설정을 없애려면 다시 코드에 적용한다.

## 구현 코드와 변경 이유

| 파일·함수 | 구현 |
| --- | --- |
| `mdpro/js/mermaid/appearance-custom.js` | `help`, `actionHelp`로 기존 선택·적용·초기화·JSON·생성 도구·속성·범위·증감·삭제에 native `title` 설명을 추가했다. 도구 카드는 이름/대상 개수/속성 용도를 함께 설명한다. `elements()`는 새 숫자 레이어를 제외해 기존 개체 인덱스와 signature를 보존한다. |
| 새 `mdpro/js/mermaid/appearance-custom2.js` · `parse()` | 기존 `baseSource()`로 관리 블록을 제외한 코드에서 XY 타입·가로 여부·bar 배열을 읽는다. YAML/주석/init은 제외한다. `line`도 plot 순번에는 포함해 **원본 bar 계열 순번과 실제 `.bar-plot-N`을 정확히 대응**한다. line 값과 축 눈금은 숫자 항목으로 가져오지 않는다. |
| 같은 파일 · `clean`, `format` | 설정은 `{version:1, sourceKey, items:[...]}`. ID·대상 인덱스·숫자·색상·문자 길이를 검사한다. 20개 묶음/총 500개 숫자, 계열당 최대 500개 값. 글자 4~120px, 간격 0~200, X/Y ±1000, 소수 -1(자동) 또는 0~6. 색은 null(자동) 또는 #RRGGBB만 허용한다. 접두/접미는 각각 24자까지 평문 처리한다. 임의 CSS/selector/스크립트는 받지 않는다. |
| 같은 파일 · `apply()` | 기존 레이어를 제거하고 sourceKey 일치 여부를 확인한다. 실제 SVG rect의 bbox와 `svg.getScreenCTM().inverse().multiply(bar.getScreenCTM())`로 위치를 루트 좌표에 매핑한다. `<g data-mdpro-value-labels>`에 `<text>`를 `textContent`로 추가한다. 실제 막대 수와 코드 값 개수가 다르면 오류 안내 후 잘못된 매핑을 생략한다. SVG viewBox는 기존 영역과 전체 새 글자 bbox의 합집합으로 확장한다. 반복 적용은 중복/누적 확장을 만들지 않는다. |
| 같은 파일 · `attach()` | 별도 fieldset·원본 숫자 목록·생성 버튼·이름·생성 카드·삭제를 제공한다. 새 입력/버튼에도 title 설명을 제공한다. 현재 스타일 패널의 기본 플로팅·커스텀 접기 동작을 유지하며, `appearance-panel.js`가 만드는 접기 summary에도 title을 추가했다. 자동 글자색은 실제 도표의 글자색을 따르며 수동 색을 다시 해제할 수 있다. 새 서버 호출/저장 루프/DB migration 없음. |
| `mdpro/js/mermaid/appearance-source.js` | `readAppearance()`·`serialize()`에 custom2 검증과 metadata 왕복을 추가한다. 기존 사용자 init/YAML/원문 보존과 명시 적용·이전 코드 inDB snapshot 경로를 그대로 사용한다. |
| `mdpro/js/mermaid/mermaid_render.js` | 공통 SVG polish에서 유형별 보정→화살촉/대비 보정→기존 custom→새 custom2 순으로 적용한다. 기존 change Promise 완료 후 새 UI를 갱신하고, 비지원 타입의 생성 버튼 disabled 상태도 복원한다. 공통 초기화에 custom2:null을 추가한다. |
| `mdpro/index.html`·`mdpro/Apps/PWA/service-worker.js` | custom2 helper를 기존 custom 다음에 로드한다. renderer/custom/source/helper의 버전은 `20261125-7`, PWA cache는 `20261125-mermaid-custom2-7`. 같은 작업 중 요청된 하단바 기본값 변경 query와 현재 panel의 20261125-8 query도 보존한다. |

설정 예:

```js
{
  version: 1, sourceKey: MermaidAppearanceCustom.sourceKey(code),
  items: [{ id: 'values-1', label: '월별 매출', series: 0,
    indices: [0, 1, 2, 3, 4, 5], fontSize: 16, color: null,
    position: 'outside', distance: 8, x: 0, y: 0,
    grouping: true, decimals: -1, prefix: '', suffix: '' }]
}
```

현재 지원은 XY **막대**의 값 표기다. line 값의 표기, 파이/다른 유형의 자동 수치 추출, 임의 새 도형 생성, 글자끼리 충돌을 자동 해결하는 기능은 포함하지 않는다. 긴 접두·접미와 큰 폰트는 사용자가 간격/위치/크기를 조절한다. 음수·0도 원래 값을 표시하며, 현재 Mermaid가 그린 막대의 위쪽/오른쪽 끝을 기준으로 배치한다. 원래 차트의 축/막대 기준점을 재해석해 수정하지 않는다.

## 상대 앱 대응표와 이식 순서

2026-11-25 상대 `js/mermaid/`의 실제 소스/파일 목록을 읽었다. Viewer에는 appearance-panel/source가 있지만 WebDAV의 custom/custom2 helper는 없다. source metadata 검증·타입별 helper도 동일하지 않다.

| WebDAV | Viewer 대상 | 차이·선행 작업 | 이번 상태 |
| --- | --- | --- | --- |
| `mdpro/js/mermaid/appearance-custom.js` | `js/mermaid/appearance-custom.js` 신규 후보 | 기존 커스텀 생성/다중 선택 선행 이식, sourceKey/baseSource 계약 필요. 이번 tooltip과 새 레이어 제외 조건을 함께 반영한다. | 대상 파일 없음·미이식 |
| `appearance-custom2.js` | `js/mermaid/appearance-custom2.js` 신규 후보 | 원본 source attribute·실제 SVG bar plot 클래스·공통 polish 시점을 먼저 대응한다. | 대상 파일 없음·미이식 |
| `appearance-source.js` | `js/mermaid/appearance-source.js` | 대상은 독립된 source 검증/직렬화 구조. 유형별 YAML 보존과 custom metadata부터 적응한다. source 전체를 복사하지 않는다. | 대응 읽기·미수정 |
| `mermaid_render.js` | `js/mermaid/mermaid_render.js` | 대상의 실제 렌더·테마·SVG 캐시·내보내기 큐에 custom→custom2 후처리를 연결한다. UI change 비동기 완료 시점을 보존한다. | 미수정 |
| index/PWA | 대상 `index.html` 및 캐시 자산 | 대상 로드 순서/자산 목록을 조사한 뒤 helper를 추가한다. WebDAV app/PWA 파일로 덮어쓰지 않는다. | 미수정 |

이식 순서: 기존 유형별/커스텀 생성/다중 선택 의존성 확인 → helper 선택 이식 → source read/serialize → 공통 SVG 후처리·UI → 캐시 → 아래 검증. 앱별 저장·브리지·스냅샷·빌드 절차를 보존한다.

## 회귀와 실제 검증

- 관련 자동 검사: Mermaid parser/검증/서식/source 왕복/기존 도구/인쇄·PDF·수식 계약 **37/37 통과**. 명령:

```text
node --test tests/mermaidAppearanceCustom2.test.cjs tests/mermaidAppearanceCustom.test.cjs tests/mermaidAppearanceSource.test.cjs tests/mermaidAppearanceTypes.test.cjs tests/pdfMermaidExport.test.mjs tests/printPdfLayout.test.mjs tests/printMathFit.test.mjs tests/pdfMathPreservation.test.mjs tests/pdfImageResize.test.mjs tests/mathRenderContract.test.mjs
```

- `node tests/mermaidAppearanceCustom2.browser.cjs`: Chrome headless 전체 앱에서 사용자 제공 Monthly Revenue 원문으로 실제 렌더. 접기 summary를 포함한 36개 커스텀 컨트롤의 title 확인 및 hover, 막대색 도구와 공존, 여섯 숫자/실제 막대 중심·위쪽 배치, 천 단위/색/크기/이동/접두·접미, SVG/PNG, 코드 적용→reload, 묶음 삭제/기존 custom 보존, 반복 적용 시 viewBox/개수 불변, stale source 차단, 음수/0, line이 먼저 나오는 복수 bar 계열, 일부 인덱스만 선택, 다크 자동 색, 모바일 390px, 비지원 flowchart 생성 차단을 확인했다. native tooltip의 OS 표시 픽셀은 별도로 캡처하지 않았으며 title/hover 동작을 검사했다.
- 최종 합동 Node 실행은 이 기능 37개와 하단 모드/A4 35개를 함께 실행해 **72/72 통과**했다.
- `node tests/mermaidAppearanceCustom.browser.cjs`: XY·한글 Sankey·flowchart의 기존 도구 생성/수치 변경/JSON/저장/reload/SVG·PNG 회귀 통과. 현재 기본 플로팅 및 커스텀 접기 소스에 맞춰 테스트의 열기 절차를 조정했다.
- `node tests/mermaidAppearanceMultiSelect.browser.cjs`: 기존 다중 선택·같은 종류·전체 막대·그룹 도구·다른 개체 보존·reload 통과.
- 증거: `monthly-default.png`(기본 수치 표시), `monthly-controls.png`, `monthly.svg`, `monthly.png`, `horizontal.png`, `mobile.png`, `result.json`.
- 최초 title 검사에서 JSON summary의 설명 누락을 발견해 보완했다. 복합 차트 추가 검사에서는 실제 Mermaid가 line도 plot 번호에 포함함을 확인해 단순 bar 순번 매핑을 수정했다. 이 문제를 감추거나 다른 계열의 숫자로 대체하지 않고 실제 SVG와 재검증했다. 추가 기존 브라우저 회귀는 현재 기본 플로팅 UI에서 예전의 wrapper 내부 플로팅 버튼을 기다리며 시간 초과했다. 런타임 동작을 되돌리지 않고 현재 팝오버/접기 사전 조건에 맞춰 검사 절차를 조정한 뒤 세 종류 모두 통과했다.
- `node --check` custom/custom2/source/renderer/AI Jena JS, `git diff --check`, `npm run build`: 통과. 기존 500kB chunk 안내는 남아 있다.
- 기존 하단바 기본값 요청은 [별도 변경 문서](2026-11-25-editor-shift-three-modes.md)에 갱신했다. 해당 모드/A4 검사는 별도 35개, 실제 footer 검사는 별도 18개이며 이 기능의 37개 검사와 구분한다.
- 로컬 임시 HTTP 서버로 실제 전체 페이지 제공. CDN marked/Mermaid를 로컬 저장 파일로 대체했다. 실제 NAS/사용자 문서 열기/실기기 터치/배포/PWA 업데이트/설치 앱은 미검증이다.

## 수식·출력 계약 영향

`MDPRO-MATH-RENDER-CONTRACT` M-01~M-13을 읽었다. 수식 전처리/MathJax/OMML은 변경하지 않으며 Mermaid 코드 안의 숫자만 읽는다. M-08 원문 보존·M-10 기존 큐·M-13 자산 갱신을 유지했다. 신규 SVG 레이어는 공통 렌더 결과와 SVG/PNG 사본에 포함된다.

`MDPRO-PRINT-PDF-CONTRACT`의 C-01(원문/데이터 보존), C-02(사본), C-03(기존 렌더 큐 후처리), C-05(선택/UI 제외), C-06(추가 글자 viewBox), C-07(자동 글자색), C-08(불일치 안내)를 관련 범위에서 유지한다. 실제 SVG/PNG를 생성·검토했다. PDF/Word/PV/miniPV/공유·종이 출력은 이번 실제 검증 범위에 포함하지 않으며, 기존 PDF의 미해결 계약을 포함한 전체 준수나 모든 출력 표면의 완료를 주장하지 않는다. 출력 준비·페이지 분할 자체는 수정하지 않았다.

## Tauri 계획

대기 ID: `MDPRO-20261125-MERMAID-CUSTOM2`. Viewer 웹 이식·웹 검증·frontend 준비·native 빌드·설치 앱 검증 모두 대기. 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따른다. 이식 후 helper·renderer·source·index/캐시가 `Tauri/dist`에 포함됐는지 확인하고 설치 앱에서 숫자 위치/테마/재열기/출력을 검증한다. 이번 요청에는 상대 앱 수정이나 Tauri 빌드가 없다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-25-mermaid-custom2-value-labels.md를 읽어줘.
기존 유형별 스타일·커스텀 생성·다중 선택 선행 기능을 확인하고, 파일 전체 덮어쓰기 없이
커스텀 도구 hover 설명과 커스터마이즈 2의 XY bar 원본 수치 추가를 대상 구조에 맞춰 구현해줘.
표시할 계열/인덱스 선택·글자 크기/색·위치/간격·천 단위/소수/접두/접미·삭제·명시 코드 저장을 지원해줘.
line을 포함한 실제 SVG plot 번호, 기존 개체 인덱스 보존, 재렌더 중복 방지와 source mismatch 차단을 지켜줘.
Monthly Revenue 여섯 값, line이 먼저 있는 복수 bar, 음수/0, 가로 그래프, SVG/PNG,
저장/reload·기존 커스텀·양 테마·390px를 검증하고 기술문서/목록/Tauri 대기를 갱신해줘.
이번에는 Tauri 빌드/설치/배포/커밋하지 말고 미검증 경로를 구분해서 보고해줘.
```

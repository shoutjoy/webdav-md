# 2026-11-26 R 코드의 달러 기호 수식 오인 방지

- 변경 ID: `MDPRO-20261126-R-MEMBER-MATH`
- 원본: `C:\CusorApps\Webdav_md\webdav-md`; 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인: 2026-11-26. 작성 시 미커밋이며 이번 수정 전용 커밋에 포함한다.
- 상태: WebDAV 구현·자동 검사·웹 빌드 완료. 실제 브라우저 결과는 아래 기록. Viewer 읽기 비교만 수행, 상대 코드 수정·Tauri frontend/native 빌드·설치 앱·배포 검증 미실행.

## 요청과 완료 기준

사용자가 제공한 대응분석 함수 표의 `fit$eig`, `fit$row$coord`, `fit$col$coord`는 백틱이 없어도 그대로 표시되어야 한다. 기존에는 첫 `$`와 같은 행 또는 다음 행의 `$`가 짝지어져 수식이 되었다. 표의 모든 행·설명, 명시적 수식, 굵게, 코드, 원문을 보존한다. UI·설정·저장 기본값 변경은 없다.

## 실제 구현

- `mdpro/js/math_render/math_render.js`의 `protectMathSegments()` / `protectChunk()`에서 R 식별자와 하나 이상의 `$멤버` 체인을 통째로 토큰화한다. 공백 없는 체인만 인식하며, 명시적 `$...$`, `$$...$$`, `\(...\)`, `\[...\]` 수식 내부는 기존 스캐너가 먼저 소비하므로 R 휴리스틱을 적용하지 않는다.
- HTML 속성과 `pre/code/script/style/textarea` 영역·주석을 먼저 통과시켜 속성에 span이 삽입되지 않도록 한다. 일반 HTML 표 셀의 텍스트는 검사한다.
- `literalSlots`에 해당 토큰 인덱스를 기록한다. `restoreHtml()`에서 HTML 이스케이프 후 `<span class="mathjax_ignore">fit$row$coord</span>`로 복원한다. 단순 `&#36;`는 DOM에서 `$`로 돌아오므로 MathJax 3의 제외 클래스가 필요하다. 실제 vendor MathJax 기본값은 `mathjax_ignore`이며, `tex2jax_ignore`만 사용한 초기 시도는 브라우저에서 실패하여 수정했다.
- 공통 파서를 사용하는 메인 보기/PV/miniPV/AI 미리보기에 적용한다. 인쇄·PDF는 기존 렌더 결과를 소비한다. 출력·페이지 분할·DOCX 변환 코드는 수정하지 않았다.
- 기본 script URL, `mdpro/index.html`, `mdpro/js/UI_PV/editpv.js`, `mdpro/js/math_render/latex_render.js`, `mdpro/js/math_render/math_render_template.html`, `mdpro/AI_App/aiChat/ai-chat-answer-view.html`의 공통 스크립트 URL을 `20261126-r-member-1`로 통일했다. PWA 캐시도 같은 버전으로 갱신했다. 신규 의존성 없음.
- 수식 계약 M-05에 bare R 멤버 보존 조건을 추가했다. 기존 M-01~M-13은 유지한다.

## 상대 앱 대응표와 이식 순서

| WebDAV | Viewer 실제 대응 | 차이·상태 |
| --- | --- | --- |
| `mdpro/js/math_render/math_render.js` / `protectMathSegments` | `js/math_render/math_render.js` / 같은 함수 | 읽기 확인 시 Viewer에도 R 체인·HTML 보호가 있음. Viewer는 `mapOutsideCode`, 별도 `literalMembers` 배열과 `@@RMEMBER_` 토큰을 사용하고, WebDAV는 기존 slots와 `literalSlots` 인덱스를 사용한다. 전체 파일 복사 금지. |
| `restoreHtml`의 `mathjax_ignore` | Viewer `restoreHtml`의 `tex2jax_ignore` | 실제 읽은 대상은 `tex2jax_ignore` 사용. 대상 MathJax 버전·설정과 실제 UI를 확인한 뒤 클래스 적응 필요. 이번 상대 코드 미수정. |
| `mdpro/index.html`, `mdpro/js/UI_PV/editpv.js` 및 독립 AI/LaTeX 로더 | `index.html`, `js/UI_PV/editpv.js` 등 | 대상 기본/PV 캐시는 `20261115-stat-italic-1`로 확인. 앱별 자산 URL 유지 필요. |

대상에 기존 구현이 있다는 사실만으로 웹 또는 설치 앱에서 검증되었다고 판정하지 않는다. 대상 문서 사본은 이번 요청 범위에서 작성하지 않았다.

## 회귀 예제와 검증

- `tests/markdownMathPlaceholders.test.mjs`: 사용자 표 10행, R 체인 5종, Smart Bold 전후, sync/async/AI 경로, 명시적 수식 우선, HTML 속성·코드 보존을 추가했다.
- `node --test tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/mathRenderContract.test.mjs tests/markdownEnterBreaks.test.mjs tests/docxMermaidExport.test.mjs`: 37개 통과.
- `node --check mdpro/js/math_render/math_render.js`, `node --check mdpro/js/UI_PV/editpv.js`, `node --check mdpro/js/math_render/latex_render.js`, `git diff --check`: 통과.
- `npm run build`: 통과. 기존 큰 chunk 경고 발생.
- 브라우저 회귀: `node tests/rMembersMath.browser.cjs`. 로컬 소스를 가상 HTTP origin으로 제공하며 CDN Marked/MathJax URL은 저장소 vendor 자산으로 연결한다. 실제 Chrome·실제 MathJax SVG를 사용한다. 사용자 NAS·공개 배포·CDN 가용성 검사는 아니다.
- 최종 브라우저 결과: Chrome 메인 보기·PV의 표 10행/20셀 원문 일치, 표 안 수식 0개, 계약 수식 각 8개, 오류/미복원 토큰 0개, 인라인 코드·굵게·편집 원문 보존 확인. 증거: `artifacts/r-members-20261126/results.json`, `main.png`, `pv.png`.
- PV 검사 한계: 이 격리 환경의 `openPreviewPopupWindow()` → about:blank `document.write` 및 `setContent` 초기화는 시간 초과했다. 최종 검사는 앱이 생성한 실제 `getPreviewPopupDocumentHtml()`을 fixture URL로 제공하고, 실제 `updatePreviewPopupContent()`와 대상 창 MathJax·페이지 분할을 실행했다. PV 렌더링은 확인했으나 기본 팝업 열기 동작의 성공 증거로 해석하지 않는다. 제품 팝업 초기화 코드는 수정하지 않았다.
- 격리 자산 제한으로 앱 시작 중 잡힌 초기화 오류 안내 토스트가 메인 스크린샷에 존재한다. 렌더링 함수·표·MathJax는 실제 실행됐으나 앱 전체 초기화/외부 서비스 연결 성공을 의미하지 않는다.
- DOCX 구현 변경 없음. 실제 Word·PDF·OS 인쇄·물리 모바일·설치 앱은 미검증이다.

## Tauri 반영 계획

대기 ID: `MDPRO-20261126-R-MEMBER-MATH`. Viewer 기존 구현의 제외 클래스·캐시를 선택 보완하고 대상 회귀를 먼저 실행한다. 필요 시 공통 math JS와 HTML/PV/AI/LaTeX 로더를 frontend 자산에 반영하고, 요청받은 경우에만 `Docs/mdpro-development/TAURI_BUILD.md`에 따라 `Tauri/dist`와 설치 앱에서 표·일반 수식을 확인한다. 이번 Tauri 빌드 요청 없음.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md, Docs/mdpro-development/README.md, 수식 렌더링 계약과 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-26-r-member-math.md를 읽어줘. 기존 protectMathSegments의 bare R 체인 보호와 MathJax 제외 클래스를 실제 엔진 설정과 비교해 필요한 차이만 반영해줘. 전체 파일을 덮어쓰지 말고 대상 mapOutsideCode와 별도 literalMembers 구조를 유지해줘. fit$eig / fit$row$coord / fit$col$coord 표 10행과 계약 수식 8개를 실제 메인 보기·PV에서 확인하고, 코드·HTML 속성·굵게·원문을 보존해줘. 모든 로더 캐시, 이식 문서·목록·Tauri 대기 상태를 갱신해줘. Tauri 빌드는 하지 말고 미검증 항목을 구분해줘.
```

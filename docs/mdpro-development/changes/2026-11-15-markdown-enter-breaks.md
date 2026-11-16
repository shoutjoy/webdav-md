# 2026-11-15 Markdown Enter 줄바꿈 보존

- 변경 ID: `MDPRO-20261115-ENTER-BREAKS`
- 원본: `C:\CusorApps\WebDav-MD\webdav-md`, 상대: `C:\CusorApps\MDPRO\MDproViewer`
- 날짜/상태: 2026-11-15 미커밋 구현. WebDAV 메인/PV 실제 검증 완료, Viewer 미이식·Tauri 미실행.
- 기존 EXAONE 및 이동 UI 작업은 보존한다. 원문·선택·저장·편집 입력 및 기존 컨트롤을 변경하지 않는다.

## 문제와 적용 범위

AI JENA 미리보기는 `marked.parse(...,{breaks:true})`를 사용하지만 문서 보기는 기본 softbreak 처리로 Enter를 공백처럼 표시했다. 따라서 세 줄로 작성된 집단 A/B/C와 굵은 단계 제목 뒤의 설명이 한 줄로 합쳐졌다.

공통 렌더러에 `breaks:true`를 요청별로 전달하여 일반 문장의 단일 Enter를 `<br>`로 표시한다. AI 문서와 수동 작성 문서에 공통 적용한다. 원문 끝에 공백 두 칸이나 HTML을 삽입하지 않으므로 기존 문서도 새로 렌더링하면 적용된다. 빈 줄의 문단 구분, 명시한 hardbreak, 코드·표·목록 구조는 Markdown 파서가 그대로 처리한다. 기존 긴 문장을 원문에서 여러 줄로 감싼 문서도 해당 줄 경계를 표시하는 의도된 동작 변경이다.

## 실제 코드와 처리 순서

| 파일·함수 | 변경 |
| --- | --- |
| `mdpro/js/math_render/math_render.js` getMarkdownParser | 객체형 `.parse(input,{breaks:true})` 및 함수형 parser의 두 번째 인자에 동일 옵션 전달. 전역 marked 기본값 변경 없음 |
| `mdpro/js/app.js` renderMarkdownSnapshotToHtml, 내부 렌더 fallback | MathRender 미준비 시에도 `marked.parse(...,{breaks:true})` 적용 |
| index, editpv.js, math_render.js DEFAULT_SCRIPT_URL, latex_render.js, ai-chat-answer-view.html | 공통 모듈 쿼리 `20261115-enter-breaks-1` 일치 |
| PWA service-worker.js | 캐시 버전 갱신 |

처리 순서는 기존 M-01~M-13을 유지한다: 코드/수식 보호 → Markdown 파서의 prose 줄바꿈 → HTML 내 수식 복원 → 해당 표면의 MathJax 실행. multiline TeX 본문을 정규식으로 잘라 `<br>`를 넣지 않는다. PV/miniPV는 `renderMarkdownSnapshotToHtml`의 공통 결과를 사용한다. 인쇄/PDF는 기존 렌더 DOM 사본을 사용하는 경로이므로 줄바꿈에 따른 높이 변화가 있을 수 있으나 페이지 나눔 알고리즘을 바꾸지 않는다. C/P/D 규칙 전체 준수나 실제 출력 검증 완료를 주장하지 않는다. DOCX 코드는 변경하지 않았다.

## 검증

- `tests/markdownEnterBreaks.test.mjs`는 앱 번들의 실제 marked를 사용하여 sync/async 경로의 A/B/C 2개 줄바꿈과 단계 제목 뒤 1개 줄바꿈을 확인한다. 기존 hardbreak 중복 없음·빈 줄 문단·코드·표·목록·aligned 수식 보존 및 전역 parser 기본값 불변 확인.
- `node --test tests/markdownEnterBreaks.test.mjs tests/markdownMathPlaceholders.test.mjs tests/markdownBold.test.mjs tests/mathRenderContract.test.mjs`: 20개 통과.
- 격리 Chrome 실제 `http://127.0.0.1:5221/mdpro/index.html`, `tests/markdownEnterBreaks.browser.js`: 메인과 실제 PV 각각 dataBreaks=2, stepBreaks=1, 수식8개, MathJax 오류0, `result$points`/일반 괄호 보존, editor 원문 동일 확인. 처음 검사의 strong 전용 selector는 실제 앱의 b 태그도 허용하도록 수정하여 재검증했다.
- 최종 확대 회귀: 위4개 파일 + `tests/docxMermaidExport.test.mjs tests/aiJenaUiContract.test.mjs` 총63개 통과. JS syntax 및 `git diff --check` 통과. `npm run build` 통과(기존 chunk 크기 경고).
- 실제 인쇄/PDF·Word·모바일·공유 페이지 전체 검증은 미실행. 별도 수식 문법 수정 및 UI 컨트롤 변경 없음.

재현:

```powershell
npm run dev -- --host 127.0.0.1 --port 5221
agent-browser --session enter-breaks open http://127.0.0.1:5221/mdpro/index.html
$fixtureEncoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path tests/markdownEnterBreaks.browser.js)))
agent-browser --session enter-breaks eval -b $fixtureEncoded
```

## 상대 앱 적응과 Tauri

Viewer의 `js/math_render/math_render.js` getMarkdownParser를 실제 읽기 비교했다. 해당 객체 parser도 `.parse(input)` 기본 호출이므로 같은 좁은 변경이 필요하다. Viewer는 루트 js/AI_App/index 경로이고 전처리 구현도 WebDAV와 다르므로 전체 파일 복사 금지. 대상의 모든 실제 로드 URL과 공통 렌더 연결을 다시 조사한다. 상대 원본은 수정하지 않았다.

Tauri 대기 ID `MDPRO-20261115-ENTER-BREAKS`: Viewer 웹 이식, frontend 자산 포함, native 빌드, 설치 앱 확인 모두 대기. 기존 공통 렌더 자산 변경이므로 이식 후 native에도 포함해야 한다. 이번 빌드 요청은 없으며 추후 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따른다.

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS와 MATH_RENDER_RULES/PRINT_PDF_RULES,
C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-15-markdown-enter-breaks.md를 읽어줘.
원본 Markdown을 바꾸지 않고 공통 Markdown parser에 breaks:true를 전달해 단일 Enter가 보기/PV에서 유지되게 해줘.
Viewer 고유 코드와 기존 컨트롤을 보존하고 함수 단위로 적응하며 전체 파일을 덮어쓰지 마.
코드·표·목록·multiline TeX·M-01~M-13 회귀를 유지하고 A/B/C 세 줄 및 굵은 단계 제목 뒤 개행을 실제 메인/PV에서 확인해줘.
모든 로드 URL/캐시와 개발목록/Tauri 대기 목록을 갱신하고 출력 미검증을 구분해줘.
별도 요청 전 Tauri 빌드·커밋·배포는 하지 마.
```

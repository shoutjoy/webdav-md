# Mermaid Ref 캡처 범위 내부 코드·대화 분할

- ID: MDPRO-20261113-ME-SCOPED-CHAT
- 날짜: 2026-11-13 / 원본 미커밋
- 원본: C:\CusorApps\WebDav-MD\webdav-md
- 대상: C:\CusorApps\MDPRO\MDproViewer (읽기 비교만, 미이식)
- 상태: WebDAV 구현·실제 Chrome 모의/FLM 검증·빌드 완료. Viewer frontend/native/설치 검증 미실행.

## 요청과 보존 범위

사용자가 철회한 전체 창 개편은 복구한 상태에서 시작했다. 이번에는 캡처된 상단 #image-to-mermaid 안의 #mermaid-code-revision만 좌우 분할한다. 아래 #main 코드편집기/미리보기와 상단 이미지·텍스트 입력, 공급자 선택, 접기, 저장·문서 삽입, 내보내기, 플로팅/테마/줌 동작은 유지한다. 모바일은 같은 패널 안에서 상하 배치한다. 기존 코드 수정 details의 기본 접힘도 유지한다.

## 구현

- js/mermaid/mermaid-editor/index.html: revision-workspace 안에 revision-code-pane(기존 현재 코드 가져오기·source)과 revision-chat-pane(대화·기존 prompt/run/stop/apply)를 배치. #mermaid-code-revision-result는 중복 readonly textarea 대신 role=log div로 전환. ID는 보존하고 모든 .value 호출을 새 대화 함수로 교체했다.
- app.js: addRevisionChatMessage/updateRevisionChat는 textContent로 요청/응답/오류를 표시한다. 스트리밍은 대화 안으로 받고 완료 후 MermaidAIQuality.repairSyntax + mermaid.parse 검사를 통과한 코드만 source 및 아래 editor에 반영한다. false 반환도 실패로 처리한다. 아래 editor가 대기 중 변경됐으면 자동 덮어쓰기하지 않고 기존 적용 버튼을 사용한다. undo 스택과 inDB 저장 경로는 재사용한다. 수동 source 편집/가져오기 때 이전 적용 후보는 폐기한다.
- 구문 오류·실행 오류·빈 응답·중지·시간초과는 대화 안에 표시하고 기존 코드를 보존한다. 정상이면 중복 결과 코드창 대신 적용 완료를 표시한다. 이 대화는 패널이 열린 현재 세션의 요청 기록이며 별도 영구 채팅 저장은 추가하지 않았다. 후속 요청은 현재 source와 새 지시를 사용한다.
- style.css: #mermaid-code-revision으로 한정한 grid/메시지 스타일. 760px 이하 단일 열. 새 숨김 규칙 없음.
- 캐시: iframe URL 및 내부 app/style에 revisionChat=20261113-1, PWA 20261113-me-revision-chat-1.
- 기존 선행 NPU 라우팅 수정 유지: FLM 호환 프로필은 bridge에서 ollama-npu로 전달된다. 다른 공급자로 자동 전환하지 않는다.

## 대상 대응표

| 원본 | Viewer 확인 | 적응 |
| --- | --- | --- |
| source/result/run/stop/apply | js/mermaid/mermaid-editor/index.html에 동일 textarea UI 존재 | 해당 details만 분할, result 태그 변경에 맞춰 모든 호출 갱신 |
| app.js revisionResult.value / revisionReadyCode | Viewer에도 별도 검토/수동 적용 흐름 존재 | 대상 undo·parse·저장·native 다운로드를 보존하며 선택 이식 |
| PWA/iframe 캐시 | 앱별 배포 구조 다름 | 원본 index/service-worker 전체 복사 금지 |

Viewer 런타임은 수정하지 않았다. 대상의 독립 공급자/네이티브 브리지를 WebDAV 전체 파일로 덮어쓰지 않는다.

## 검증 증거

- node --test tests/aiJenaUiContract.test.mjs tests/jenaSeriesRuntime.test.mjs tests/task-vision-provider.test.cjs tests/me-task-models.test.cjs: 62/62 통과.
- node --check mdpro/js/mermaid/mermaid-editor/app.js 및 mdpro/AI_App/aiChat/ai-chat.js: 통과.
- npm run build: 통과. 기존 500kB chunk 경고 남음.
- agent-browser / Chrome / http://127.0.0.1:5199/mdpro/index.html:
  - 모의 FLM 요청 provider=openai-compatible, profile=lemonade-flm, model=gemma4-it-e4b-FLM 전달 확인.
  - 정상 수정: source/editor 일치 및 #render svg 확인.
  - 잘못된 구문: source 보존, 대화 오류, 적용 비활성 확인.
  - 중지: 늦은 응답 무시·source 보존·재실행 버튼 활성 확인.
  - 좁은 iframe 758px에서 단일 열, 가로 넘침 없음·기존 4개 버튼 너비 확인. 390px 실제 iframe 검증은 미실행(기존 모달 최소폭으로 iframe이 758px).
  - 모의 bridge를 제거한 새 로드에서 실제 FLM 모델로 flowchart TD / A[Start] --> B[End]를 LR로 수정 요청. flowchart LR 반환, source/editor 자동 적용 및 SVG 렌더링 성공.
- 화면/요청 증거: artifacts/mermaid-scoped-live.png, mermaid-scoped-desktop.png 및 mermaid-scoped-{setup,check,errors,live}.js (로컬 검증 산출물, Git 제외).
- 기존 컨트롤 ID 보존 및 diff 검토: 아래 #main 이동 없음, 새 display:none/visibility/opacity/clipping 규칙 없음.
- git diff --check: 최종 확인.

## Tauri

대기 ID MDPRO-20261113-ME-SCOPED-CHAT. Viewer 웹 이식·frontend 준비·native 빌드·설치 검증은 모두 대기. 이식 시 대상 Mermaid HTML/JS/CSS 및 자체 캐시를 포함한다. 빌드 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 먼저 따른다. 이번 자동 빌드·배포·커밋 없음.

## 다른 앱에서 실행할 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 WebDAV docs/mdpro-development/changes/2026-11-13-me-scoped-chat.md를 읽고 Mermaid Ref 상단의 기존 코드 수정 details 안에만 왼쪽 코드·오른쪽 프롬프트/대화를 구현해줘. 아래 코드편집기/미리보기와 다른 도구는 이동하지 마. 결과 textarea를 log로 바꾸면서 호출을 함께 갱신하고 구문 검증 성공 시 source/editor에 반영하되 대기 중 편집은 보존해줘. 대상의 공급자/undo/저장/native 브리지는 유지하고 파일 전체 복사 없이 이식해줘. 실제 모델 수정·구문 오류·취소·좁은 화면을 검증하고 문서/목록/Tauri 대기를 갱신해줘. 빌드·설치·배포는 실행하지 마.
```


## 2026-11-13 추가: 코드 / 미리보기 탭과 실행 이름

- 사용자 요청: 같은 상단 왼쪽 코드창에 탭으로 렌더링 보기, 코드 수정 실행을 `JENA ME 실행`으로 변경. 아래 편집기·미리보기는 그대로 유지.
- index.html: 기존 source를 mermaid-revision-code-panel로 감싸고 code/preview role=tab, tablist, tabpanel 및 aria-controls/selected 추가. source ID와 기존 실행 버튼 ID 보존. 결과 미리보기만 탭 전환 시 숨김 처리하며 기존 컨트롤을 영구 숨기지 않는다.
- app.js: selectRevisionView/renderRevisionPreview가 현재 revisionSource를 기존 preprocessMermaidSourceForRender→mermaid.parse→mermaid.render 경로로 렌더링한다. 아래 editor를 수정하지 않는다. 기존 theme 설정 및 Sankey 별칭/스타일 보정을 재사용하며 restoreSankeyAliasLabels와 polishRenderedMermaidSvg는 선택 container 인자를 추가해 기존 기본 호출을 보존했다. 빈 코드·구문 오류는 탭 안에 표시하고 이전 SVG를 비운다. 비동기 version/snapshot 검사로 늦은 결과를 무시한다. 코드 입력은 200ms debounce, 가져오기·AI 적용·수동 적용은 선택된 미리보기를 갱신한다. 화살표/Home/End 키와 roving tabIndex 지원. source/preview 전환은 코드 자체를 변경하지 않는다.
- 캐시: revisionChat=20261113-2, PWA 20261113-me-revision-tabs-1.
- 검증: 기존 62검사·두 JS syntax check·웹 빌드 통과(기존 chunk 경고). 실제 Chrome에서 사용자 예시 graph TD의 노드/연결 형식으로 SVG 생성, 잘못된 구문 시 오류 표시/SVG 제거, 코드 탭 복귀 시 원문 보존, ArrowLeft 전환, 아래 editor 불변, JENA ME 실행 문구 확인. 390px에서 가로 넘침 없음·SVG 및 탭 확인. artifacts/mermaid-scoped-tabs.js, mermaid-scoped-tabs.png, mermaid-scoped-tabs-mobile.png에 로컬 증거 보관(Git 제외).
- Viewer 기존 source/result 코드 비교 상태에서 탭 추가는 미이식·대상 실제 렌더링 미검증. Tauri 준비/native/설치 모두 대기. 상대 소스 자동 수정/빌드 없음.

추가 이식 명령:
```text
C:\CusorApps\MDPRO\MDproViewer에서 이 문서의 상단 코드·대화 분할을 선행 확인하고 그 왼쪽 source 영역 안에 코드/미리보기 탭을 추가해줘. 대상의 공통 Mermaid 전처리/테마/Sankey 보정을 재사용하고 독립 미리보기 때문에 아래 editor를 변경하지 마. 버튼 ID를 유지하며 코드 수정 실행 문구를 JENA ME 실행으로 바꿔줘. 비동기 응답·오류·코드 보존·키보드·390px 화면을 실제 검증하고 Tauri 대기 상태를 갱신해줘. 빌드·설치·배포는 하지 마.
```


## 2026-11-13 추가: 상단 미리보기 도구

- index.html의 상단 미리보기 탭에 Dark/Light, −/+, 100% 표시, Reset, DN 버튼 추가. 기존 탭/아래 편집기 컨트롤 보존.
- app.js: revisionPreviewDark/Zoom은 아래 미리보기와 독립. 테마는 applyMermaidPreviewTheme(dark)와 PNG export의 선택 dark 인자를 사용하며 기존 호출 기본값 previewDarkMode를 보존한다. 다크 배경 #0b1220, 라이트 #fff를 렌더링/PNG에 일치시켰다. 배율 25~400%, Reset 100%, 재렌더링 후 배율 유지. DN은 현재 상단 SVG를 기존 createRenderedPngBlob→triggerDownload로 mermaid-preview.png 다운로드. 렌더링 실패/대기에는 DN 비활성, 다운로드 오류는 같은 패널에 표시한다. DOM 확대는 화면 표시용이고 PNG는 원본 SVG viewBox 기반 해상도를 유지한다.
- style.css: 같은 미리보기 안의 줄바꿈 가능한 sticky 도구줄 및 독립 다크 배경만 추가.
- 캐시 revisionChat=20261113-3 / PWA 20261113-me-preview-tools-1.
- 검증: 실제 Chrome에서 확대 125%, Reset 100%, 다크 rgb(11,18,32), 라이트 rgb(255,255,255) 확인. PNG Blob image/png 42,891bytes, 2056×552, 모서리 RGBA [11,18,32,255]로 다크 배경 확인. 실제 DN 버튼 클릭으로 mermaid-preview.png 다운로드 핸들러 호출 및 버튼 복구 확인. 로컬 증거 artifacts/mermaid-scoped-tools.js / .png (Git 제외). 자동 검사 48개·JS 문법·웹 빌드 통과, 기존 chunk 경고 유지. PDF/인쇄/수식 파이프라인은 변경하지 않았다.
- 대상 Viewer: 이전 코드 비교 기준으로 독립 preview 도구 추가는 미이식, 웹/네이티브/설치 검증 대기. 추가 이식 시 대상 export/native 다운로드는 유지하고 선택 테마 인자만 적응한다. 전체 파일 복사·대상 자동 빌드 없음.

추가 이식 명령:
```text
C:\CusorApps\MDPRO\MDproViewer에서 이 문서의 상단 미리보기 탭에 독립 Dark/Light, 25~400% 확대축소, Reset, DN PNG 다운로드를 추가해줘. 기존 아래 미리보기 상태와 대상 native 다운로드 경로는 보존해줘. SVG viewBox 해상도와 선택한 테마의 배경/글자가 PNG에 유지되는지 실제 확인하고 웹/빌드 대기 문서를 갱신해줘. 빌드·배포는 하지 마.
```

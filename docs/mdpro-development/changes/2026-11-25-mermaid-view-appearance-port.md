# 2026-11-25 Mermaid 보기 모드 스타일 수정 이식

- 변경 ID: `MDPRO-20261125-MERMAID-VIEW-APPEARANCE`
- 원본: `C:/CusorApps/md-viewerVscode/md_viewer`; 대상: `C:/CusorApps/Webdav_md/webdav-md`
- 확인일: 2026-11-25. 현재 디스크 소스 기준, 이번 변경 미커밋. 원본 런타임/문서 미수정.
- 상태: WebDAV 구현·Chrome 검증·웹 빌드 완료. Viewer Tauri/frontend/native/설치·배포 미실행.

## 근거와 요청 범위

원본 `Docs/porting/MERMAID_VIEW_UI_PORTING.md`, `Docs/MERMAID_VIEW_APPEARANCE.md`, `Docs/mdpro-development/changes/2026-11-14-mermaid-appearance-source.md`, `2026-11-14-mermaid-appearance-panel.md`와 현재 실제 소스를 비교했다. 완전한 소스 저장소 작업이므로 reverse-engineer-anything 지침에 따라 REA 바이너리 분석/설정 변경은 필요하지 않았다. 첨부 화면의 글자·연결선·도형·배치·적용/기록 패널이 대상이다. 화면의 오류 문구는 원본 도표 식별을 거부한 관찰이며, 사용자 문서가 없으므로 그 문서의 정확한 실패 원인을 재현했다고 주장하지 않는다.

이전 WebDAV는 고정형 줌/맞춤/SVG/PNG/DN/테마만 있었다. 이제 ✎(도표 스타일 조절)를 누르면 기본 접힌 패널을 열어 글자 크기·볼드·폰트·색, 연결선 두께·색·화살촉 배율, 도형 테두리·배경·알파, 박스 너비·TD/LR/원본 방향을 조절한다. 플로팅·Dock·도표에 붙이기·닫기가 같은 DOM/입력을 보존한다. 기본 모드/테마, 기존 인터랙티브 테마 버튼·이동·복사·리사이즈와 출력 버튼은 유지했다.

조절은 임시 표시만 바꾸며, **코드에 적용**에서만 원문을 변경한다. 일반 파일 저장은 기존 저장 기능이다. 원본 적용은 flowchart/graph 전용이며 inDB를 켜고 준비해야 한다. 실패·원문 경합·읽기 전용에서는 원문을 교체하지 않는다.

## 구현과 이유

| 원본 함수/파일 | WebDAV 구현 | 적응·차이 |
| --- | --- | --- |
| `js/mermaid/mermaid_render.js`: configureMermaid, setWrapperMermaidTheme, addFixedMermaidControls | `mdpro/js/mermaid/mermaid_render.js` 대응 함수에 선택 병합 | 기존 직렬 큐·전처리·캐시·interactive 컨트롤·출력 경로 보존. 조절 SVG는 일반 원문 캐시에 쓰지 않음. 실패하면 이전 SVG/appearance/theme 복구 |
| buildMermaidNodeFromCode / restoreMermaidCodeBlocks | 저장 metadata 복원·presentation 인계 | 재렌더·테마 전환에서 조절값 유지 |
| `appearance-panel.js` | 동일 이름의 독립 보조 모듈 추가 | 현재 원본은 과거 명세보다 발전해 실제 workspace Dock·splitter가 존재. `#main-workspace`에 연결, 390px에서는 하단 Dock. 플로팅은 manual Popover, 배경 문서 사용 가능 |
| `appearance-source.js` | 동일 이름의 독립 보조 모듈 추가 | fence 위치/중복 도표 순서 검증 → 표준 코드 생성 → 같은 큐 parse → 기존 mermaid_refs 저장 transaction 완료 → editor replace. 새 DB/버전/migration 없음 |
| app.js MermaidAppearanceEditor | `mdpro/js/app.js`에 대상 전용 read/replace | Viewer의 begin/commitEditorHistoryTransaction은 WebDAV에 없음. 기존 pushReplaceUndoSnapshot + replaceEditorSelectionText를 사용해 textarea/CM6 분기 재사용. renderMarkdown/TOC/performAutoSave 연결 |
| 문서 키 | 호스트 WebDAV path 우선, 그 외 getPdfExportDocumentKey | 다른 저장소는 storageMode/id, 로컬은 경로 사용. document session/content/readOnly를 비동기 백업 후 재검증 |
| repairMermaidArrowheads | 선택 병합 + 대상 bounds 보완 | 기존 point marker만 확대·색 보정. 무방향선은 유지. 굵은 선의 edgeLabel 이동 후 getBBox와 기존 viewBox 합집합+여백으로 잘림 방지. foreignObject 치수를 변경하지 않음 |

WebDAV는 기본 조절값이 없는 경우 기존 dark/default 테마와 기본 flowchart 배치를 유지한다. 명시 조절 시 base/themeCSS를 사용하며 너비를 고른 경우에만 padding/wrappingWidth를 추가한다. 원본의 전체 renderer/app.js는 덮어쓰지 않았다. 원본의 숨은 측정 스테이지·오류 UI·이미지 변환기 전체 개선은 이번 이식에 포함하지 않았다. 기존 WebDAV SVG foreignObject/PNG 변환 경로를 유지했다. 따라서 Viewer의 native SVG text/배경 변환 전체 동등성을 주장하지 않는다.

index는 renderer 다음 panel/source를 defer 로드하며 각 자산과 app URL에 `appearance=20261125-1`을 반영했다. PWA cache는 `20261125-mermaid-appearance-1`이며 새 helper를 core asset에 추가했다. 새 npm 의존성·서버 API·AI 호출·인증 변경은 없다.

### 원문·기록 보호

`MermaidAppearanceSource.target`은 현재 `#viewer` 안의 wrapper만 허용한다. LF/CRLF 및 백틱/틸드 fence를 분석하며 긴 다른 fence 안의 예제는 제외한다. 같은 코드가 두 번 있으면 wrapper 수와 실제 후보 수를 대조해 해당 순번만 교체한다. 안전한 매핑이 없으면 첨부 화면처럼 오류를 내고 덮어쓰지 않는다. 첫 문자열 일치로 강제 교체하는 우회는 추가하지 않았다.

관리 주석은 알려진 숫자 범위/6자리 hex/폰트 목록/400·700/TD·LR만 읽는다. 표준 style/linkStyle/init와 `%% MDPRO appearance` 주석을 생성하며 기존 수기 스타일을 보존한다. `mermaid_style_snapshot` 기록은 변경 전 code/afterCode/documentKey/blockIndex/reason을 기존 mermaid_refs에 저장한다. 복원도 현재 코드를 먼저 백업하고, 삭제는 해당 ID만 삭제한다. 저장 중 충돌이 나면 적용되지 않은 시도의 백업이 남을 수 있다.

## 검증과 증거

- `node --test tests/mermaid*.test.mjs tests/mermaidAppearanceSource.test.cjs`: **27/27 통과**.
- `node --check` app.js/renderer/panel/source 및 `git diff --check`: 통과.
- `npm run build`: 통과. 기존 대형 청크 경고 있음.
- `node tests/mermaidAppearanceSource.browser.cjs`: 실제 Chrome 전체 앱에서 동일 도표 중 둘째만 적용, 외부 문장 보존, undo/redo, 표준 Mermaid 단독 렌더, 새로고침 뒤 IDB 기록/스타일 복구, 복원 전 백업, 선택 삭제/삭제 실패 보존, 저장 실패·비동기 수동 편집 보호 통과.
- `node tests/mermaidAppearancePanel.browser.cjs`: 실제 Chrome 보조 fixture에서 5개 카테고리·Consolas/볼드·색/알파0·0.4·TD/LR·굵은 화살촉/크기·무방향선·플로팅/배경 입력·드래그/8resize·Dock 복귀/너비 키보드·390px/Esc·다크·wrapper 제거 정리·PNG 통과. 실제 앱의 전체 다중 Dock 조합/물리 터치는 별도 미검증.
- 증거: `artifacts/mermaid-source-20261125/{result.json,history.png,applied.mmd}`, `artifacts/mermaid-panel-20261125/{result.json,dock.png,floating.png,mobile.png,mobile-dark.png,thick-arrows.png}`. 로컬 artifacts는 Git ignore 정책에 따라 저장된다.

첫 브라우저 시도는 외부 marked/Mermaid CDN을 로드하지 못해 실패했다. 검증에서는 앱의 vendor/marked와 기존 `C:/CusorApps/Webdav_md/check/pv-mermaid-proof/mermaid.min.js`를 해당 요청에 제공했다(모의 Mermaid 구현 아님). Mermaid SHA256: `217b66ef4279c33c141b4afe22effad10a91c02558dc70917be2c0981e78ed87`. `PLAYWRIGHT_MODULE`과 `MERMAID_TEST_SCRIPT`로 환경 경로를 바꿀 수 있다. CDN 현재 버전/실네트워크 로딩 성공은 미검증이다.

중간 정적 회귀 2건도 해결했다. 배치 계약 테스트는 이번 명시 너비 조절의 조건부 확장을 반영했고, 기존 iframe URL 검사는 현재 HEAD에도 이미 있던 mobileCompact/revisionChat 앞쪽 query를 허용하도록 수정했다. 마지막 27검사는 모두 통과했다.

미지원/미검증: 복잡한 인용·목록 중첩 fence, YAML/비JSON init 원본 적용, 모든 Mermaid 유형, 실제 사용자 첨부 문서 재현, 모든 설치 폰트, 실제 CM6 상호작용, NAS 저장 왕복, PV/miniPV/Word/PDF/인쇄 전체 결과. math/출력 엔진은 수정하지 않았고 기존 M-01~13/C/P/D 계약을 유지한다. preview 분리·원문 보존·기존 편집/undo·비모달 상태 보존을 적용했으나 전체 출력 계약 준수 선언은 아니다.

## Tauri 상태

WebDAV 웹 빌드만 실행했다. Viewer는 이미 기반 기능이 존재하고 이번 WebDAV 적응 코드를 자동 역이식할 필요가 없다. Viewer runtime/frontend/native/설치 자산 미수정이며 Tauri 빌드 요청 없음. `TAURI_BUILD_QUEUE.md`의 같은 ID에 상태를 기록한다. 추후 역이식 시에는 renderer의 조건부 설정·edgeLabel bounds 보완을 비교하고 Viewer 고유 renderMeasured/native SVG export/history transaction을 보존해야 한다.

## 재명령용 프롬프트

```text
C:/CusorApps/Webdav_md/webdav-md에서 AGENTS.md, docs/mdpro-development/README.md와
docs/mdpro-development/changes/2026-11-25-mermaid-view-appearance-port.md를 읽어줘.
보기 고정형 Mermaid의 ✎ 스타일 조절/플로팅/Dock/원본 적용/변경 기록을 유지하며
현재 사용자 문서에서 문제가 있으면 실제 fence와 viewer wrapper 대응을 조사해줘.
안전한 원문 매핑이 없을 때 첫 문자열 일치로 강제 교체하지 말고,
기존 editor/CM6/undo/자동저장과 inDB transaction 완료·문서 세션 경합 검사를 보존해줘.
상대 Viewer의 Docs/porting/MERMAID_VIEW_UI_PORTING.md와 현재 소스를 비교하되
전체 파일을 덮어쓰지 마. 두 Chrome 검사·27 관련 검사·웹 빌드를 실행하고
실제 사용자 문서/CM6/NAS/PV 검증 여부를 구분해 문서와 목록에 기록해줘.
별도 요청 없이 Viewer 수정·Tauri 빌드·설치·커밋·배포는 하지 마.
```

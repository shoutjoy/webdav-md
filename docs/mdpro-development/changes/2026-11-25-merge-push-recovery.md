# 2026-11-25 오늘 작업 보존 및 Git 병합·푸시 복구

- 변경 ID: `MDPRO-20261125-MERGE-PUSH-RECOVERY`
- 원본: `C:\CusorApps\Webdav_md\webdav-md`
- 비교 대상: `C:\CusorApps\md-viewerVscode\md_viewer` (읽기 확인만 수행)
- 작성·최종 확인: 2026-11-25
- 병합 부모: 오늘 로컬 `558e73c` / `467d7ab`, 원격 `6d86c8e`까지 8개 커밋.
- 상태: WebDAV 충돌 해결·웹 검증 완료, 커밋·푸시는 이 문서를 포함하여 실행. Viewer 웹 이식/frontend/Tauri/설치 앱 검증 미실행.

## 요청과 원인

오늘 수정한 내용을 보존하면서 오류를 해결하고 커밋·푸시한다. 시작 시 main은 원격과 2/8개 커밋이 갈라졌고, 이미 시작된 병합의 5개 파일에 충돌 표시와 unmerged index가 남아 있었다. 따라서 단순 재푸시는 non-fast-forward로 거절된다. 강제 푸시나 이력 삭제 없이 진행 중인 병합을 완성한다.

## 구현과 보존

| 파일·함수 | 해결 내용·이유 |
| --- | --- |
| `docs/mdpro-development/README.md`, `TAURI_BUILD_QUEUE.md` | 양쪽 개발 기록을 합쳐 오늘 Mermaid/도구 모음 및 원격 AI/저장 기록을 모두 보존. |
| `mdpro/js/app.js` · `initEditorShiftFloat` | 오늘의 `mode` 기반 footer 기본값과 가로 → 세로 → 하단바 순환을 유지. 원격의 이전 `layout: 'footer'` 저장값도 복원하도록 호환 처리. 명시적인 새 mode가 구형 layout보다 우선하며 좌표는 유지. |
| 같은 파일 · `syncEditorShiftFloatPosition`, pointerdown | 병합에서 섞인 `footer`/`docked` 변수 중 mode 기반 `docked`로 통일. 정의되지 않은 footer 참조를 제거하고 하단바 손잡이 분리 드래그를 막던 구형 조건을 제거. 기존 9개 버튼·접근성 문구·모바일 경계·저장 복원 유지. |
| `mdpro/index.html` | 자동 병합으로 중복된 빈 `editor-shift-footer-slot` 제거. 도구가 실제로 들어 있는 기존 확대/축소 행 내부 슬롯 하나만 유지. app.js URL은 오늘 appearance/3모드와 원격 EXAONE/model-load 쿼리를 함께 유지하고 `mergeRecovery=20261125-1` 추가. |
| `mdpro/css/style.css` | 원격의 오래된 footer override 7줄을 제외. 상태줄 줄바꿈·중첩 스크롤·손잡이 제한 대신 오늘의 기존 한 행/높이 보존 규칙 유지. 다른 컨트롤 숨김 규칙을 추가하지 않음. |
| `mdpro/Apps/PWA/service-worker.js` | 오늘 Mermaid helper 6개와 원격 reasoning-settings 자산을 모두 보존. 캐시를 `20261125-merge-recovery-10`으로 갱신. |
| `tests/editorShiftOrientation.test.mjs` | 자동 병합으로 뒤섞인 구형 테스트 기대값을 오늘의 3모드 계약으로 복구. 구형 layout 복원·새 mode 우선순위·전환 후 재복원·좌표 보존 사례 추가. |

```js
const mode = ['horizontal', 'vertical', 'footer'].includes(editorShiftFloatPreferences.mode)
    ? editorShiftFloatPreferences.mode
    : (editorShiftFloatPreferences.layout === 'footer' ? 'footer'
        : editorShiftFloatPreferences.vertical === false ? 'horizontal'
        : editorShiftFloatPreferences.vertical === true ? 'vertical' : 'footer');
```

원격의 EXAONE·NPU 스트리밍·문서 원문 복원·새 WebDAV 저장·줄바꿈/수식 수정은 유지했다. 수식 처리·인쇄/PDF 알고리즘은 이번 충돌 해결에서 새로 변경하지 않았다. 새 의존성 없음. 시작 상태는 무시된 `.tmp/merge-recovery-20261125/`에 복사 보존했다.

## 검증과 제한

- JS 문법: `node --check mdpro/js/app.js`, `mdpro/AI_App/aiChat/ai-chat.js`, `mdpro/Apps/PWA/service-worker.js` 통과.
- 관련 회귀 170개 통과: AI Jena UI, 도구 모음/A4, Mermaid appearance helper 전체, 원격 AI/EXAONE/WebDAV 저장, Markdown/수식/DOCX/인쇄/PDF 관련 검사. 결과 `.tmp/verification/targeted-tests.tap`.
- `npm run build` 통과. 기존 500kB chunk 경고만 남음.
- `node tests/editorShiftModes.browser.cjs`: Chrome 실제 전체 페이지 18개 검사 통과. 9개 버튼, 가로/세로/하단바, 1400/390/320px, 높이 보존, 스크롤 접근성, 편집/보기·테마, 재복원 및 하단 분리 드래그 확인. 증거 `artifacts/editor-shift-inline-footer-20261125/`.
- `node tests/mermaidAppearanceContent.browser.cjs`: flowchart/mindmap/sequence/quadrant 내용 추가, SVG/PNG, 코드 저장/새로고침, ME 준비 및 명시 교체/undo 통과. 로컬 Mermaid/marked 대체 사용. 실제 AI 공급자 생성·NAS·휴대전화·PWA 실기기 업그레이드는 미검증.
- 추가 실제 수식 검사: 로컬 MathJax SVG/marked로 `tests/markdownEnterBreaks.browser.js`를 실행. 메인 수식 8개·줄바꿈·코드/일반 괄호 보존 검사를 통과했으나 PV 창은 문서 초기화가 끝나지 않아 시간 초과. 테스트 서버/초기 로드 대기를 보완한 재시도 및 **병합 전 원격 `6d86c8e`에서도 동일 실패를 재현**했다. 메인 검증을 PV 통과로 간주하지 않으며 PV는 기존 미해결/미검증으로 기록한다. 실행 래퍼 `.tmp/verification/math-main-pv.cjs`.
- 전체 검사: **829개 중 792 통과, 36 실패, 1 skip**. 병합 전 두 부모를 별도 detached worktree로 실행해 비교: 로컬 793개 중 29 실패, 원격 807개 중 37 실패. 현재 실패 36개는 모두 부모 중 한쪽에서도 실패하며 **병합으로 새로 추가된 실패는 없음**. 전체 통과로 보고하지 않는다. `.tmp/verification/{merged,head,remote}-tests.tap`, `baseline-comparison.json`에 증거 기록.
- 기존 실패는 context helper 추출, VM localStorage/DOM fixture, 오래된 문자열·캐시 계약, 공급자 목록 차이 등에 걸쳐 있으며 이번 Git 복구 범위에서 관련 없는 런타임을 일괄 수정하지 않았다. 실제 공급자/AI 품질 정상까지 입증한 결과가 아니다.
- `git diff --check` 및 충돌 표시 재검색 수행. 최종 병합 index 및 원격 동기화는 커밋·푸시 후 확인한다.

## 상대 앱 차이와 Tauri

Viewer `js/app.js`의 `applyEditorShiftFloatOrientation`, `setEditorShiftFloatFooter`, `toggleEditorShiftFloatOrientation` 및 초기 복원 호출을 읽어 확인했다. Viewer는 orientation/dock 저장키와 별도 함수, WebDAV는 `md-editor-shift-float-v1` 객체와 init 이벤트를 사용한다. WebDAV `mdpro/index.html`/`mdpro/js/` 전체를 Viewer 루트 소스 위에 복사하지 않는다. 오늘 도구 모음 기술문서의 대상 적응 절차를 함께 따른다.

Git 병합 복구 자체는 Viewer 이식이나 Tauri 빌드 대상이 아니다. 대상 웹 구현·frontend 준비·native 빌드·설치 검증은 모두 이번에 미실행. 대기 목록 ID `MDPRO-20261125-MERGE-PUSH-RECOVERY`에 연결한다. DOCX Word 열기·실제 인쇄/PDF 출력은 미실행.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-11-25-merge-push-recovery.md,
2026-11-25-editor-shift-three-modes.md를 읽어줘. 먼저 대상 Git 충돌 및 실제 도구 모음
저장키·초기화·하단 슬롯 구조를 확인해줘. 충돌이 있으면 양쪽 기능·문서를 보존하고,
WebDAV 파일 전체를 덮어쓰지 말아줘. 필요한 경우에만 대상 저장 구조에 맞춰 하단바 기본값,
기존 명시 배치/좌표 복원, 9개 버튼과 한 행 높이 보존을 선택 적용해줘.
메인/PV·320/390px·3모드·새로고침·드래그를 검증하고 기존 실패와 새 실패를 구분해줘.
기술문서·목록·Tauri 상태를 갱신해줘. 이 명령에는 Tauri 빌드·설치가 포함되지 않아.
```

# 2026-11-13 AI Jena Dock의 popover 소유권 분리

- 변경 ID: MDPRO-20261113-JENA-DOCK-POPOVER
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋. 대상: C:\CusorApps\md-viewerVscode\md_viewer, 대상 확인 필요.
- 상태: WebDAV 방어 수정 및 Chrome iframe 배치 전환 확인. 사용자 스크린샷과 동일한 공백은 재현하지 못했으며 원인 확정/사용자 환경 해결 여부 미검증. Viewer 이식·Tauri 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 구현

Jena 버튼을 눌러 오른쪽 공간은 생기지만 내용이 공백인 현상. 기존 setLayout은 바깥 #ai-chat-dock-slot과 내부 #ai-chat-panel 양쪽에 popover=manual을 유지하고 Dock에서는 바깥 slot만 showPopover했다. 표시 주체를 하나로 분리하여 Dock 자식 패널은 일반 DOM으로 배치하도록 좁게 수정했다.

- mdpro/AI_App/aiChat/ai-chat.js setLayout: leaveChatTopLayer 후 Dock 분기에서 panel.removeAttribute('popover'), 나머지 popup/fullscreen/floating 분기에서 panel.setAttribute('popover','manual') 복원. appendChild와 기존 배치/열림 상태·단축키·설정·저장 로직 유지.
- mdpro/js/app.js: aiChat 동적 URL에 dockPopover=20261113-1 추가.
- mdpro/index.html: app.js 쿼리 jenaDock=20261113-1 추가.
- mdpro/Apps/PWA/service-worker.js: 20261113-jena-dock-popover-1 캐시 갱신.
- tests/aiJenaDockPopover.browser.cjs: Vite 테스트 전용 same-origin iframe, 실제 앱 지연 로딩, Chrome CDP로 Alt+2/1/2/3/2/4/2 전환, checkVisibility, popover 소유권, 헤더/입력 존재, 닫기/재열기 확인. Chrome 새 임시 프로필 사용, 별도 패키지 의존성 없음. CHROME_PATH 대신 Windows 기본 Chrome 경로를 사용한다.

컨트롤 인벤토리: history-toggle/new/copy-all/save-all/data-center-open/layout-menu-button/close 모두 원본 그대로 유지. Alt+4 drag-handle/toggle/입력/응답 모드/실시간 쓰기/send-stop도 유지. CSS·컨트롤 HTML·이벤트 바인딩·수식 및 내보내기 경로는 미변경. 새 숨김/클리핑 규칙 없음.

## 검증과 제한

- node --test tests/aiJenaUiContract.test.mjs: 최종 29/29 통과. 캐시 쿼리 선두 삽입 시 기존 URL 계약 검사 1개가 실패하여 기존 쿼리 순서를 보존한 뒤 재검사 통과.
- node tests/aiJenaDockPopover.browser.cjs: Chrome 실제 iframe 앱에서 배치 전환 7회, Dock 소유권, 닫기/재열기 통과.
- node --check mdpro/AI_App/aiChat/ai-chat.js, node --check mdpro/js/app.js, git diff --check 및 npm run build 통과. 기존 큰 청크 경고 존재.
- 최초 격리 fixture의 이전 공백 재현 단언은 실패했다. Chrome은 닫힌 popover에도 author display:flex를 적용하므로 해당 단언을 제품 원인 증거로 사용하지 않았다. 최종 테스트는 실제 앱의 변경 후 배치 상태를 검사한다. 테스트 셸 초기 경로 오류도 수정했다.
- 실제 사용자 브라우저/저장된 설정에서 공백 해결 여부 미검증. 초기 설명의 원인 확정 표현은 철회하며 이 수정은 중첩 popover 생명주기 제거를 위한 방어 조치다. 실제 AI 응답 생성 및 모바일 물리 기기 검증 미실행.

## 대상 적응과 Tauri 계획

| 원본 | 대상 대응 | 적응/상태 |
| --- | --- | --- |
| aiChat/ai-chat.js setLayout | 대상 AI_App/aiChat/ai-chat.js 실제 확인 필요 | Dock slot/panel top-layer 구조 비교 후 분기만 이식, 전체 파일 덮어쓰기 금지 |
| app.js/index.html/PWA 캐시 | 대상 로더·자산 캐시 | 대상 독립 버전/브리지 유지, 미이식 |

대상 경로 접근 불가 시 미검증으로 남긴다. Viewer 웹 이식 후 Docs/mdpro-development/TAURI_BUILD.md를 확인하고 프런트엔드 준비, Tauri/dist 자산, 네이티브 빌드 및 설치 앱 배치 전환을 각각 검증한다. 이번에는 대상 웹 수정/네이티브 빌드/설치를 요청하지 않아 실행하지 않았다. 대기 ID는 위 변경 ID.

## 복사할 구현 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-jena-dock-popover.md를 읽어줘. 실제 setLayout/popover/iframe 구조를 먼저 비교하고 Dock에서는 바깥 slot만 popover 소유자가 되고 자식 panel은 일반 DOM이 되도록 적응해줘. popup/fullscreen/floating으로 바꿀 때 panel popover를 복원하고 모든 기존 컨트롤과 단축키·저장 설정을 보존해줘. 파일 전체 덮어쓰기 없이 실제 보기와 Alt+1/2/3/4·닫기/재열기를 검증하고 UI 계약·문서·인덱스·Tauri 빌드 대기를 갱신해줘. 사용자 공백 현상의 재현/해결 여부를 별도로 보고하고 Tauri 빌드·설치는 실행하지 마.
```

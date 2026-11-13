# 2026-11-13 Jena Tidy·Jena JS 연결 상태 보존

- 변경 ID: MDPRO-20261113-TIDY-CONNECTION
- 원본: C:\CusorApps\WebDav-MD\webdav-md (미커밋)
- 대상: C:\CusorApps\MDPRO\MDproViewer (읽기 비교만, 미수정)
- 상태: WebDAV 구현·34개 테스트·웹 빌드 통과. 실제 웹 화면/실공급자 연결 미검증. Viewer 이식·frontend/native/설치 검증 미실행.

## 요청과 구현

두 탭은 동일한 공급자/모델 선택기와 연결 상태를 공유한다. 기존 공급자, 모델, 새로고침, 코드 수정/되돌리기, 입력·전송·중지·등록·테스트·저장·탭을 보존했다.

공통 mountAITaskPicker는 summary에 .ai-task-connection 상태 요소를 추가하지만 tidy-jena.js의 updateModelSummary가 summary.textContent를 대입하여 그 요소를 제거했다. summary 안에 #jena-model-label을 추가하고 이 라벨만 갱신하여 상태 요소를 보존한다. 연결 확인 중/연결됨/연결 실패는 공통 선택기의 기존 조회 결과를 사용한다. 캐시 목록을 실제 연결 증거로 사용하지 않도록 마운트 직후 sharedPicker.refresh()를 실행한다. 공급자 변경은 기존 선택기가 확인하고, 모델 목록 선택/직접 ID 입력 확정(change)은 Tidy가 refresh를 요청한다. 공통 ticket 가드가 이전 조회 결과를 무시한다.

- mdpro/js/Tidy/tidy-jena.js: 라벨 분리, 초기/모델 변경 연결 확인.
- mdpro/js/Tidy/tidy-workspace.css: summary 상태 줄바꿈, 연결/실패 색상. 접힌 상태에서도 summary에 표시된다.
- mdpro/js/Tidy/tidy-script-manager.html: JS/CSS 캐시 키 갱신.
- 기존 작업 중인 task-provider-picker.js는 이번 작업에서 수정하지 않았다.

## 대상 비교와 적응

Viewer의 AI_App/aiChat/task-provider-picker.js도 summary.appendChild(badge)를 사용한다. 그러나 Viewer js/Tidy/tidy-script-manager.html에 자체 구현이 있으며 원본과 동일한 tidy-jena.js 파일은 없다. 대상 UI 초기화·브리지·인증·저장소는 독립 보존하고 해당 summary 갱신 호출을 찾아 라벨만 변경하도록 적응해야 한다. 전체 파일 복사는 금지한다. 대상 런타임 검증은 미실행이다.

## 검증

- node --test tests/tidyJena.test.mjs tests/aiJenaUiContract.test.mjs: 34/34 통과.
- node --check mdpro/js/Tidy/tidy-jena.js 및 mdpro/AI_App/aiChat/ai-chat.js: 통과.
- git diff --check: 통과.
- npm run build: 통과 (기존 chunk 크기 경고).
- 브라우저 회귀 시도: 기존 테스트가 참조하는 Playwright 모듈 부재(MODULE_NOT_FOUND)로 실행 불가. 임시 테스트는 제거. 실제 UI/네트워크 연결 성공은 주장하지 않는다.
- 후속 실제 회귀: 두 탭에서 최초 연결 확인→연결됨, 모델 변경 후 재확인, 잘못된 서버/인증에서 실패, 새로고침으로 복구, 설정 접기 후 상태 표시, 기존 코드 편집/전송/저장 보존 확인.

## Tauri

대기 목록 ID: MDPRO-20261113-TIDY-CONNECTION. Viewer 웹 이식 후 자체 프런트엔드 자산을 빌드에 포함해야 한다. 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 dist와 설치 앱에서 두 탭/접힌 상태/실패 복구를 확인한다. 이번 요청에 대상 이식·Tauri 빌드·설치는 없으며 모두 대기이다.

## 복사 가능한 이식 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md, Docs/mdpro-development/README.md와 WebDAV 원본 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-tidy-connection.md를 읽어줘. Jena Tidy/Jena JS 공통 모델 summary 갱신이 연결 상태 badge를 삭제하지 않도록 라벨을 분리하고 최초 열기/모델 변경 시 실제 모델 조회로 연결을 확인해줘. 자체 HTML·브리지·인증·저장소를 보존하고 전체 파일은 덮어쓰지 마. 두 탭/모델 변경/실패·복구/접힌 상태/기존 컨트롤을 검증하고 문서·목록·Tauri 대기를 갱신해줘. 이번에는 Tauri 빌드나 설치를 실행하지 말고 미검증을 구분해줘.
```

# AI 대체 전 원문 저장·복원

- ID: MDPRO-20261117-ORIGINAL-RESTORE / 2026-11-17 / 미커밋
- 원본: C:/CusorApps/WebDav-MD/webdav-md. 대상: C:/CusorApps/MDPRO/MDproViewer.
- 상태: 원본 구현·자동검사·웹 빌드 완료. 실제 UI/새로고침/설치 앱 미검증. Viewer 웹 이식·frontend/native/설치 검증 대기.

## 요청·사용 동작

AI가 선택 원문을 대체할 때 직전 문서 원문을 저장한다. AI Jena 선택 가져오기 옆 `#ai-chat-restore-original` 버튼(원문 복원)으로 마지막 대체 직전 상태를 복원한다. 브라우저 localStorage에 문서별 최신 1개 백업이 남는다. 복원 성공 후 백업을 제거한다. 다음 대체는 최신 직전 원문으로 갱신한다. 저장 키는 ss_ai_jena_original_v1: + encodeURIComponent(getTocDocumentKey()). 기존 백업이 없는 상태, 다른 문서, 대체 후 추가 편집, 활성 스트림 중 복원은 오류 안내한다. 브라우저 데이터 삭제 시 백업도 삭제된다. 원문은 외부 서버로 전송하지 않는다.

## 구현

- mdpro/js/app.js aiOriginalBackupKey/saveAIOriginalBackup/restoreAIOriginalDocument: before/after/savedAt JSON 저장. 저장 실패 시 대체 전에 오류를 내어 원문 유실 방지. 복원은 현재 문서 전체가 after와 일치해야만 허용하며 undo snapshot → CM6 dispatch 및 textarea 동기화 → input/change → autosave/TOC 순서로 처리한다.
- insertAIChatTextIntoDocument: replace이며 실제 선택 범위가 있을 때 변경 전 백업한다. 커서/줄 아래/맨아래 삽입은 백업을 덮어쓰지 않는다.
- startRealtimeDocStream: isReplacing일 때 최초 변경 전 원문 저장, session.originalBackup 보관. insertedLength를 초기 대체 범위 길이로 설정해 최초 CM6 dispatch도 원래 선택 길이를 제거한다. finishRealtimeDocStream(중지 경로 포함)에서 실제 결과를 after로 저장한다. 실행 중 복원은 거부한다.
- AIChatBridge.restoreOriginalDocument 노출. AI_App/aiChat/ai-chat.js에 원문 복원 버튼과 클릭 처리 추가. 실행 중 클릭은 중지 안내. 기존 header 7개 버튼, Alt+4 이동·입력·모드·문서 쓰기·send/stop·모델/설정 모두 보존. CSS·숨김·삭제 없음. 기존 NPU/선택 가져오기 미커밋 수정 보존.
- 제한: 최신 1개만 지원. 대체 이후 추가 편집 시 자동 병합 복원은 하지 않는다. 중간 강제 종료 시 before는 남지만 완료 after가 없으면 직접 복원이 거부될 수 있다. 경로/제목 기반 getTocDocumentKey 문서 식별을 사용하므로 같은 이름의 미저장 문서 구분은 제한적이며 전체 after 일치로 추가 보호한다.

## 검증

node --test tests/aiOriginalRestore.test.mjs tests/aiImportedSelection.test.mjs tests/aiJenaUiContract.test.mjs tests/aiNpuStreaming.test.mjs: 38/38 통과. 복원 검사: 새 runtime에서 저장 원문 복구, 1회 복원 후 제거, 다른 문서·추가 편집·진행 중 거부, quota 실패 처리. 기존 tests/aiImportedSelection.test.mjs에는 백업 함수 stub 추가.
node --check mdpro/js/app.js 및 mdpro/AI_App/aiChat/ai-chat.js, git diff --check 통과. npm run build 통과(기존 청크 크기 경고). 실제 브라우저 화면·CM6 undo·새로고침 후 버튼 복원은 미검증. 이전 작업의 aiRealtimeDocWrite.test.mjs 문구/캐시 3건 불일치는 이전 인계 문서에 기록되어 있으며 수정하지 않음. 수식·인쇄 렌더러 변경 없음.

## 대상 적응·Tauri

원본 mdpro/js/app.js와 mdpro/AI_App/aiChat/ai-chat.js → 대상 js/app.js와 AI_App/aiChat/ai-chat.js. 대상 파일의 원문 복원 관련 함수/문구 검색에서 대응을 확인하지 못함. 대상 확인 필요. 대상 문서 ID·저장소·bridge·stream/undo 경로를 독립 확인하고 필요한 함수만 이식한다. 전체 파일 덮어쓰기 금지.
큐 MDPRO-20261117-ORIGINAL-RESTORE. 대상 웹 이식·검증·frontend 자산 반영·네이티브 빌드·설치 검증 모두 대기. 빌드 요청 시 Docs/mdpro-development/TAURI_BUILD.md를 따라 실제 frontend 출력 및 Tauri/dist 자산, 설치 앱 저장/복원을 검증한다. 이번 대상 수정·빌드·배포 없음.

## 복사 가능한 이식 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-17-original-restore.md를 읽고 AI 선택 원문 대체 직전 백업 및 원문 복원 버튼을 대상에 선별 이식해줘. 먼저 선택 가져오기 대체 경로·대상 문서 ID·저장소·브리지·CM6/undo를 확인하고 전체 파일을 덮어쓰지 마. 문서별 최신 1개 영속 백업, 저장 실패 시 대체 중단, 새로고침 후 복원, 타 문서/추가 편집/진행 중 거부, 일반 삽입 미영향을 검증하고 문서·인덱스·Tauri 큐를 갱신해줘. 대상 빌드·배포는 실행하지 말고 실제 UI 미검증을 명시해줘.
```

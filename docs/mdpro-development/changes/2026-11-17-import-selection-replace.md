# 가져온 원문 대체 범위 보존

- ID: MDPRO-20261117-IMPORT-REPLACE / 2026-11-17 / 미커밋
- 원본: C:/CusorApps/WebDav-MD/webdav-md. 대상: C:/CusorApps/MDPRO/MDproViewer.
- 상태: 원본 구현·자동검사·웹 빌드 완료. 실제 UI 미검증. Viewer 미이식, Tauri frontend/native/설치 검증 대기.

## 요청과 구현

선택 가져오기 후 AI 결과로 원문을 대체하는 동작 복구. 입력창 포커스 이동이나 selectionchange의 collapsed 선택 갱신과 독립적으로 가져온 원문의 범위를 보관한다.

- AI_App/aiChat/ai-chat.js putDocumentSelectionInComposer: 입력창 포커스 전 bridge.rememberImportedDocumentSelection(selected) 호출. 클릭 및 Ctrl+Alt+L 공통 적용.
- js/app.js rememberImportedDocumentSelection: editor/CM6 선택 범위 우선 사용. 보기 선택처럼 좌표가 없으면 정확히 한 번만 나오는 원문만 매핑한다. 중복 문자열의 임의 위치를 선택하지 않는다.
- getImportedDocumentSelection: 저장 범위의 원문이 변경되면 원문 재선택 오류를 내고 대체를 막는다.
- startRealtimeDocStream: cursor 대상에서 보관 범위를 우선 적용해 isReplacing=true로 시작한다. 이어쓰기와 document-end 명시 선택은 기존 동작 유지. 시작 성공 시 보관 범위 해제.
- insertAIChatTextIntoDocument: 명시적 replace에서도 보관 범위로 대체. 성공 시 해제. cursor/line-below/document-end 의미는 유지한다.
- UI 컨트롤·ID·단축키·설정·CSS 변경 없음. 앞선 NPU 스트리밍 미커밋 변경 보존. 신규 의존성/저장 키 없음.

## 검증

node --test tests/aiImportedSelection.test.mjs tests/aiJenaUiContract.test.mjs tests/aiNpuStreaming.test.mjs: 35/35 통과. 새 회귀는 가져온 후 선택이 사라져도 앞/뒤 원문 보존 및 선택 범위 대체, 원문 변경 시 거부, 명시적 맨아래 삽입을 검증한다.
node --check mdpro/js/app.js 및 mdpro/AI_App/aiChat/ai-chat.js 통과. npm run build 통과(청크 크기 경고). git diff --check 통과.
별도 tests/aiRealtimeDocWrite.test.mjs는 3개 실패: 문장 버튼 문구, 선택 대체 안내 문구, 예전 ai-chat.js 캐시 버전 문자열 불일치. git show HEAD의 기존 코드에도 세 기대 문자열이 모두 없음을 확인했다. 이번 작업으로 해당 문구/캐시를 변경하지 않음. 실제 브라우저·사용자 문서에서 대체/undo 검증은 미실행. 수식·인쇄 렌더러 변경 없음.

## 대상 적응 및 Tauri

원본 mdpro/js/app.js, mdpro/AI_App/aiChat/ai-chat.js에 대응하는 대상 js/app.js, AI_App/aiChat/ai-chat.js의 범위 저장/전송 구조를 독립 확인해야 한다. 이번 대상 검색에서는 startRealtimeDocStream/rememberEditorSelection 대응을 확인하지 못했으므로 대상 확인 필요. 전체 파일 복사 금지. 대상 브리지와 편집기 저장/undo 방식에 맞춰 선택 캡처 및 원문 검사를 이식한다.
빌드 큐 MDPRO-20261117-IMPORT-REPLACE. 웹 이식·웹 검증·frontend 자산 반영·native 빌드·설치 검증 모두 대기. 대상 Docs/mdpro-development/TAURI_BUILD.md를 읽고 빌드 요청 시에만 수행한다. 이번에 대상 수정·빌드·배포 없음.

## 복사 가능한 대상 명령

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 C:/CusorApps/WebDav-MD/webdav-md/docs/mdpro-development/changes/2026-11-17-import-selection-replace.md를 읽고 선택 가져오기 후 원문 대체를 대상 편집기/브리지에 맞게 복구해줘. 전체 파일 덮어쓰기 없이 가져올 때 범위 보관, 원문 일치 검증, 실시간 cursor 대체 및 명시적 replace를 연결해줘. document-end와 이어쓰기, 다른 문서, 중복 원문, 원문 수정 후 거부, undo를 검증하고 문서·인덱스·Tauri 큐를 갱신해줘. 대상 빌드와 배포는 실행하지 말고 실제 UI 미검증은 명시해줘.
```

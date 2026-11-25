# MDpro 신규 문서를 WebDAV 새 파일로 저장

- 변경 ID: MDPRO-20261117-NEW-WEBDAV-SAVE
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 대상: MDproViewer (대상 확인 필요)
- 작성/확인: 2026-11-17, 미커밋. 이전 Jena 변경 보존.
- 상태: WebDAV 구현·자동 검사·빌드 완료. 실제 NAS/UI 미검증. Viewer 미이식, Tauri frontend/native/설치 미실행.

## 요청과 구현

WebDAV 파일을 열지 않고 MDpro에서 만든 문서를 WebDAV의 원하는 다른 폴더에 새 이름으로 저장한다. 기존 폴더 선택 모달을 재사용하며 새 폴더 생성 기능 자체는 이번 범위에 추가하지 않는다.

- mdpro/js/webdav-host-bridge.js saveToWebDav: hostDocument가 없어도 save-as 메시지를 전송한다. 일반 저장도 원격 경로가 없으면 save-as로 연결한다. 원문은 기존 currentDocumentText로 가져오고 path는 빈 문자열로 보내 기존 선택 경로를 잘못 덮어쓰지 않는다. 메뉴 WDSaveAs에 새 WebDAV 파일 저장 설명 추가. 기존 저장/닫기/자동저장/메뉴 ID 유지.
- src/App.jsx handleSaveFileAs: 빈 sourcePath를 신규 문서로 구분하고 document.md와 현재 탐색 폴더를 기본값으로 제안한다. 원격 원본이 있으면 기존 -copy 이름/원본 폴더 유지. confirmSaveFileAs의 기존 exists 확인·덮어쓰기 확인·saveFileVerified·선택 경로 갱신 사용.
- src/components/MdproEditor.jsx: bridge 캐시 버전 갱신. postMessage의 기존 same-origin/source 검증 유지. 신규 의존성 없음. 문서 렌더링/수식/인쇄/내보내기 경로 미변경.

## 사용과 보존

업로드 메뉴의 WDSaveAs → 저장 폴더 선택 → 파일명 입력 → 새 파일로 저장. 저장 성공 후 새 원격 경로가 연결된다. 미연결 문서에서 저장 후 닫기를 누른 경우도 먼저 저장 위치를 선택하며 새 파일 저장 직후 자동 닫기는 제공하지 않는다. 취소/실패 시 기존 문서 유지. 기존 파일 덮어쓰기는 사용자 확인을 거친다.

## 검증

node --test tests/webdavNewDocumentSave.test.mjs: 3 통과. 미연결 save-as의 원문/빈 경로, 일반 저장의 save-as 전환, 기존 원격 파일 저장/복사 경로 보존 확인.
node --check mdpro/js/webdav-host-bridge.js 및 git diff --check 통과. npm run build 통과(기존 큰 chunk 경고).
실제 폴더 선택/쓰기·덮어쓰기·인증 실패·저장 뒤 편집 UI는 미검증. 실제 서버에 테스트 파일은 생성하지 않았다.

## 상대 앱·Tauri

| 원본 | 대상 | 적응 |
| --- | --- | --- |
| webdav-host-bridge.js → MdproEditor.jsx → App.jsx | 대상 확인 필요 | React WebDAV 호스트가 있는지 먼저 조사, native 저장과 독립 유지 |

Viewer의 실제 대응 코드 이번 작업에서 미확인. WebDAV 전용 호스트 기능으로 전체 파일 복사 금지. 대상에 같은 임베딩 구조가 없다면 적용 불필요 또는 별도 WebDAV transport 구현 필요. 빌드 대기 ID는 위 ID. 대상 필요성 판단/웹 이식/frontend/native/설치 모두 대기. 빌드 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md를 먼저 읽는다. 자동 빌드/커밋/배포 없음.

## 복사할 구현 명령

```text
대상 MDproViewer 저장소에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-17-new-document-webdav-save.md를 읽어줘. WebDAV 호스트 연결 및 신규 문서 저장 지원을 실제 코드와 비교하고, 지원되는 경우에만 원본 경로 없는 문서를 폴더/파일명 선택 후 새 원격 파일로 저장하도록 적응해줘. 전체 파일 복사 없이 기존 native 저장·메뉴·원본 보호를 유지하고 취소/기존 원격 저장/새 저장/중복 파일 확인을 검증해줘. 적용 불필요하면 이유를 기록해줘. 문서·목록·Tauri 대기를 갱신하고 빌드·설치·커밋·배포는 하지 마.
```

## 후속: 확장자 자동 추가 (2026-11-17)

src/components/SaveAsModal.jsx에서 trim된 입력에 확장자가 없으면 .md를 추가한 saveName을 경로 미리보기와 onConfirm 양쪽에 사용한다. 입력 소설design → /선택폴더/소설design.md. 기존 .md/.MD/.txt/.html 등 명시한 확장자는 유지하며 빈 이름과 금지 문자는 기존 검증으로 차단한다. 끝 마침표는 제거한 뒤 .md를 붙인다. 입력란 아래 자동 추가 안내를 표시한다. 기존 폴더/파일명/취소/저장 컨트롤·ID·이벤트 유지, 신규 의존성/캐시 변경 없음. npm run build 및 git diff --check 통과. 실제 UI/NAS 쓰기 미검증. Viewer 대응 모달은 대상 확인 필요, 이식/frontend/native/설치 미실행. 재명령 시 같은 저장 모달에서 확장자 생략과 미리보기/실제 저장명이 일치하도록 적용하고 기존 확장자를 보존할 것.

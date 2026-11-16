# 2026-11-14 이동 원본 폴더 초기 펼침

- 변경 ID: MDPRO-20261114-MOVE-SOURCE-EXPAND
- 원본: C:\CusorApps\WebDav-MD\webdav-md, 미커밋
- 대상: C:\CusorApps\MDPRO\MDproViewer, 미수정
- 상태: WebDAV 구현·빌드·초기값 검증 완료, 실제 웹 화면 미검증. Viewer 이식·frontend 준비·Tauri native 빌드·설치 검증 미실행.

## 요청과 실제 구현

이동 메뉴를 열면 선택 항목이 있는 모든 원본 폴더와 그 상위 경로를 펼친다.
`src/components/MoveDestinationModal.jsx`의 `expandedPaths` useState 초기화에서 각 `items[].remotePath`의 마지막 이름을 제거하고 각 상위 경로를 Set에 추가한다. 루트는 항상 포함한다. 예: `/연구/기획/문서.md`와 `/자료/파일.md`를 선택하면 `/`, `/연구`, `/연구/기획`, `/자료`를 펼친다. 관련 없는 폴더의 초기 접힘은 유지한다.

`FileExplorer.jsx`의 기존 key가 선택 경로별/닫힘별로 모달을 다시 마운트하므로 매번 열 때 초기값이 적용된다. effect로 지속 재확장하지 않아 사용자가 직접 다시 접을 수 있다. 이동 대상 자동 선택은 하지 않는다. 폴더 선택, 펼침/접힘, 닫기, 취소, 이동, 충돌 처리, 진행률/오류 UI 및 기존 ID·이벤트는 그대로 유지한다. 신규 CSS·의존성·캐시 변경 없음. 보기/PV/miniPV/AI/내보내기·저장 로직 영향 없음.

## 대상 비교와 적응

Viewer `js/webDAV/storage/nas-webdav.js`의 `moveFile(btn)`는 `allFiles`·`_emptyFolders`에서 경로 목록을 만들고 `moveFolder(btn)`도 별도 경로 집합을 사용한다. React `items`·모달 state와 다르다. 대상의 실제 선택 UI와 초기 펼침 연결은 미검증이다. 대상 경로/선택 모델을 확인한 후 원본 부모 경로 집합만 해당 UI 초기 상태에 연결한다. 전체 React 파일을 덮어쓰지 않는다. 대상 적용 없음.

## 검증 증거

- Node에서 실제 소스 초기화 함수를 추출해 다중 원본·한글 중첩 경로·루트 파일·폴더 이동·빈 선택의 예상 Set을 assert로 검증: 통과.
- `npm run build`: 종료 0, 대형 청크 경고 있음.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- diff 검토: 기존 컨트롤 제거·새 숨김/클리핑 규칙 없음.
- 실제 UI 및 NAS 이동 미검증. 실제 확인: 중첩/여러 폴더의 파일을 선택해 모달을 열고 해당 원본 폴더가 펼쳐지는지, 수동 접기와 재열기 초기화, 이동 불가 원본 폴더와 정상 대상 선택 동작을 확인한다. 트리는 기존처럼 폴더만 표시한다.

## Tauri 계획

WebDAV 호스트 React 전용 변경으로 Viewer 자산 직접 변경 없음. 큐 ID MDPRO-20261114-MOVE-SOURCE-EXPAND. 대상 UI 적응·웹 검증 후 frontend 준비/native 빌드/설치 검증이 필요하며 모두 대기. 이번 빌드 요청 없음.

## 복사할 구현 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-14-move-source-expand.md를 읽어줘. NAS moveFile/moveFolder 선택 UI와 경로 모델을 먼저 확인하고 이동 메뉴를 열 때 원본 폴더와 모든 조상 폴더를 펼치도록 대상 구조에 맞춰 구현해줘. 전체 파일을 덮어쓰지 말고 다중/중첩/루트 파일, 수동 접기, 재열기, 기존 이동/취소를 실제 검증해줘. 문서·인덱스·Tauri 큐를 갱신하고 미검증 상태를 보고해줘. Tauri 빌드는 하지 마.
```

## 후속 수정: 파일이 있는 모든 폴더 펼침 (2026-11-14, 미커밋)

사용자 실제 화면에서 최종 원본 폴더에 펼침 화살표와 내부 파일이 없었다. 앞 구현은 선택 원본 경로만 열고 FolderChoice가 파일을 제외했으므로 사용자 기대를 충족하지 못했다. 위의 ‘관련 없는 폴더 초기 접힘’ 및 ‘폴더만 표시’ 설명은 이 후속 변경으로 대체한다.

- `MoveDestinationModal` 초기화의 `expandFileFolders(directoryTree)`가 전체 트리를 순회하여 파일이 있는 폴더와 모든 조상을 펼친다. 빈 폴더는 기본 접힘, 선택 원본 조상 펼침도 유지한다.
- `FolderChoice`는 folders 외 files도 계산하고 `hasChildren`으로 펼침 버튼을 활성화한다. 따라서 파일만 있는 마지막 폴더도 펼침/접힘 가능하다. 펼쳤을 때 파일명과 File 아이콘을 읽기 전용 행으로 표시한다. 파일은 이동 목적지로 선택할 수 없고, 기존 폴더 선택 및 이동 불가 조건은 유지한다.
- 폴더/파일 순서는 각각 기존 entries 순서이며 폴더 다음 파일을 표시한다. 수동 접힘·취소·충돌·진행·전면 portal 유지. 컨트롤 제거 및 숨김 CSS 추가 없음.
- 실제 소스에서 초기화 함수를 추출한 Node assert: 중첩 A/B, 선택하지 않은 파일 폴더 C 모두 열림, empty 기본 접힘 통과. 파일 전용 폴더 펼침 버튼 및 파일 행 렌더링 연결 검사 통과.
- npm run build, node --check mdpro/AI_App/aiChat/ai-chat.js, git diff --check 통과. 빌드 대형 청크 경고 있음. 실제 브라우저/NAS 화면 확인은 미검증이다. 실제 확인 시 파일만 있는 최종 폴더의 화살표·파일 표시·수동 접기를 반드시 확인한다.
- Viewer moveFile은 기존 nas-webdav.js의 allFiles 기반 독립 구조임을 다시 읽기 확인. 전체 트리 초기 펼침·읽기 전용 파일 행 대응은 대상 확인 필요이며 미이식. Viewer frontend/native/설치 모두 대기, 이번 Tauri 빌드 없음.

후속 이식 명령:
```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 이 문서의 후속 수정을 읽고 NAS 이동 UI에 파일이 있는 모든 폴더 및 조상의 초기 펼침, 파일만 있는 폴더의 펼침 버튼, 내부 파일의 읽기 전용 표시를 대상 구조에 맞춰 구현해줘. 기존 이동 대상은 폴더만 선택하게 유지하고 전체 파일을 덮어쓰지 마. 중첩·비선택 파일 폴더·빈 폴더·수동 접기·이동/취소를 실제 UI에서 검증하고 문서와 Tauri 큐를 갱신해줘. Tauri 빌드는 하지 마.
```

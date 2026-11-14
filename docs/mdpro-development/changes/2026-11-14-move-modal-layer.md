# 2026-11-14 파일 이동창 전면 표시

- 변경 ID: MDPRO-20261114-MOVE-MODAL-LAYER
- 원본: C:\CusorApps\WebDav-MD\webdav-md (미커밋)
- 대상: C:\CusorApps\MDPRO\MDproViewer (미수정)
- 상태: WebDAV 구현·빌드 완료. 실제 UI 미검증. Viewer 이식·Tauri 빌드·설치 검증 미실행.

## 요청과 구현

문서의 떠 있는 창 뒤로 가려지는 ‘이동할 폴더 선택’을 문서 앞에 표시한다.
`src/components/MoveDestinationModal.jsx`의 `MoveDestinationModal` 반환부를 React `createPortal`로 `.webdav-shell`에 렌더링한다(body는 shell 부재 시 대체). 탐색기 stacking context를 벗어나면서 shell의 다크 테마와 글자색을 상속한다. z-index는 80에서 1100으로 변경하여 floating 문서(90), 전체화면 문서(100), Dock(1000) 위에 표시한다. 신규 의존성 없음.

기존 폴더 펼침/선택, 닫기, 취소/뒤로, 이동, 덮어쓰기, 이름 바꾸어 저장, 진행률 및 오류 UI와 이벤트는 보존한다. 수식·인쇄·PV·저장 로직 변경 없음.

## 상대 앱 적응

Viewer의 `js/webDAV/storage/nas-webdav.js` 존재를 읽기 확인했다. WebDAV React 탐색기와 동일한 이동창 대응 구현은 확인하지 못했으므로 대상 확인 필요·미이식이다. 대상 NAS 이동 UI의 DOM 부모, stacking context, 테마 상속과 실제 문서 창 레이어를 조사하고 필요한 부분만 적응한다. 전체 파일 및 React 컴포넌트를 덮어쓰지 않는다.

## 검증

- `npm run build`: 종료 0. 기존 대형 청크 경고 발생.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`: 종료 0.
- `git diff --check`: 통과.
- 코드 diff 검토: 컨트롤 삭제 및 숨김/클리핑 규칙 추가 없음.
- 실제 브라우저 UI 및 실제 NAS 파일 이동 미검증. 확인 사례: 문서를 floating/전체화면으로 열고 파일 이동창을 띄워 폴더 목록과 하단 이동/취소 버튼이 앞에 표시되는지, 다크/라이트·폴더 펼침·충돌 처리·취소가 유지되는지 확인한다.

## Tauri 영향

WebDAV 호스트 React UI만 변경되어 Viewer에 직접 포함되는 자산은 없다. Viewer 대응 결함 확인·선택 이식 후 웹 검증이 선행되어야 한다. 대기 ID는 MDPRO-20261114-MOVE-MODAL-LAYER. frontend 준비/native 빌드/설치 검증 모두 미실행이며 이번 요청에 빌드는 포함되지 않는다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\MDPRO\MDproViewer에서 AGENTS.md와 WebDAV 저장소의 docs/mdpro-development/changes/2026-11-14-move-modal-layer.md를 읽어줘. NAS 파일 이동 폴더 선택창이 떠 있는 문서와 전체화면 문서 뒤에 가려지는지 먼저 확인하고 대상 DOM·테마·레이어 구조에 맞춰 필요한 부분만 수정해줘. 전체 파일을 복사하지 말고 폴더 선택/이동/취소/충돌 처리와 다크·라이트 실제 화면을 검증해줘. 이식 문서·인덱스·Tauri 대기 목록을 갱신하고 미검증 상태를 구분해줘. Tauri 빌드는 실행하지 마.
```

# Lemonade 설정 저장 버튼 테두리

- 변경 ID: `MDPRO-20261027-LEMONADE-SAVE-BORDER`
- 작성: 2026-10-27, WebDAV 미커밋.
- 원본: `C:\CusorApps\Webdav_md\webdav-md`.
- 상대: `C:\CusorApps\md-viewerVscode\md_viewer`, 미수정.

## 요청과 완료 기준

ENV의 Lemonade 설정 저장 버튼에도 주변 모델 확인·Load·Unload 버튼처럼 박스 테두리를 표시한다. 기존 버튼 문구·저장 이벤트·배경·글자색·크기는 보존한다.

## 실제 구현

`mdpro/index.html`의 `onclick="saveLemonadeSettings()"` 버튼에 `border border-amber-500`을 추가했다. 주변 모델 확인 버튼과 같은 amber 테두리다. 기존 컨트롤의 삭제·숨김·이동은 없다. JavaScript·저장 로직·모델 호출·캐시 URL·의존성 변경 없음. 기존 미커밋 변경은 보존했다.

## 상대 앱 대응표와 이식 순서

| WebDAV | Viewer 확인 | 상태 |
| --- | --- | --- |
| `mdpro/index.html`의 `saveLemonadeSettings()` 버튼 | `index.html`에서 동일한 `Lemonade 설정 저장` 문구 검색 결과 없음 | 대상 UI 확인 필요·미이식 |

전체 파일 복사 없이 실제 대상 저장 버튼의 스타일만 적용해야 한다.

## 검증

- 소스로 테두리 클래스 추가 및 기존 이벤트·다른 버튼 보존 확인.
- `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `node --test tests/aiJenaUiContract.test.mjs`: 29개 통과.
- `npm run build`: 통과, 기존 Vite 500KB chunk 경고 남음.
- 실제 브라우저 시각 검증 미실행.

## Tauri 반영 계획

WebDAV는 Tauri 대상이 아니다. Viewer의 저장 버튼 위치 확인·부분 이식 후 `index.html`을 frontend 자산에 포함하고 설치 앱에서 테두리를 확인해야 한다. 이번에는 Viewer 이식·Tauri 빌드·설치를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs/mdpro-development/changes/2026-10-27-lemonade-save-button-border.md를 읽고 Lemonade 설정 저장 버튼을 찾아 주변 버튼과 일관된 테두리 박스를 넣어줘. 기존 ID·저장 이벤트·다른 컨트롤을 보존하고 전체 파일을 복사하지 마. 기술문서·목록·Tauri 대기 상태를 갱신해줘. 네이티브 빌드·커밋·푸시는 실행하지 마.
```

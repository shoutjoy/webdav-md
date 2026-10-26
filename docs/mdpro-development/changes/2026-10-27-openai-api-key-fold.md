# 외부 OpenAI 호환 API Key 입력 기본 접기

- 변경 ID: `MDPRO-20261027-APIKEY-FOLD`
- 작성: 2026-10-27, WebDAV 미커밋.
- 구현: `C:\CusorApps\Webdav_md\webdav-md`. 상대: `C:\CusorApps\md-viewerVscode\md_viewer` 읽기 비교, 미수정.

## 요청과 완료 기준

외부 OpenAI 호환 API 설정의 API Key 입력 영역을 항상 기본 접힘으로 표시한다. `API Key 입력`을 클릭하면 입력칸·보기 버튼·발급 링크를 펼쳐 사용할 수 있다. ENV를 다시 열면 접힌다. 저장된 키와 API 연결 동작은 보존한다. 접힘 상태를 별도로 영구 저장하지 않는다.

## 실제 구현

- `mdpro/index.html`: API Key 입력칸, 기존 보기 버튼, OrcaRouter 발급 링크를 `details#openai-compatible-api-key-details` 안에 이동. open 속성 없이 초기 접힘. summary와 기존 `data-ai-details-toggle`에 연결해 펼치기/접기 표시 및 aria-expanded를 기존 초기화 함수가 동기화한다. Model ID·주소·기타 버튼은 영역 밖에 유지.
- `mdpro/js/app.js`: `openSettingsModal()` 진입 시 위 details의 `open = false`. 사용자가 펼친 뒤에도 다음 ENV 진입에서는 접힘. 키 값을 지우거나 저장 요청을 변경하지 않는다.
- app.js 캐시 URL에 `apiKeyFold=20261027-1` 추가. 기존 다른 작업의 미커밋 변경을 보존. 신규 의존성 없음.

## 상대 앱 대응표와 이식 순서

| WebDAV | Viewer 실제 확인 | 차이·상태 |
| --- | --- | --- |
| `mdpro/index.html` API Key details | `index.html`의 `openai-compatible-api-key-label`, `openai-compatible-api-key-link`, `openai-compatible-api-key-anchor` | Viewer 고유 ID가 존재하므로 보존한 채 details로 감싸야 함. 미이식 |
| `mdpro/js/app.js` `openSettingsModal()` | Viewer modal 진입 코드는 이번 작업에서 미조사 | 상대 진입 경로 확인 후 매번 접기 연결 필요 |

## 검증

- 변경 영역의 입력칸 ID·보기 버튼 이벤트·발급 링크 보존을 소스 확인.
- `node --check mdpro/js/app.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `node --test tests/aiJenaUiContract.test.mjs`: 29개 통과.
- `npm run build`: 통과, 기존 Vite 500KB chunk 경고 남음.
- 실제 브라우저 UI 검증 미실행. 자동 검사만으로 실제 접기/펼치기 UI 확인을 대신하지 않는다.

## Tauri 반영 계획

Viewer 미이식. 대상 `index.html`, `js/app.js`의 해당 영역에 부분 적용 후 frontend 준비·네이티브 빌드·설치 앱 검증 필요. 이번에는 WebDAV 웹 빌드만 수행하며 Tauri 빌드는 요청 범위가 아니다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs/mdpro-development/changes/2026-10-27-openai-api-key-fold.md를 읽고 외부 OpenAI 호환 API Key 입력 영역을 기본 접힘으로 바꿔줘. 기존 label/link/anchor/input ID와 보기 버튼을 보존하고 필요한 경우 펼쳐 입력할 수 있게 해줘. ENV를 다시 열면 접히되 저장 키를 변경하지 마. 기술문서·목록·Tauri 대기 상태를 갱신하고 네이티브 빌드·커밋·푸시는 실행하지 마.
```

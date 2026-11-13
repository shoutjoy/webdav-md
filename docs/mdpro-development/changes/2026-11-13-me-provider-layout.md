# Jena ME 접기·모델 행 겹침·글자 크기

- ID: MDPRO-20261113-ME-PROVIDER-LAYOUT
- 작성/확인: 2026-11-13, 미커밋. 기존 작업 트리 변경 보존.
- 원본 C:/CusorApps/WebDav-MD/webdav-md / 대상 C:/CusorApps/MDPRO/MDproViewer
- 원본 구현·자동 검사·웹 빌드 완료. 실제 UI 미검증. 대상 미이식, frontend/native/설치 검증 대기.

## 요청과 구현

접힌 Jena ME에서는 공급자/모델 행 전체를 숨기고 펼치면 접근 가능하게 한다. 기존 공급자·모델·직접 ID·새로고침·로드·이미지 점검·인증·연결 상태·진행률을 제거하지 않는다. 이미지/참고 텍스트/가져온 코드 수정/저장 기록 탭, 프롬프트/실행/삽입도 보존한다.

mdpro/js/mermaid/mermaid-editor/style.css: 열린 details의 display:flex가 같은 우선순위의 ai-collapsed display:none보다 나중에 선언되어 접힌 상태를 덮어쓰던 문제를 수정했다. 열린 선택자를 `#image-to-mermaid:not(.ai-collapsed) > #mermaid-ai-model-settings[open]`으로 제한했다. 이전 collapsed display:block 규칙을 제거했다.

접기 버튼을 absolute에서 static으로 바꾸고 grid-row:1, 모델 details를 grid-row:2로 배치한다. 펼친 패널의 상단 여백을 8px로 줄여 절대 위치 버튼용 공간을 제거한다. 공급자 picker는 wrap을 허용하며 가로 클리핑 대신 다음 줄로 흐르게 한다. select/input/button은 구체적인 범위 선택자로 font-size:12px를 적용한다. 모바일 클릭 영역은 min-height:40px, 데스크톱은 30px 유지한다. 사용자 요청에 해당하는 접힘만 숨기며 새로운 opacity/visibility/clipping 규칙 없음.

mdpro/index.html iframe URL과 내부 index.html CSS URL의 revisionChat 캐시를 20261113-12로 갱신했다. JS·저장 구조·수식·출력 경로 변경 없음.

## 대상 대응·이식

대상 js/mermaid/mermaid-editor/style.css에는 버튼 absolute/static 규칙이 존재함을 읽기 확인했다. 이번 WebDAV의 직접 자식 모델 행 구조가 대상과 같은지는 추가 확인 필요. 대상 index.html DOM과 기존 저장/초기화 구조를 먼저 확인한 후 해당 선택자만 이식한다. 전체 파일 덮어쓰기 금지. 원본 미수정.

## 검증 증거

- node --test tests/mermaidAiCollapse.test.mjs tests/aiJenaUiContract.test.mjs: 33/33 통과. 열린 details의 접힘 덮어쓰기 방지, 별도 grid 행, 글자 크기 계약 추가.
- node --check mdpro/AI_App/aiChat/ai-chat.js 통과.
- git diff --check 통과. 기존 작업과 이번 범위를 구분해 diff 검토.
- npm run build 통과. artifacts/me-provider-layout-build.txt 참고. 기존 큰 chunk 경고 존재.
- agent-browser로 실제 UI 확인 시도: C:/Users/User/.agent-browser 소켓 디렉터리 쓰기 권한 거부로 실행 실패. 실제 클릭/겹침/모바일 화면은 미검증이며 자동 검사를 live UI 증거로 간주하지 않는다.
- 후속 UI 검증: 390/800/1200px에서 접기 후 모델 행 전체 미표시, 펼친 후 버튼과 행 사각형 비중첩, 긴 모델명·로드 진행·모든 컨트롤 접근, 모델 12px 확인.

## Tauri 계획 및 재명령

TAURI_BUILD_QUEUE의 동일 ID. 대상 웹 이식/검증 → frontend 자산 포함 확인 → 별도 요청 시 Docs/mdpro-development/TAURI_BUILD.md에 따라 native 빌드/설치 앱 검증. 이번에 대상 빌드 요청 없음, 실행 안 함.

```text
C:/CusorApps/MDPRO/MDproViewer에서 AGENTS.md와 WebDAV docs/mdpro-development/changes/2026-11-13-me-provider-layout.md를 읽고 Jena ME 접기 시 공급자·모델 숨김, 펼친 상태 접기 버튼 비중첩, 모델 컨트롤 글자 12px를 대상 DOM에 맞춰 이식해줘. 전체 파일을 덮어쓰지 말고 기존 컨트롤·브리지·저장을 유지해줘. 390/800/1200px의 접기/펼치기/긴 모델명/진행률을 실제 UI 검증하고 문서·색인·Tauri 대기를 갱신해줘. Tauri 빌드는 포함하지 않아.
```

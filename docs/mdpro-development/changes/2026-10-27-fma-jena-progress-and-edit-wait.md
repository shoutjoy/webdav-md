# 2026-10-27 FMA AI Jena 92% 정지 표시와 편집 대기 처리

- 변경 ID: MDPRO-20261027-FMA-JENA-WAIT
- 원본: `C:/CusorApps/Webdav_md/webdav-md`; 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-10-27 (Asia/Seoul), 미커밋. 기존 미커밋·다른 변경을 보존한다.
- 원본 구현/67개 검사/웹 빌드 완료. 직접 API와 실제 앱 프록시 경로에서 원본 참조 편집 성공. 실제 브라우저의 헤더·대기·경과시간·중지 후 컨트롤 복구 확인. 브라우저 편집 완료까지의 전체 왕복은 기존 서버 작업 대기로 미확인. 상대 이식·Tauri 준비/네이티브 빌드/설치 앱 검증 미실행.

## 요청과 확인된 문제

사용자는 FMA AI Jena 이미지 편집이 92%에서 멈춘 뒤 실패하는 일을 반복 보고했다. `startAiJenaProgress`는 서버 진행률을 받지 않고 일정 시간마다 숫자를 올린 뒤 Math.min(92, ...)에서 멈추는 UI였다. 이 숫자는 실제 연산 성공/실패를 알려주지 않았다.

이전 180초 검증 한도를 600초로 늘려 동일한 512x512 참조 편집을 다시 확인하니 239.795초에 성공했다. 이는 180초 결과를 편집 불능으로 단정할 수 없다는 실제 증거다. 서버 로그에는 앞선 편집이 끝나기 전에 같은 원본 편집 요청이 반복 들어간 기록도 있었다. 브라우저 요청 중지/timeout 뒤에도 서버 계산이 계속될 수 있어 새 요청이 서버 큐에서 기다리면 대기 시간이 더 늘어난다. 모든 사용자 실패의 동일 원인을 단정하지 않고 확인한 진행 표시·대기·입력 크기 문제를 수정했다.

## 구현과 동작

- `mdpro/Apps/fmaviewer/js/ai/aiJena.js:setAiJenaProgress/startAiJenaProgress/setAiJenaRequestPhase`: 서버 응답 전에는 퍼센트를 만들지 않고 indeterminate 막대와 분:초 경과시간을 표시한다. aria-valuenow를 제거하고 aria-valuetext에 대기를 설명한다. 원본 준비, 이전 서버 작업 대기, 편집 응답 대기, 이미지 수신·히스토리 저장을 구분한다. 완료/실패 시 timer·indeterminate를 정리하고 실제 결과 처리 후에만 100%를 표시한다. Veo도 알 수 없는 진행률은 경과시간으로 표시하며 기존 영상 수신/완료 처리는 유지한다.
- `lemonadeSettings.js:waitForFmaLemonadeIdle`: health에서 image/sd-cpp 슬롯의 is_busy/is_streaming/in_use를 확인한다. 이전 작업이 끝날 때까지 2초 간격으로 확인한 뒤 POST를 보낸다. 상태 확인 한 번은 15초 제한, 이전 작업 대기는 10분 제한이며 사용자 AbortSignal로 즉시 빠져나온다. 상태/인증 오류를 무시하고 POST를 보내지 않는다. 실제 생성/편집 및 생성 대체 요청 모두 이 확인을 거친다. 서버 health는 원자적 잠금이 아니므로 다른 앱에서 확인 직후 제출하는 요청까지 전부 막는 분산 락은 아니다.
- `aiJena.js:prepareAiJenaLocalImages`: PNG/JPEG/WebP의 원본/참조를 무제한 해상도로 그대로 보내던 것을 Lemonade 출력 크기의 긴 변에 맞춰 비율 보존한 요청 사본으로 줄인다. 기본 출력512이면 1024x2048 참조는256x512로 전달한다. 원본과 같은 크기 마스크는 같은 크기로 맞추고 마스크 보간은 끈다. 작은 이미지는 확대하지 않는다. 저장된 원본·참조 바이트/갤러리·히스토리는 변경하지 않는다. AI Studio 전송은 이 로컬 제한을 적용하지 않는다.
- 브라우저 작업 중지 문구에는 서버 계산이 계속될 수 있으며 다음 실행이 이전 작업 종료를 기다린다는 사실을 표시한다. 기존 인증·선택 모델·생성 대체 시 원본 참조 미반영 안내/선택영역·Try-on 예외를 유지한다.
- `css/styles.css`: AI Jena 헤더의 flex-shrink를 막아 줄바꿈한 공급자/모델 컨트롤이 본문 아래로 밀리는 문제를 수정했다. 표시·접근 가능 상태의 기존 버튼을 제거하지 않았다. indeterminate 막대와 reduced-motion 대응을 추가했다.
- FMA index의 CSS/관련 JS, 부모 index의 internal-image-app, 내부 FMA URL cache를 `20261027-edit-wait-2`로 갱신했다. 기존 앱 파일이 열려 있으면 앱 새로고침 후 FMA를 닫고 다시 열어야 새 코드가 반영된다. 신규 의존성 없음.
- `scripts/verify-fma-lemonade-generation.mjs`: 실제 FMA transport와 idle 대기 함수를 불러오고 --edit, --base로 직접/프록시 연결을 검증한다. 기존 180초 제한은600초로 조정했다. 검증 스크립트의600초는 대기와 편집 전체를 포함하며 브라우저 런타임에 180초 제한이 있었다는 뜻은 아니다. 서버 프로필/모델/다른 채팅 모델은 이번 턴에서 변경하지 않았다.

## 검증

- `node --test tests/fmaJenaProgress.test.mjs tests/fmaJenaModels.test.mjs tests/fmaLemonadeGeneration.test.mjs tests/aiJenaUiContract.test.mjs tests/fmaMdproApiKey.test.mjs tests/fmaDocumentInsert.test.mjs`: 67개 통과, 실패0.
- 신규 검사는 4분 대기에도 허위92% 없음, aria/완료 정리, 이전 이미지 모델 busy 대기, 중지·인증/미확인 상태, 1024x2048 원본·마스크의 비율 보존256x512사본, 마스크 보간 끄기, 작은 이미지 무확대·원본 불변을 확인한다.
- 수정한 FMA JS/본문 ai-chat.js node --check, git diff --check: 통과.
- npm run build: 성공. 기존500kB chunk 경고 존재.
- 실제 직접 경로 `node scripts/verify-fma-lemonade-generation.mjs --edit`: Flux-2-Klein-4B,512x512,4steps,원본 참조 편집239.795초,374268 bytes PNG, generationFallback=false. 원본 검은 머리가 붉은 머리로 바뀐 결과를 실제 이미지로 열어 확인했다.
- 실제 앱 경로 `node scripts/verify-fma-lemonade-generation.mjs --edit --base=http://localhost:5174/api/lemonade/v1`: 이전 서버 작업 종료를 기다린 뒤 실제 편집 성공, 전체167.658초,374268 bytes PNG, generationFallback=false. 증거 `artifacts/fma-generation/edit-result.json`, `edit.png`, `proxy-edit-result.json`, `proxy-edit.png`.
- 실제 브라우저: IAB의 FMA에 합성 검증 이미지를 불러오고 Lemonade AI Jena를 열어 상단 공급자·모델 선택을 확인했다. AI 실행 시 기존 작업 종료 대기·0:00과 실행/모델 비활성 상태를 확인했다.3:26까지92%가 아닌 경과시간을 표시했다. 다른 기존 서버 작업 대기가 이어져 이 검증 탭의 대기 요청만 중지했고, 사용자 중지 문구·0%·공급자/모델/실행 컨트롤 복구를 확인했다. 기존 서버 계산은 중지하지 않았다. 브라우저 이미지 결과·히스토리 완료까지의 전체 왕복은 별도 미검증이다. [UI 증거](../../../artifacts/fma-generation/ui-wait-stop.png).
- AI Studio 실제 인증 편집, 사용자 첨부 인물의 머리색 변경 품질, 영상 결과, 갤러리/문서 전체 왕복은 미검증. 합성 인물 검증 이미지를 외부 클라우드로 전송하지 않았다.

공식 구현 참고: [Lemonade SD 백엔드의 원본 참조 편집 전달](https://github.com/lemonade-sdk/lemonade/blob/main/src/cpp/server/backends/sdcpp/sdcpp_server.cpp). 이번 실행의 실제 성공·시간은 로컬 증거를 기준으로 기록했다.

## 상대 앱 비교와 이식

대상의 `Apps/fmaviewer/js/ai/aiJena.js:startAiJenaProgress`에도 Math.min(92, ...) 가상 진행률이 남아 있음을 읽기 확인했다. 대상은 imageProvider/MDProImageProvider를 쓰는 독립 공급자 구조이므로 원본 파일을 덮어쓰지 않는다. 대상 진행률에 경과시간/단계를 적용하고 대상 Lemonade 요청 어댑터에서 busy 대기·입력 사본 크기 제한·중지 문구를 연결해야 한다. WebDAV `lemonadeSettings.js`가 대상에도 존재한다고 가정하지 않는다. 대상 런타임은 이번에 수정하지 않았다.

## Tauri 반영

대기 ID MDPRO-20261027-FMA-JENA-WAIT. 상대 웹 이식 뒤 FMA JS/CSS/index 및 부모 loader를 대상 frontend와 Tauri/dist에 포함하고 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 빌드·설치앱에서 진행 중표시/4분 이상 대기/원본 참조 편집/중지 후 재실행/헤더줄바꿈을 확인한다. 이번에는 대상 frontend 준비·네이티브 빌드·설치를 실행하지 않았다.

## 상대 앱 재명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-fma-jena-progress-and-edit-wait.md를 읽고 FMA AI Jena의 가상92%표시를 경과시간·실제 처리 단계로 바꿔줘. 대상의 기존 imageProvider/MDProImageProvider를 유지하고 Lemonade 이미지 슬롯 busy 대기·중지 처리·출력크기에 맞춘 원본/마스크/참조 요청 사본 제한을 연결해줘. 저장된 원본은 보존하고 AI Studio를 로컬 처리로 바꾸지 말아줘. 헤더의 모델선택 컨트롤이 본문과 겹치지 않게 해줘. 4분 이상 실제 원본 참조 편집을 완료까지 검증하고 생성 대체와 편집 성공을 구분해줘. 전체 파일 복사 없이 회귀 검사·기술문서·목록·Tauri 대기를 갱신해줘. Tauri 빌드는 실행하지 말아줘.
```

# Lemonade 이미지 원본 해상도·품질 설정 WebDAV 이식

- 변경 ID: MDPRO-20261027-IMAGE-QUALITY
- 작성·최종 확인: 2026-10-27 (Asia/Seoul), 미커밋.
- 원본: `C:/CusorApps/md-viewerVscode/md_viewer/Docs/mdpro-development/changes/2026-10-27-lemonade-image-quality.md` 및 실제 `js/app.js`의 설정 함수 읽기 비교.
- 대상: `C:/CusorApps/Webdav_md/webdav-md`. WebDAV 런타임·회귀·문서 수정. Viewer 런타임·문서 사본 수정, Tauri 빌드·설치·배포·커밋·푸시 미실행.
- 기존 미커밋 작업(이미지 첨부/얼굴 유지/도구·미리보기/FMA/llama.cpp/ENV 스타일 등)을 보존했다. 그 작업을 이번 이식의 신규 성과로 포함하지 않는다.

## 요청과 완료 기준

서버 저해상도 기본값에 의존하지 않고 Jena에서 생성 원본의 크기·단계·CFG·고정 시드를 모델별로 선택한다. 신규 Flux 기본은 1024×1024, 일반 모델은 image_defaults 또는 512px를 따른다. 기존 사용자가 ENV에서 명시 저장한 해상도는 보존하므로 기존 512px 모델은 설정에서 1024px로 직접 변경해야 한다. Klein distilled는 4단계/CFG1 권장이다. 단계 증가가 반드시 품질을 높인다고 안내하거나 프롬프트 스타일을 자동 강제하지 않는다.

## 실제 구현과 호출 순서

### mdpro/js/app.js

- `getLemonadeImageSettings(modelId, overrides)` / `saveLemonadeImageSettings`: Viewer의 숫자 정규화·모델별 키 `ss_ai_chat_lemonade_image_v1:<modelId>`를 WebDAV의 `findCachedLemonadeModel`과 독립 lemonade 공급자에 맞게 연결했다. 폭/높이 256~1536·64단위, steps 1~50, CFG 0~15·0.1단위, seed -1~2147483647. 빈 값/NaN/Infinity는 기본값으로 복원하고 CFG0을 보존한다.
- 기존 공통 `ss_lemonade_image_size/steps/cfg_scale`는 최초 선택 모델에만 이행한다. `ss_lemonade_image_legacy_model_v1`으로 원래 소유 모델을 고정하고, 정규화된 모델 레코드를 저장해 이후 ENV 저장·모델 전환 시 다른 모델에 누출되지 않는다. 기존 공통 키는 SSP 경로 호환성을 위해 유지한다.
- `AIChatBridge`에 두 설정 함수를 노출했다. `generateLemonadeImage`는 시작 시 설정 스냅샷을 얻고 JSON 생성/multipart 편집 모두 size/steps/cfg_scale/seed를 전송한다. 기존 프롬프트·복수 첨부 바이트·중지·오류 경로를 보존하며 작은 크기로 자동 재시도하지 않는다. 성공 결과에 imageSettings를 반환한다.
- 기존 ENV 입력 ID를 보존하고 `syncLemonadeImageSettingsUI`로 모델별 값을 복원한다. 크기 프리셋과 seed 입력을 추가했다. Jena에서 저장한 직접 입력 크기는 ENV select에 해당 옵션을 추가해 표시한다. ENV 저장은 모델별 설정도 저장한다. SSP의 별도 비율/스타일 경로 전체를 Jena 코드로 치환하지 않았다.
- ENV/Jena 두 이미지 모델 Load 경로는 `{model_name, save_options:false}`만 전달한다. 이미지 크기·품질은 생성 요청이 소유하고 서버 CUDA/offload/VRAM recipe 옵션은 덮어쓰지 않는다. 텍스트 모델의 ctx_size/save_options 경로는 유지한다.

### mdpro/AI_App/aiChat/ai-chat.js / ai-chat.css / index.html

- 공급자 설정 아래 별도 접이식 `이미지 크기 · 품질 설정`을 추가했다. 512/768/1024 정사각, 768×1024·1024×768, 576×1024·1024×576 및 직접 폭/높이를 제공한다. 변경 이벤트에서 모델별 자동 저장하고 모델 변경·실행 상태 변경 시 복원/비활성화한다.
- 실제 브라우저에서 Lemonade 모델 change 분기가 조기 return하여 신규 패널을 갱신하지 않는 경로를 발견했다. 해당 분기에서 `updateModelModeUI`를 명시 호출하도록 수정했다.
- 신규 설정에만 2열 grid·전체 폭 preset/seed·320px 세로 스크롤·좁은 입력 최소 폭을 적용했다. 기존 공급자·토큰·전송·헤더 컨트롤을 삭제하지 않았다. 새 패널의 hidden/display:none은 비이미지 공급자에서 신규 설정만 숨긴다.
- 일반 생성 및 크게보기 편집 결과의 assistant message에 imageSettings를 저장한다. 이미지 load에서 naturalWidth/naturalHeight를 읽어 실제 원본 px와 저장된 단계/CFG를 figcaption에 표시하고 768 미만은 더 큰 크기로 새 생성하라는 안내를 표시한다. 성공 원본 카드의 실제 픽셀 표시는 현재 서버 오류로 실물 미검증이다.
- 생성 카드 이미지는 width:auto/max-width:100%/height:auto로 작은 원본을 강제 확대하지 않는다. 저장/문서삽입/복사/기존 크게보기 기능과 원본 데이터는 유지한다.
- 캐시: app.js와 선택적 ai-chat.js에 imageQuality=20261027-2, CSS는 v=20261027-image-quality-2 (동시 미리보기 작업의 최종 자산 버전 보존). 기존 캐시 파라미터는 유지한다. 신규 외부 의존성 없음.

### 검사 도구

- `tests/lemonadeImageQuality.test.mjs`: Flux/SD 기본값, 이전 값 이행·모델 격리, 범위/빈값/CFG0, JSON 및 multipart의 동일 파라미터·원본 바이트·결과 스냅샷, Jena 프리셋/시드/native change·생성 중 잠금을 검사한다.
- `tests/aiImageIdentity.test.mjs`는 새 설정 의존성을 실제 설정 함수와 메모리 저장소로 제공하고 JSON header stub을 보완했다. UI 계약의 캐시 기대값을 갱신했다.
- `scripts/verify-flux9b-edit.mjs`에는 기존 512px 검사 의미를 유지하는 설정 stub을 추가했다.
- `scripts/verify-lemonade-image-quality.mjs`는 현재 로드된 idle 이미지 모델로 실제 WebDAV 전송 함수를 실행해 256/1024 생성 및 성공한 참조 PNG가 있으면 512 편집을 검사한다. 모델을 로드하거나 서버 옵션을 변경하지 않는다. PNG 헤더 크기와 요청·오류·전후 recipe_options를 기록한다.

## 상대 앱 대응과 차이

| Viewer 원본 | WebDAV 대응 | 상태/차이 |
| --- | --- | --- |
| 모델별 이미지 설정 | 동일 함수명 + legacy 소유 모델 이행 | WebDAV 이식, 기존 ENV 공통 키 보존 |
| generateLemonadeChatImage(request) | generateLemonadeImage(connection, model, messages, signal) | 독립 lemonade 공급자와 프록시 URL 구조 보존 |
| Jena 상세 이미지 UI | 기존 ENV 통합 + 별도 Jena 접이식 UI | WebDAV 고유 ID 유지, 시드 추가 |
| imageSettings / 실제 px caption / 확대 방지 | WebDAV 메시지·갤러리·기존 편집 창 | 이식, 성공 카드 실물은 미검증 |
| image model load | ENV/Jena 두 load 경로 | 서버 옵션 비저장 처리 |

전체 파일 덮어쓰기나 상대 런타임 변경은 하지 않았다. Viewer 원본의 성공한 9B 이미지·브라우저 증거를 이번 WebDAV 검증 성공으로 사용하지 않는다.

## 검증과 한계

- `node --check mdpro/js/app.js`, `node --check mdpro/AI_App/aiChat/ai-chat.js`, 두 검증 스크립트 구문 검사 및 `git diff --check` 통과.
- `node --test tests/lemonadeImageQuality.test.mjs tests/aiJenaUiContract.test.mjs tests/aiJenaConnection.test.mjs tests/aiChatImageAttachments.test.mjs tests/aiImageIdentity.test.mjs tests/aiChatImageActions.test.mjs tests/aiChatImagePreview.test.mjs tests/fmaLemonadeGeneration.test.mjs`: **90개 통과**. [검사 로그](evidence/lemonade-image-quality/tests.txt).
- `npm run build` 통과. 500kB 초과 청크 안내 경고 있음. [빌드 로그](evidence/lemonade-image-quality/build.txt).
- 첫 회귀 실행은 기존 테스트 harness에 새 설정 함수와 JSON header stub이 없어 실패했고 보완 후 통과했다. 초기 UI 계약의 캐시 버전 기대값도 새 자산 버전에 맞췄다.
- 실제 Edge `http://127.0.0.1:18768/mdpro/` (Vite preview + 실제 Lemonade 프록시): Flux4B 초기 1024×1024/steps4/CFG1/seed-1 확인. 768 preset·native ArrowUp/Tab으로 seed42 저장, 9B 전환은 1024/seed-1, 4B로 복귀하면 768/seed42, 새로고침 후 Jena를 다시 열어 768/seed42 복원을 확인했다. 설정 영역은 초기 clientWidth=scrollWidth=356, 최종 스타일 적용 후 354로 가로 넘침 없음. 검증 후 4B 설정을 1024×1024/steps4/CFG1/seed-1로 저장했다. [최종 화면](evidence/lemonade-image-quality/settings.png). 모든 화면 크기 검증은 아니다.
- 초기 단순 정적 서버는 /api/lemonade 프록시가 없어 404였고, 최종 브라우저 검증은 프록시를 갖춘 빌드 preview 서버로 진행했다. 8767에서 읽은 Viewer 페이지는 WebDAV 검증 증거에서 제외했다.
- 실제 로컬 Lemonade 2026.42.1, 현재 활성 Flux-2-Klein-4B, 동일 seed42/steps4/CFG1로 256×256과 1024×1024 요청을 전송했다. 둘 다 HTTP500 backend_error `generate_image returned no results`로 실패했다. 첫 비교가 실패하여 같은 스크립트를 보완·재실행했고 총 256 요청 2회, 1024 요청 1회였다. 성공 PNG가 없어 실화질 비교·실제 PNG 크기/편집은 완료하지 못했다. 원인이 VRAM인지 등은 이번 작업에서 확정하지 않았다. [요청·오류·서버 옵션 전후 증거](evidence/lemonade-image-quality/comparison.json).
- 서버 recipe_options 전후 동일 확인. 저해상도 fallback·외부 공급자 전환·서버 프로필 변경은 수행하지 않았다. 다운로드·클립보드·문서삽입·대형 원본 편집과 네이티브 설치 앱은 미검증이다.

## Tauri 반영 계획

대기 ID MDPRO-20261027-IMAGE-QUALITY. Viewer 원본 웹 구현은 원문 기준 존재하며 이번 작업은 WebDAV 적응이다. 대상 Tauri 자산 js/app.js, AI_App/aiChat/ai-chat.js, ai-chat.css, index.html을 해당 앱 원본에서 준비해야 한다. WebDAV mdpro/ 파일 전체를 Viewer에 덮어쓰지 않는다. 프런트엔드 준비·네이티브 빌드·설치 검증·배포는 미실행. 향후 모델별 저장, 크기/seed 요청, 서버 옵션 보존, 실제 PNG 크기·표시·저장·중지를 설치 앱에서 확인한다. 수식/PV/인쇄/PDF/DOCX 코드는 이번 품질 변경으로 수정하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-lemonade-image-quality.md 및 기존 Docs/mdpro-development/changes/2026-10-27-lemonade-image-quality.md를 읽고 차이만 검토해줘. 기존 모델별 크기·seed 기능은 보존하고 모델 변경 직후 설정 표시, 편집 결과 imageSettings 보존, 이미지 load 시 서버 recipe 옵션 비저장을 확인해줘. 기존 ENV 공통 설정이 있다면 원래 모델에만 이행하고 다른 모델로 누출되지 않게 해줘. JSON/multipart 동일 파라미터·원본 바이트와 저장 복원·실제 PNG 크기를 검증하고 문서/목록/Tauri 대기를 갱신해줘. WebDAV에서는 현재 Flux4B가 256/1024 모두 backend_error여서 실화질 검증이 미완료였다. 전체 파일 덮어쓰기·서버 CUDA/offload 설정 변경·Tauri 빌드·배포는 하지 말고 미검증은 구분해줘.
```

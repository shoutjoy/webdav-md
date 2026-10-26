# 2026-10-27 FMA AI Jena 공급자·모델 선택과 이미지 요청 연결 수정

- 변경 ID: MDPRO-20261027-FMA-JENA-CONNECTION
- 원본: `C:/CusorApps/Webdav_md/webdav-md`; 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인일: 2026-10-27 (Asia/Seoul), 미커밋. 기존 작업을 보존한 추가 변경.
- 상태: 원본 구현·53개 자동 검사·웹 빌드 완료. 실제 브라우저 UI·AI Studio 인증 생성 미검증. Lemonade 실제 신규 생성 성공, 실제 참조 편집 180초 타임아웃. 대상 웹 런타임·문서 사본·frontend 준비·네이티브 빌드·설치 앱 검증 미실행.

## 요청과 완료 기준

FMA AI Jena 이미지 편집창 상단에서 Lemonade/AI Studio와 원하는 이미지 모델을 고르게 하고, 모델의 화질 이전에 잘못된 연결·인증·요청 형식을 수정한다. 기존 이미지 수정, 선택영역, 포즈, Try-on, 새 이미지, Veo, 폰트 조절·닫기·히스토리·갤러리 기능을 보존한다.

상단 공급자/이미지 모델/모델 새로고침/연결 상태를 추가했다. 공급자별 선택은 본문 이미지 생성 설정을 변경하지 않는 FMA 전용 `ss_fma_jena_provider`, `ss_fma_jena_model_aistudio`, `ss_fma_jena_model_lemonade`로 저장한다. 최초에는 기존 공용 설정을 따른다. 본문 앱과 같은 규칙으로 기존 Gemini flash/pro image-preview 별칭을 현재 image 모델 ID로 정규화한다. 키가 없더라도 편집창은 열려 공급자를 바꿀 수 있고, 키 누락은 실행 전 오류로 표시한다. 실행 중 공급자와 모델은 잠시 비활성화하며 finally에서 복구한다.

## 확인한 연결 차이와 실제 구현

1. FMA AI Studio 경로는 `AI_UPSCALE_ENDPOINT` (`/v1beta/interactions`)와 고정 `AI_UPSCALE_MODEL`을 공유했다. 이번에 신규 `js/ai/aiJenaModels.js`의 `requestAiJenaStudioImage`로 분리해 선택 모델의 `/v1beta/models/{model}:generateContent`를 호출한다. Google 공식 이미지 생성 문서와 본문 앱의 생성 경로를 확인했다. `contents[].parts`의 inlineData에 원본·마스크·역할별 참조 이미지를 순서대로 싣고 `generationConfig.responseModalities`는 TEXT/IMAGE로 설정한다. API Key는 `x-goog-api-key` 헤더에만 넣는다. 원본 편집 지시·참조 이미지 구성은 기존 `requestAiJenaImage`에 남긴다.
2. FMA 키 조회는 직계 parent 보관함만 보던 것을 `imageUpscale.js:getAiStudioApiKey`에서 기존 `getMdproSettingsHost`를 통해 소유 MDPro 프레임으로 연결했다. fmaGemini/gemini 보관함 키와 getProtectedAiCredential, 레거시 공유 키를 찾는다. 보관함이 잠긴 상태에서 레거시 키로 우회하지 않고 사용 중지 플래그도 유지한다. 새 키를 생성하거나 출력·저장하지 않았다. 이 공통 키 조회 수정은 기존 업스케일 등 FMA 키 소비 경로에도 영향을 준다. 해당 업스케일의 interactions 전송 자체는 이번 범위에서 변경하지 않았다.
3. `aiJenaModels.js:getAiJenaImageConnection/initAiJenaModelControls`: 독립 공급자별 모델 선택, 저장, 목록 갱신. Lemonade `/models?show_all=true`를 기존 로컬 프록시/직접 연결 선택 규칙으로 호출한다. AI Studio는 키 헤더로 models를 페이지 단위 조회하고 이미지 이름 및 generateContent 지원 모델만 보여준다. 알려진 이미지 모델과 저장된 모델은 목록 실패 때도 남긴다. 목록 연결 확인은 실제 생성 성공과 다르다고 UI에 명시한다. 공급자 전환 시 이전 목록 응답이 새 목록을 덮지 않도록 revision을 검사한다.
4. `lemonadeSettings.js:requestFmaLemonadeImage`: FMA 상단 선택 모델을 options.model로 전달한다. 복수 이미지의 multipart 필드를 모두 image[]로 일치시키고 단일 이미지는 image로 보낸다. 새 이미지 모드는 원본이 열려 있어도 images/generations를 호출한다. 일반 수정/포즈에서 특정 편집 비지원/SD 오류가 나면 생성으로 한 번 전환한다. 이때 원본·참조가 반영되지 않아 인물/구도가 바뀔 수 있음을 채팅에 먼저 알린다. 선택영역/Try-on, 인증/한도/네트워크/사용자 중지에는 자동 전환하지 않는다. 두 요청 모두 실패하면 원인 두 개를 표시한다. 원본을 참조하지 않는 전환을 편집 성공으로 표시하지 않는다.
5. `aiJena.js:runAiJena/addAiJenaHistoryResult`: 정상/생성 대체 결과를 구분하고 히스토리에 provider/model/generationFallback/notice를 기록한다. 결과는 기존 미리보기·히스토리·갤러리 경로로 전달한다. Google 오류에는 모델·HTTP 상태·안전 차단/이미지 출력 없는 이유를 표시한다. 공급자 전환은 이미지 요청에 적용하고 Veo는 기존 Google 영상 경로를 유지한다.
6. `index.html`은 모델 컨트롤과 신규 모듈을 aiJena.js 앞에 로드한다. `css/styles.css`의 header/model controls는 좁은 창에서 줄바꿈하며 기존 글자 크기·닫기를 유지한다. `gallery/preview.js`는 키가 없을 때도 AI Jena를 열어 공급자를 고를 수 있게 한다. FMA CSS·관련 스크립트, 내부 이미지 앱 로더와 부모 index의 캐시 버전을 갱신했다. 신규 의존성 없음.

공식 API 근거: [Google Gemini 이미지 생성/편집 generateContent](https://ai.google.dev/gemini-api/docs/generate-content/image-generation). 기존 interactions 경로를 사용한 것이 이번 모든 실패의 유일한 원인이라는 실제 인증 증거는 없으며, 확인된 전송 차이를 고친 것이다.

## 로컬 Lemonade 실행 확인과 프로필

- 최초 health: 2026.42.1, Flux-2-Klein-4B가 ready지만 실제 images/generations는 `generate_image returned no results`로 실패했다. ready를 성공으로 표시하지 않는다.
- `scripts/configure-flux4b-low-vram.ps1`: 기존 9B 전용 스크립트와 별도로 4B에만 CPU offload/인코더·VAE CPU/flash attention/타일링/max-vram 4 프로필을 저장한다. 실행 중 모델이면 거부하고 기존 custom args 덮어쓰기를 거부한다. `.flux4b-profile-backup.local`에 원래 sdcpp_args를 백업한다. 다른 모델·글로벌 설정·모델 파일은 변경하지 않는다.
- 실제 적용한 args: `--offload-to-cpu --clip-on-cpu --vae-on-cpu --diffusion-fa --vae-tiling --max-vram 4`. 최초 health의 512 기본 치수는 서버의 load 후 1024로 보고됨. 검증 요청의 size는 명시적으로 512x512를 보냈다. 복원 스크립트는 custom args만 복원하므로 해상도 기본값 복구까지 검증한 것은 아니다.
- 적용 후 `scripts/verify-fma-lemonade-generation.mjs`로 실제 FMA 요청 함수를 실행해 512x512 PNG 신규 생성 성공: 346263 bytes, 67.752초. 증거 `artifacts/fma-generation/generation.png`, `result.json`.
- 동일 이미지 참조 편집은 `--edit`로 실행했고 180초에 클라이언트 timeout으로 실패했다. 이후 health에서 해당 이미지 모델이 in_use/busy, Gemma 채팅 모델은 ready로 확인됨. 브라우저 취소/타임아웃은 서버 작업 취소를 보장하지 않는다. 실제 편집 성공이나 얼굴·머리색 보존을 주장하지 않는다.
- 저메모리 프로필 적용 후 생성 성공은 확인했지만, 최초 실패의 정확한 VRAM 진단 로그는 이번에 수집하지 않았다. 화면 오류가 모델 성능만의 문제라고 단정하지 않는다.
- 원래 custom args 복원 명령: `./scripts/configure-flux4b-low-vram.ps1 -Mode Restore` (이번에는 실행하지 않음).

## 상대 앱 실제 대응과 이식 순서

| 원본 | 대상 실제 코드 | 차이와 선행 조건 | 상태 |
| --- | --- | --- | --- |
| `mdpro/Apps/fmaviewer/js/ai/aiJena.js`, 신규 `aiJenaModels.js` | `Apps/fmaviewer/js/ai/aiJena.js:requestAiJenaImage` | 대상은 imageProvider 상태와 MDProImageProvider.generate를 사용하는 독립 Lemonade 경로가 있음. Google은 확인 시점 interactions 경로. 같은 함수 전체 덮어쓰기 금지 | 읽기 확인·미수정 |
| `mdpro/Apps/fmaviewer/js/image/lemonadeSettings.js` | 대응 파일 없음 | 대상 로컬 공급자 모듈과 기존 선택 UI를 먼저 조사해 어댑터만 적용 | 미이식 |
| 키 조회·FMA HTML/CSS·로더 | 대상 `Apps/fmaviewer/` 및 부모 브리지 | 소유 프레임, 보관함 잠금/중지, 모델별 선택 저장, asset 포함 경로를 독립 확인 | 미이식 |

대상 현재 선택 UI와 공급자 브리지를 먼저 확인한 뒤 선택 모델을 실제 Google/Lemonade 요청에 전달하고 generateContent·키 소유 프레임 차이를 국소 수정한다. 로컬 4B 서버 프로필은 같은 서버를 쓰면 공유되지만 대상 코드/설치 앱 반영의 증거는 아니다.

## 검증

- `node --test tests/fmaJenaModels.test.mjs tests/fmaLemonadeGeneration.test.mjs tests/aiJenaUiContract.test.mjs tests/fmaDocumentInsert.test.mjs`: 53개 통과, 실패 0.
- 선택 저장/공급자 분리, 모델 목록 필터·인증, 선택한 모델 경로, 원본·마스크·복수 참조 payload, Google 오류·이미지 출력 없음, 소유 보관함/잠금, Lemonade 편집→생성 전환/안내, 복수 multipart 필드, 중지/네트워크/한도 오류 시 재시도 금지, 기존 UI·FMA 문서삽입 검사.
- 수정한 FMA JS 및 본문 ai-chat.js의 node --check, git diff --check: 통과.
- npm run build: 성공, 기존 500kB chunk 경고 존재.
- 실제 Google 인증 모델 호출은 미실행. 실제 브라우저 UI 조작은 CUA 초기 surface 조회가 timeout되어 미검증. 모델 선택 화면의 렌더링/사용자 키의 유효성/갤러리 전체 왕복은 자동 검사로 대신 확정하지 않는다.

## Tauri 영향

빌드 대기 ID MDPRO-20261027-FMA-JENA-CONNECTION. 대상 웹 이식 후 신규 모듈, FMA HTML/CSS/스크립트와 부모 로더가 frontend 및 Tauri/dist에 포함돼야 한다. build 요청 시 대상 Docs/mdpro-development/TAURI_BUILD.md에 따라 웹 검증·frontend 준비·네이티브 빌드·설치 앱 검증을 나눠 기록한다. 이번에는 상대 앱 변경과 Tauri 빌드를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-fma-jena-provider-and-transport.md를 읽고 FMA AI Jena 이미지 편집의 공급자·모델 선택과 전송 연결을 점검·수정해줘. 대상의 기존 imageProvider/MDProImageProvider 선택·브리지를 유지하고 실제 선택 모델로 Google generateContent(원본·마스크·참조 inlineData 및 이미지 출력) 또는 Lemonade 이미지 API를 호출해줘. 소유 MDPro 보관함 키 조회와 잠금/사용 중지를 보존하고 모델 목록·오류 상태를 명확히 표시해줘. 키가 없어도 공급자 변경 UI에는 접근 가능해야 해. 생성 대체는 원본을 반영하지 않는다는 안내 및 선택영역/Try-on 예외를 유지해줘. 원본 전체 파일을 복사하지 말고 해당 회귀 검사, 실제 연결, 문서·목록·Tauri 대기를 갱신해줘. 로컬 4B 생성 성공과 참조 편집 timeout을 구분하고 Google 실제 인증 검증도 별도로 보고해줘. Tauri 빌드는 실행하지 말아줘.
```


## 후속 검증: 92% 표시·장시간 편집

2026-10-27 후속 [진행/대기 수정](2026-10-27-fma-jena-progress-and-edit-wait.md)에서 같은 FMA 참조 편집을600초 범위로 실행하여 직접 경로239.795초 및 앱 프록시 경로167.658초 성공을 확인했다. 둘 다 generationFallback=false,374268bytes PNG이며 검은 머리→붉은 머리 편집 결과를 열어 확인했다. 앞선180초 timeout 기록은 그대로 보존하며, 이 후속 성공으로 모든 사용자 사진/Google 인증 검증까지 성공했다고 확대하지 않는다.

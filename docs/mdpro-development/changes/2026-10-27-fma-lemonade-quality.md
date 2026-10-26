# FMA Lemonade 생성·편집과 모델별 출력 크기

- 변경 ID: MDPRO-20261027-FMA-LEMONADE-QUALITY
- 원본: `C:\CusorApps\Webdav_md\webdav-md`, 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 날짜: 2026-10-27, 미커밋. 기존 AI Studio 할당량 수정 등 작업 트리 변경을 유지하고 추가 수정했다.
- 상태: WebDAV 구현 / 대상 미이식 / Tauri 빌드·설치 검증 미실행.

## 요청과 이전 문제

FMA에서 Lemonade를 AI Jena처럼 사용하고 해상도 크기 선택을 실제 생성·편집에 반영한다.
AI Jena는 모델별 `ss_ai_chat_lemonade_image_v1:<model>`을 사용하지만 FMA는 예전 공통 `ss_lemonade_image_size`를 읽고 Load에 512×512/4steps/CFG1을 고정했다. FMA에서 가로·세로 및 품질을 조절하는 UI도 없었다.

## 구현과 보존 범위

1. `mdpro/Apps/fmaviewer/js/image/lemonadeQuality.js` 신규: `getFmaLemonadeImageSettings`/`saveFmaLemonadeImageSettings`는 `getMdproSettingsHost().AIChatBridge`의 AI Jena 설정 API를 우선 사용한다. 독립 FMA에는 같은 저장 키·정규화·기존 설정 소유 모델 이관 규칙을 제공한다. 독립 FMA는 부모의 모델 캐시를 사용할 수 없어 비Flux 모델의 서버 image_defaults 대신 512/4/1을 기본으로 삼는다. 부모 브리지 사용 시 서버 기본값을 그대로 따른다.
2. `index.html`의 FMA 설정과 이미지 편집 왼쪽 도구에 `data-fma-lemonade-quality` 패널 추가. 256/512/768/1024 정사각형, 가로·세로 프리셋, 직접 가로·세로 입력과 교환, Steps/CFG/Seed를 제공한다. 256~1536px를 64px 단위로 보정한다. Flux 기본1024×1024, Steps4, CFG1, Seed-1이며 모델별 이전 저장값이 우선한다. 저장은 자동이며 패널에 명시한다. 편집 창에서는 Lemonade 선택 시에만 나타난다.
3. File 메뉴에 `btnNewLemonadeImage`(Lemonade 새 이미지 생성)를 추가하여 원본 파일이 없어도 `openAiJena(-1, 'lemonade')`로 생성한다. 기존 파일 메뉴·편집 모드·참고 이미지·히스토리·갤러리 기능과 Ctrl+Enter 실행을 보존한다.
4. `lemonadeSettings.js:requestFmaLemonadeImage`: 실행 시 모델 설정을 확정하여 JSON `/images/generations`와 multipart `/images/edits` 모두 `size`, `steps`, `cfg_scale`, `seed`에 전달한다. CFG0을 보존한다. 선택 모델 Load에도 같은 크기/품질을 사용한다. 대기 메시지에 모델·크기·steps를 표시한다. idle 대기·취소·오류 보고·편집 실패 시 자동 새 생성 금지는 유지한다.
5. `aiJena.js:requestAiJenaImage`에서 확정한 설정을 `prepareAiJenaLocalImages`와 transport에 함께 전달하여 참조 축소 크기와 출력 크기가 일치한다. 저장된 원본 바이트는 유지한다. Lemonade 새 생성 모드에서는 현재 원본을 읽거나 편집 지시로 설명하지 않는다. Google 경로는 기존 원본 처리 유지.
6. `aiJenaModels.js`에서 공급자/모델 변경·열기 시 패널을 동기화한다. 실행 중 크기·품질·교환을 잠그고 완료/오류/취소 후 복원한다.
7. `addAiJenaHistoryResult`가 완료 직후 `selectAiJenaHistoryEntry`를 호출할 때 processing 잠금으로 즉시 반환되던 문제도 수정했다. 내부 완료 결과 선택에만 `completedResult=true`를 전달하고 수동 히스토리 선택은 실행 중 계속 차단한다. 신규 생성 결과가 다음 편집 원본으로 자동 선택된다.
8. `styles.css`: 패널·입력 wrap 추가. 기존 컨트롤 삭제 없음. 신규 hidden 규칙은 Lemonade 전용 패널만 대상으로 한다. 기존 도구 패널의 스크롤로 모든 기능에 접근 가능하다.
9. `index.html` CSS와 4개 JS 캐시 토큰 `20261027-fma-quality-3`. 신규 의존성 없음. `scripts/verify-fma-lemonade-generation.mjs`도 새 설정 모듈을 초기화하도록 갱신하되 기존512 검증 조건 유지.

## 상대 앱 대응과 이식 순서

| WebDAV | Viewer 실제 확인 | 차이/이식 상태 |
| --- | --- | --- |
| `mdpro/js/app.js:getLemonadeImageSettings` + FMA quality adapter | Viewer FMA `Apps/fmaviewer/js/ai/aiJena.js:requestAiJenaImage` | Viewer는 `MDProImageProvider.generate`와 원본 비율을 사용. 이번 adapter를 그대로 덮어쓰면 안 됨. 미이식 |
| `requestFmaLemonadeImage`, 선택 모델·설정 snapshot | Viewer `requestAiJenaImage(prompt, signal, options)` | Viewer의 `options.identity`, `cameraOnly`와 기존 local ready 검사를 유지하고 provider에 크기 전달을 연결해야 함 |
| File 메뉴·품질 UI | Viewer FMA 독립 HTML/글로벌 dom 구조 | 대상 초기화와 공급자 저장 소유자를 먼저 확인. 전체 파일 복사 금지 |

선행 문서: `2026-10-27-lemonade-image-quality.md`, `2026-10-27-fma-jena-provider-and-transport.md`, `2026-10-27-fma-person-preservation.md`.
이번 작업에서는 대상 소스 읽기 비교만 했고 대상 런타임·문서 사본은 수정하지 않았다. 문서 존재는 이식/빌드 완료가 아니다.

## 검증

- 회귀: 모델별 저장, 부모 브리지 위임, legacy 소유 모델 한정 이관, 크기 범위·64px 보정, CFG0/seed, JSON과 multipart 실제 payload, 새 생성에서 원본 제외, 참조 보존·실패 시 자동 생성 금지, 실행 대기·취소, AI Jena UI 계약.
- `node --test tests/fmaLemonadeQuality.test.mjs tests/fmaLemonadeGeneration.test.mjs tests/fmaJenaModels.test.mjs tests/fmaJenaProgress.test.mjs tests/fmaJenaPersonPreservation.test.mjs tests/aiJenaUiContract.test.mjs tests/lemonadeImageQuality.test.mjs`: 81개 통과, 실패0. 추가 `tests/fmaMdproApiKey.test.mjs tests/fmaDocumentInsert.test.mjs` 9개 통과. 총90개.
- `node --check` 변경 JS 및 `mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`, `npm run build`: 통과. 기존500kB 번들 크기 안내 있음.
- Edge `http://localhost:5174/mdpro/Apps/fmaviewer/index.html`: 설정 패널 576×1024 선택 → 교환1024×576, 키보드896px 직접 입력, 모델 전환 후 유지, 새 탭에서 복원 확인. 자동화 fill만으로 change가 발생하지 않아 실제 키보드 입력+blur로 검증했다.
- `?quality=2`: 파일 없는 상태에서 File → Lemonade 새 이미지 생성 진입, 공급자 Lemonade·모드 새 생성·품질 패널,512 선택 후 실행 시 입력 잠금과 실제 요청 대기 문구를 확인했다.
- 실제 모델 결과 및 최종 검사 결과는 아래 최종 검증에 기록한다. UI 검사와 실제 생성 품질은 구분한다. 갤러리 저장·다운로드·문서 삽입 전체 흐름과 고해상도 실제 생성, 배포는 미검증.

## Tauri 계획

빌드 대기 ID `MDPRO-20261027-FMA-LEMONADE-QUALITY`. Viewer의 기존 provider·identity 옵션을 보존하여 먼저 웹 이식한다. FMA HTML/CSS/품질 모듈/provider JS를 Tauri 프런트엔드 복사 단계에 포함하고 `Tauri/dist`에서 캐시·실제 자산을 확인한 뒤 빌드·설치 앱 생성/편집/크기 복원을 검증한다. 이번 요청은 WebDAV 수정으로 네이티브 빌드는 실행하지 않았다.

## 다른 앱 재명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와
C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-27-fma-lemonade-quality.md를 읽고
FMA Lemonade 새 이미지 생성 진입과 모델별 해상도·품질 UI를 대상 구조에 맞춰 이식해줘.
MDProImageProvider.generate, identity/cameraOnly, 기존 저장·히스토리·갤러리를 보존하고
가로·세로 프리셋/직접입력/교환·Steps·CFG0·Seed를 실제 생성·편집 요청에 연결해줘.
AI Jena의 모델별 설정 저장을 공유하고 실행 중 잠금, 모델 전환과 재열기 복원,
편집 실패 시 참조 없는 자동 생성 금지를 검증해줘. 전체 파일을 덮어쓰지 말고
문서·목록·Tauri 대기 상태를 갱신해줘. 이번 명령에는 네이티브 빌드·설치는 포함하지 않아.
```

## 최종 검증 기록

- Edge 실제 Lemonade `Flux-2-Klein-4B`: 512×512 새 생성 성공, DOM naturalWidth/naturalHeight512 확인.
- 최종 캐시 `20261027-fma-quality-3`, `?quality=3`에서 File→Lemonade 새 생성, 가로256/세로512 직접 입력, Steps4/CFG1/Seed-1로 빨간 머그컵 생성 성공. 히스토리1 자동선택 및 자연크기256×512 확인.
- 이미지 수정 모드에서 “Change the ceramic mug color from red to blue. Keep the mug shape, white table and composition unchanged.” 실행. 대기 문구가 ‘원본 참조 편집’임을 확인했고, 실제 파란 머그컵으로 편집 성공. 히스토리2 자동선택과 자연크기256×512 확인. 중간값이 아닌 실제 완료100% 표시와 품질 입력 잠금 해제 확인.
- 증거: `artifacts/fma-lemonade-quality/generated-and-edited.png` (생성1 빨간 컵, 생성2 파란 컵, 직접 입력256×512와 완료 상태). 검증 후 설정을 원래 기본1024×1024로 복원했다.
- 최종 회귀90개, 구문/공백 검사 통과. 프로덕션 빌드 통과. Load 요청의 실제 재실행, 1024 이상 실제 생성, 갤러리 저장/다운로드/문서 삽입 전체 흐름 및 설치 앱 검증은 미실행이다.
- 개발 중 기존 localhost5174 서버의 HMR/이탈 확인창 때문에 중간 탭이 새로고침된 적이 있어 최종 캐시3의 별도 탭에서 생성→편집을 다시 검증했다. sandbox 내부5173 서버는 브라우저에서 접근되지 않았고13305 직접 소켓도 제한되어, 최종 증거는 기존 localhost5174 앱 프록시를 실제 사용하는 브라우저 흐름으로 얻었다.

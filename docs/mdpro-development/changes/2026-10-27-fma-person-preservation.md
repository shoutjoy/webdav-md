# 2026-10-27 FMA 반복 이미지 편집 인물 보존

- ID: MDPRO-20261027-FMA-PERSON
- 원본: `C:/CusorApps/Webdav_md/webdav-md`, 대상: `C:/CusorApps/md-viewerVscode/md_viewer`
- 작성·확인: 2026-10-27 (Asia/Seoul), 미커밋. 작업 시작 전 여러 미커밋 변경이 있었으며 그대로 보존했다.
- 상태: WebDAV 구현·자동 검사 67개·웹 빌드 완료. Viewer 대응 소스 읽기 비교, 미이식. 실제 반복 생성 화질·브라우저 UI·Tauri 빌드·설치 앱 검증 미실행.

## 요청과 원인 구분

사용자 화면은 원본→생성1→생성2→생성6에서 얼굴·피부가 점차 흐려지고 옷 무늬는 남는 현상이다. 화면만으로 서버 원인이나 특정 프롬프트 탓을 확정할 수 없다.

확인한 코드 경로:

1. `selectAiJenaHistoryEntry`가 선택한 결과를 `sourceItem`으로 바꾼다. 기존 `requestAiJenaImage`는 현재 이미지와 수동 참조만 전송했다. 반복 편집에서 최초 원본을 다시 보지 않으므로 모델의 얼굴·피부 변화가 누적될 수 있는 구조였다.
2. `requestFmaLemonadeImage`는 edit/pose의 일부 서버 오류(404/405/415/422 또는 특정 5xx)에서 모든 참조를 제외한 `/images/generations`를 자동 호출했다. 안내 메시지는 있지만 원본 인물과 무관한 결과가 성공으로 저장될 수 있었다. 사용자 사례에서 실제 이 전환이 일어났는지는 요청 기록이 없어 미확인이다.
3. 일반 편집 프롬프트에는 identity 보존은 있었지만 피부 대비·인물 가시성 보존 지시는 없었다. 렌더링 경로에서 반복 생성 횟수에 따라 alpha를 감소시키는 코드는 이번 조사에서 확인하지 못했다. PNG alpha 자체나 모델의 시각적 열화는 원본 결과 파일 없이 확정하지 않았다.

## 실제 구현

`mdpro/Apps/fmaviewer/js/ai/aiJena.js`:

- `buildAiJenaPrompt`: 자연스러운 피부 대비·얼굴 디테일·가시성을 유지하고 명시적 요청 없이 인물을 흐리게 하지 않도록 지시한다. 사용자 요청을 우선한다.
- `requestAiJenaImage`: 첫 이미지를 `IMAGE 1: CURRENT EDIT SOURCE`, 선택 마스크를 `IMAGE 2: SELECTION MASK`로 명시한다. 얼굴/옷/배경/포즈 참조에도 실제 이미지 순번을 붙여, 텍스트를 한 문자열로 합치는 Lemonade 전송에서도 역할을 구분한다.
- 로컬 Lemonade의 반복 편집이며 현재 이미지와 원본이 다르고 명시적 얼굴 참조가 없을 때 `history.find(entry => entry.original && entry.mediaType !== "video" && entry.src)`를 추가 외형 참조로 사용한다. 원본 자세·머리·옷·배경을 복사하지 않고 현재 편집 결과와 사용자 요청을 우선하도록 지시한다. 기존 생성 결과의 편집 내용을 버리고 원본으로 되돌리는 방식이 아니다.
- 원본 추가는 `http:` + `localhost`/`127.0.0.1`/`[::1]` 목적지로 제한한다. 상대 프록시 주소는 로컬 앱 origin 기준으로 해석한다. `src/lemonadeProxy.js:normalizeLoopbackBaseUrl`도 프록시 upstream을 http loopback으로 제한함을 확인했다. AI Studio와 원격 Lemonade에는 원본을 자동 추가하지 않는다.
- 최초 원본 자체를 편집하거나 신규 생성하거나 원본 히스토리가 없거나 명시적 얼굴 참조가 있으면 추가하지 않는다. 원본이 지워졌을 때 생성 결과를 임의로 원본으로 취급하지 않는다. 원본·히스토리 바이트를 수정하지 않으며 요청 사본만 기존 `prepareAiJenaLocalImages`로 축소한다.

`mdpro/Apps/fmaviewer/js/image/lemonadeSettings.js:requestFmaLemonadeImage`:

- 편집 실패 후 참조 없는 자동 재생성을 제거하고 원래 HTTP 오류와 재편집 안내를 표시한다. 사용자가 기존 ‘새 이미지 생성’을 선택하면 기존처럼 생성 가능하다. 중지·인증·네트워크 오류, 선택영역/Try-on 오류 전달은 유지한다.
- `index.html`의 두 스크립트 캐시를 `20261027-person-preserve-1`로 갱신했다. 신규 의존성·설정 저장 키·버튼 삭제 없음.

보안 검토: 최초의 모든 공급자 공통 원본 추가 패치는 외부에 추가 이미지가 전송될 수 있다는 자동 승인 검토 사유로 거절됐다. 해당 패치는 적용되지 않았다. 로컬 프록시의 loopback 제한을 확인한 뒤 위의 로컬 전용 방식으로 수정해 승인·적용됐다. 외부 전송 확대는 이번 구현에 포함하지 않는다.

## 상대 앱 차이와 이식 순서

| WebDAV | Viewer 실제 확인 | 적용 상태 |
| --- | --- | --- |
| `mdpro/Apps/fmaviewer/js/ai/aiJena.js:requestAiJenaImage` | `Apps/fmaviewer/js/ai/aiJena.js:requestAiJenaImage(prompt, signal, options = {})`는 독립 `imageProvider`, `MDProImageProvider.generate`, `options.identity` 및 `MDProFaceIdentity.instruction`을 사용 | 미이식 |
| 위 함수의 원본 외형 참조 | Viewer에는 `options.identity`로 ORIGINAL FACE IDENTITY를 추가하는 별도 로직이 이미 있다. cameraOnly의 pose 참조 제외 규칙도 있다 | 기존 참조와 중복되지 않게 별도 설계 필요 |
| `lemonadeSettings.js`의 실패 처리 | Viewer는 위 함수에서 공통 `MDProImageProvider.generate`로 호출하므로 같은 transport라고 가정하면 안 됨 | 대상 공급자 구현 추가 확인 필요 |

Viewer 전체 파일을 WebDAV 파일로 덮어쓰지 않는다. 기존 identity/profile, cameraOnly, 공급자·스토리지 정책을 보존하고 실제 요청에 최초 원본 외형이 유지되는지 먼저 확인한다. 외부 전송을 자동 확대하지 않는다.

## 검증

- `node --test tests/fmaJenaPersonPreservation.test.mjs tests/fmaLemonadeGeneration.test.mjs tests/fmaJenaModels.test.mjs tests/fmaJenaProgress.test.mjs tests/aiJenaUiContract.test.mjs`: **67/67 통과**.
- 새 회귀 검사: 6회 연속 편집에서 현재 이미지는 바뀌고 원본 참조는 고정; 마스크2/옷3/원본4 순번; 얼굴 참조 우선; 원격 공급자/신규 생성/원본 없음/원본 자체 편집의 추가 제외.
- transport 검사: sd-server 실패와 405 pose 실패에서 POST 1회로 종료하고 generations를 호출하지 않음; 성공 편집·중지·인증·네트워크·마스크/Try-on 보존.
- `node --check` 두 수정 JS와 `mdpro/AI_App/aiChat/ai-chat.js`, `git diff --check`: 통과.
- `npm run build`: 성공. Vite 500kB 초과 chunk 경고 있음.
- 실제 `http://localhost:13305/api/v1/health` 연결 시도: `fetch failed`. 서버를 임의로 시작하거나 모델/서버 설정을 바꾸지 않았다. 사용자 원본을 이용한 실생성 및 실제 6회 편집 화질은 **미검증**이다. 자동 요청 검사 통과를 얼굴 품질 개선의 실증으로 취급하지 않는다.

실제 재검증은 서버 연결 후 깨끗한 원본 또는 덜 손상된 히스토리에서 시작해 머리색 변경→포즈 변경→연속 포즈 변경을 하고, 매 요청에서 현재 이미지·최초 원본의 역할 및 실제 저장 파일의 얼굴 대비를 확인한다. 이미 흐려진 결과는 자동으로 복구되지 않는다.

## Tauri

빌드 대기 ID: MDPRO-20261027-FMA-PERSON. Viewer 웹 이식·검증 후 해당 앱의 `Apps/fmaviewer/js/ai/aiJena.js`, 공급자 모듈, 캐시 갱신을 포함해야 한다. `Docs/mdpro-development/TAURI_BUILD.md`에 따라 빌드·dist 포함·설치 앱 반복 편집을 검증한다. 이번에는 상대 앱 수정·네이티브 빌드·설치·배포를 실행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:/CusorApps/md-viewerVscode/md_viewer에서 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-10-27-fma-person-preservation.md를 읽고 FMA AI Jena 반복 편집 인물 보존을 이식해줘. 먼저 options.identity/MDProFaceIdentity, cameraOnly, MDProImageProvider의 실제 요청을 확인하고 기존 얼굴 참조와 중복시키지 마. 현재 편집 이미지와 원본 외형 참조의 역할을 명확히 하며 원본 추가 전송은 확인된 로컬 loopback Lemonade에만 적용해줘. 편집 실패를 참조 없는 새 생성으로 자동 대체하지 마. 원본/갤러리/히스토리와 기존 UI를 보존하고 마스크·얼굴/옷/배경/포즈 순번, 6회 연속 편집 요청, 실패 시 POST 1회, 중지/인증/외부 전송 제외를 검증해줘. 실제 서버로 반복 편집 화질도 확인하고 불가능하면 미검증으로 남겨줘. 문서·목록·Tauri 대기를 갱신하고 전체 파일 덮어쓰기·Tauri 빌드·설치·커밋·배포는 실행하지 마.
```

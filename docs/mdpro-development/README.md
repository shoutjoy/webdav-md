# MDpro 개발 기록과 양방향 이식 절차

규칙 ID: `MDPRO-DEVELOPMENT-HANDOFF-01` / 작성일: 2026-10-24

## 적용 범위

WebDAV MDpro와 MDproViewer의 기능 개발, 버그 수정, 리팩터링, 이식 작업마다 이 절차를 적용한다. 코드 작업과 함께 **다른 앱에 다시 명령해 구현할 수 있는 기술문서**를 남긴다. 순수 문서·규칙 수정은 별도 변경 문서를 재귀적으로 만들지 않아도 된다. 사용자의 현재 명령이 우선한다.

| 항목 | WebDAV | MDproViewer |
| --- | --- | --- |
| MDPRO-20261112-WORKSPACE-UI | [Macro Dock·Viewer형 Jena Tidy·표 메뉴 앵커](changes/2026-11-12-macro-dock-tidy-workspace-table-anchor.md) | WebDAV 구현·Chrome 3화면·매크로/저장/Worker/모의 AI·빌드 통과 | Viewer UI·브리지 비교, 대상 미수정 | Viewer 빌드·설치 미실행 |
| MDPRO-20261112-IMAGE-INSERT-DOCK | [이미지 넣기 분할 Dock](changes/2026-11-12-image-insert-dock.md) | WebDAV 구현·Chrome 1440/800/390·25개 컨트롤·웹 빌드 통과 | Viewer 우측 정렬 소스 비교·신규 분할 미적용 | Viewer 빌드·설치 미실행 |
| 작업공간 | `C:\CusorApps\Webdav_md` | `C:\CusorApps\md-viewerVscode\md_viewer` |
| 실제 앱 저장소 | `webdav-md/` | 작업공간 루트 |
| 앱 소스 | `mdpro/` | 루트의 `js/`, `css/`, `AI_App/`, `index.html` 등 |
| 이 문서 폴더 | `webdav-md/docs/mdpro-development/` | `Docs/mdpro-development/` |
| 데스크톱 빌드 | 대상 아님 | `Tauri/`의 실제 스크립트와 설정 확인 |

동일 기능이라도 함수, 초기화 순서, 코드 보호 위치, 브리지, 저장소, 빌드 방식이 다르다. 경로에서 `mdpro/`만 삭제하거나 전체 파일을 덮어쓰는 방식으로 이식하지 않는다.

## 개발 중과 완료 전 필수 작업

1. 해당 저장소의 `AGENTS.md`, 기존 변경 목록, 관련 수식·인쇄 계약을 읽는다. 작업 전 변경 파일을 확인해 기존 작업과 이번 수정을 구분한다.
2. 원본 보존, UI 위치·기본값·저장 동작, 영향받는 보기/PV/miniPV/AI/내보내기 경로를 기록한다.
3. 구현하면서 바뀐 함수와 호출 순서, 선행 조건, 주요 diff 또는 정확한 코드 발췌를 기록한다. 소스 커밋이 없으면 미커밋이라고 적고 경로·함수명·작성일로 식별한다. 줄 번호만으로 구현을 설명하지 않는다.
4. 상대 저장소를 읽을 수 있으면 실제 대응 코드를 비교한다. 읽지 못했으면 `대상 확인 필요`라고 기록한다. 기능 이름이 같다는 이유로 이미 반영됐다고 판정하지 않는다.
5. [변경 문서 양식](CHANGE_TEMPLATE.md)으로 `changes/YYYY-MM-DD-기능명.md`를 작성하고 아래 목록을 갱신한다. 재명령 프롬프트에는 대상 경로, 읽을 문서, 변경 범위, 선행 작업, 완료 기준을 포함한다.
6. MDproViewer의 Tauri 영향은 [빌드 대기 목록](TAURI_BUILD_QUEUE.md)에 연결한다. 웹 이식, 웹 검증, 프런트엔드 준비, 네이티브 빌드, 설치 앱 검증을 각각 기록한다.
7. 원본 저장소의 문서를 우선 작성한다. 상대 저장소도 수정하도록 요청받았으면 문서 사본과 상대 목록을 갱신하되, 상대 저장소의 별도 기록은 덮어쓰지 않는다. 요청받지 않은 상대 런타임 수정·빌드·배포를 자동 실행하지 않는다.
8. 최종 응답에 문서 링크, 구현/문서화/상대 적용/빌드 상태를 구분하고 복사해 실행할 다음 명령을 제시한다.

문서의 존재는 이식 완료가 아니다. 자동 검사 통과는 실제 UI·Word·설치 앱·OS 인쇄 검증과 구분한다. 실패한 검사, 미실행 검사, 미검증 항목을 누락하지 않는다. `Docs/`가 Git에서 무시되면 새 문서의 추적 여부도 확인하고, 필요한 경우 해당 문서 경로만 ignore 예외에 추가한다. 커밋·푸시는 별도 요청을 따른다.

## 변경 목록

- MDPRO-20261113-MERMAID-COMPACT-PREVIEW: [Mermaid Ref 저장기록 탭·프롬프트 실행 한 행·Dock·Crop](changes/2026-11-13-mermaid-ref-compact-preview.md) — WebDAV 구현·45관련검사/빌드 통과, 브라우저 소켓 권한 오류로 UI 미검증. Viewer 이식/Tauri/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-TIDY-DOCK-RESPONSIVE: [TIDY Dock 반응형 1열](changes/2026-11-13-tidy-dock-responsive.md) — WebDAV 구현/빌드 통과. 브라우저 검사는 playwright-core 부재로 실행 실패, 실제 UI 미검증. Viewer 웹 이식/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-TABLE-SIZE-COMPACT: [표 크기·편집 기본 접기·한 줄 격자](changes/2026-11-13-table-size-compact.md) — WebDAV 구현·6검사/빌드 통과, 실제 UI 미검증. Viewer 웹 이식·frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-MATH-PICKER: [Jena Math 연결·선택 상자 대비](changes/2026-11-13-jena-math-picker.md) — iframe 자체 AI 경로·Lemonade16개·UI 대비·55검사/빌드 통과. 실제 OCR 생성·Viewer 이식/Tauri/설치 미검증.

- MDPRO-20261113-TIDY-CONNECTION: [Jena Tidy·JS 연결 상태 보존](changes/2026-11-13-tidy-connection.md) — 상태 badge 보존·초기/모델 변경 확인·34검사/빌드 통과, 실제 UI/공급자 미검증·Viewer 미이식.

- MDPRO-20261113-FIGURE-CAPTION-FOLD: [그림 캡션 기본 접기·모바일 이미지 압축](changes/2026-11-13-figure-caption-fold.md) — Chrome390 접기/펼치기·6검사/빌드 통과, Viewer 미이식.

- MDPRO-20261113-MOBILE-EDITOR-MENUS: [모바일 편집 메뉴·우측 세로 Dock](changes/2026-11-13-mobile-editor-menus.md) — WebDAV 구현·표 10열/숫자입력/모바일 기본 Dock·크기/편집 접기·Mermaid Ref 압축/160px/기본 Dock·샘플/전체화면 후속 수정·Chrome 390/767/1280·35개 검사/빌드 통과, 실기기/Viewer 미검증.

- MDPRO-20261113-ME-SCOPED-CHAT: [Mermaid Ref 상단 내부 코드·대화 분할](changes/2026-11-13-me-scoped-chat.md) — 62검사·빌드·Chrome 모의 오류/중지·실제 FLM 수정/SVG·코드/미리보기 탭·390px·테마/줌/DN PNG 검증 통과, Viewer 미이식.

- MDPRO-20261113-NPU-TASK-ROUTE: [FLM NPU 실행 경로 분리](changes/2026-11-13-npu-task-route.md) — 62검사·빌드·직접 FLM 추론 OK, 실제 Mermaid UI 미검증·Viewer 미이식.

- MDPRO-20261113-MERMAID-REF-FOLD: [Mermaid Ref 코드 수정 기본 접기](changes/2026-11-13-mermaid-ref-revision-fold.md) — WebDAV 구현·빌드 통과, 실제 UI 미검증·Viewer 미이식.

- MDPRO-20261113-PROVIDER-ISOLATION: [공급자 분리·Lemonade 성능 표시](changes/2026-11-13-provider-isolation.md) — 자동 전환 제거·중복 조회 제거·실측 통계·검사/빌드 통과, 새 live 측정 네트워크 실패·Viewer 미이식.

- MDPRO-20261113-CONTINUATION-START: [이어쓰기·Auto 복구/응답 시작 최적화](changes/2026-11-13-continuation-start.md) — 단일 문서 세션·single-turn 적응·native 클릭·47검사/빌드·첫 본문714ms 실측. Viewer 미이식.

- MDPRO-20261113-LOCAL-MODEL-LOAD: [Viewer 로컬 모델 로딩 이식](changes/2026-11-13-local-model-loading-port.md) — WebDAV jobs/health·공통 버튼·제한 중계·실제 LM/Ollama 로드/생성·Lemonade 적재·검사/빌드 통과. 참고 Viewer 실제 경로 C:\CusorApps\MDPRO\MDproViewer·원본 미수정.

- MDPRO-20261113-LEMONADE-EMPTY: [Lemonade 빈 응답 복구](changes/2026-11-13-lemonade-empty-response.md) — JSON/SSE 분기·빈 결과 1회 복구·38검사/Chrome 모의/로컬 실모델/빌드 통과, 사용자 장문 동일 재현·Viewer 미확인.

- MDPRO-20261113-RESUME-ANSWER: [중단 답변 이어쓰기](changes/2026-11-13-resume-answer.md) — WebDAV 수동 버튼·중단 본문 보존·Chrome 모의 공급자·32개 검사/빌드 통과, 실제 공급자/Viewer 미검증.

- MDPRO-20261113-STUDIO-NOTICE: [AI Studio 안내 문구 제거](changes/2026-11-13-studio-model-notice.md) — 원본 구현·빈 안내 영역 접기/캐시2차 갱신·29개 계약·빌드 통과, 실제 화면/Viewer 미검증.

- MDPRO-20261113-JENA-DOCK-POPOVER: [Jena Dock popover 분리](changes/2026-11-13-jena-dock-popover.md) — WebDAV 방어 수정·Chrome iframe 7배치·29개 계약 통과, 사용자 공백 재현/해결 미확인·Viewer 미이식.

- MDPRO-20261113-HOSTED-IMAGE-REFERRER: [imgBB 보기 로딩 정책](changes/2026-11-13-hosted-image-referrer.md) — WebDAV 구현·Chrome 9항목·빌드 통과, 실제 사용자 보기/PV 미검증·Viewer 대상 없음/미이식.


| ID | 기술문서 | 원본 구현 | 상대 앱 적용 | Tauri |
| --- | --- | --- | --- | --- |
| MDPRO-20261112-TABLE-DOCK-MERGE | [표 메뉴 상단·Dock·행/열 병합](changes/2026-11-12-table-menu-dock-merge.md) | WebDAV 구현·43개 검사·Chrome desktop/mobile·빌드 통과 | Viewer 실제 layout/병합 비교·미수정 | Viewer 자산 미수정·이번 빌드 불필요 |
| MDPRO-20261112-TIDY-MENU-DOCK | [TIDY 메뉴 우측 도킹](changes/2026-11-12-tidy-menu-right-dock.md) | WebDAV 구현·Chrome 3폭/양 테마·기존 TIDY 5검사·웹 빌드 통과 | Viewer 기존 메뉴 Dock 소스 비교·WebDAV 적응·상대 미수정 | Viewer frontend/native/설치 미실행 |
| MDPRO-20261112-JENA-SERIES-RUNTIME | [Jena 군 모델·연결·독립 실행·UI 안정화](changes/2026-11-12-jena-series-runtime-port.md) | WebDAV 적응 구현·도구별 브라우저/Worker/저장 왕복·실제 Lemonade fixture 확인, 최종 검증 수치는 문서 참고 | Viewer toskill 최신본·실제 소스 비교, 원본 미수정·대상별 PNG/저장/인증 차이 보존 | WebDAV 웹 빌드, Viewer frontend/native/설치 미실행 |
| MDPRO-20261110-JENA-ALT4-DOC | [AI Jena 하단 플로팅 Alt+4 구현·모바일](changes/2026-11-10-ai-jena-alt4-bottom-floating.md) | 기존 코드 기술서 작성·UI 계약 29개 통과, 모바일 실기기 미검증·코드 미수정 | Viewer 세 배치·모바일 viewport 차이 읽기 비교·미이식 | 문서 전용·이번 재빌드 불필요 |
| MDPRO-20261110-VITE-CLASSIC-SCRIPTS | [Vite 버튼 실행 오류](changes/2026-11-10-vite-classic-script-buttons.md) | 개발 서버 script 원문 제공·13개 검사·Chrome root/nested/React iframe·빌드 통과 | Viewer 동적 import 확인·루트 Vite 설정 없음·미수정 | 서버 전용 수정·이 항목 재빌드 불필요 |
| MDPRO-20261110-ME-AI-SETTINGS | [ME AI 설정·압축 UI·도표별 테마](changes/2026-11-10-me-ai-settings-port.md) | WebDAV 이식·102개 검사·Chrome 4개 회귀·웹 빌드 통과, 실제 공급자 품질 미검증 | Viewer 원본 함수 읽기 비교·미수정 | frontend/네이티브/설치 앱 미실행 |
| MDPRO-20261113-TABLE-ANCHOR-OWNER | [표 버튼 아래 위치 보존](changes/2026-11-13-table-anchor-owner.md) | 구현·43개 검사·desktop/mobile 실제 클릭·빌드 통과 | 대상 경로 없음·미이식 | 웹 이식 후 대기 |
| MDPRO-20261112-GEMINI-FAST | [Gemini 즉시 응답 추론 복원](changes/2026-11-12-gemini-fast-thinking.md) | 구현·42개 검사·빌드 통과, 실제 속도 미측정 | 대상 경로 없음·미이식 | 웹 이식 후 대기 |
| MDPRO-20261104-WEBDAV-HWP | [HWP/HWPX 열기·내보내기 이식](changes/2026-11-04-hwp-hwpx-port.md) | 구현·69개 검사·Chrome 열기/수식/중지·빌드 통과, PV 별도 검사 실패 | Viewer 원본 읽기 비교·미수정 | Viewer 원본 존재·WebDAV 적응 역이식 불필요 |
| MDPRO-20261104-LM-FAST | [LM Studio FAST 추론 정책](changes/2026-11-04-lmstudio-fast-reasoning.md) | 요청 정책 보완·31개 검사·빌드 통과, 실속도 미측정 | 대상 경로 없음·미이식 | 이식 후 반영 대기 |
| MDPRO-20261029-SITES-INFOGRAPHIC | [Sites 인포그래픽 링크](changes/2026-10-29-sites-infographic-link.md) | URL·캐시 갱신·2개 검사·빌드 통과, UI 미검증 | 대상 확인 필요·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261108-IMAGE-DOWNLOAD | [Mermaid·이미지 PC 다운로드](changes/2026-11-08-mermaid-image-download.md) | WebDAV DN·toPC·ME 저장 이식, 35개 검사·실제 Chrome 두 회귀·빌드 성공 | Viewer 기존 구현 읽기 비교·미수정 | native 포함·설치 앱 미검증, 빌드 미실행 |
| MDPRO-20261027-LEMONADE-DIAG | [Lemonade 연결·추론 지연 진단](changes/2026-10-27-lemonade-performance-diagnosis.md) | GPU PC 참고 측정·코드 미수정, 실제 대상인 별도 NPU 컴퓨터 미점검 | NPU/추론 경로 읽기 비교·미수정 | 자산 변경 없음·빌드 불필요 |
| MDPRO-20261027-JENA-FACE-LAYOUT | [얼굴 유지 위치 정리](changes/2026-10-27-jena-face-toggle-layout.md) | 안내 제거·파일부터 선택 가져오기 한 줄·29개 검사·빌드 통과, 실제 UI 미검증 | 대상 버튼·기능·CSS 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-DOCX-BOLD-MATH | [DOCX 볼드 안 수식·특수문자](changes/2026-10-27-docx-bold-math.md) | 구현·32개 검사·빌드·실제 DOCX XML 확인, Word 미검증 | 대상 OMML 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-JENA-IMAGE-UI | [AI Jena 이미지 설정 UI](changes/2026-10-27-jena-image-settings-ui.md) | 폰트·간격·청록 카드·29개 검사·빌드·Edge 도킹 확인 | 대상 클래스 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-FMA-LEMONADE-QUALITY | [FMA Lemonade 생성·편집과 해상도](changes/2026-10-27-fma-lemonade-quality.md) | 모델별 크기·품질 공유·자동 원본 선택·90개 검사·빌드·실제256×512 생성/편집 성공 | Viewer provider 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-WEBDAV-REFRESH | [WebDAV 새 항목 새로고침](changes/2026-10-27-webdav-new-items-refresh.md) | 목록 추가 병합·9개 검사·빌드 통과, NAS/UI 미검증 | NAS refresh 구조 비교·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-FMA-STUDIO-QUOTA | [AI Studio 이미지 할당량 오류](changes/2026-10-27-fma-studio-quota.md) | 할당량 오류 안내·62개 검사·빌드 통과, 실제 편집은 계정 할당량 확인 필요 | 전송 구조 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-FMA-PERSON | [반복 편집 인물 보존](changes/2026-10-27-fma-person-preservation.md) | 로컬 원본 참조·자동 생성 대체 방지·67개 검사·빌드 성공, 실화질 미검증 | 기존 identity/cameraOnly 차이 확인·미이식 | 웹 이식·실화질 검증 후 반영 대기 |
| MDPRO-20261027-LINK-PERSIST | [링크 삽입·저장·새로고침 원문 보존](changes/2026-10-27-link-insert-persistence.md) | 추가 수정·48개 검사·빌드·Edge 격리 HTTP 디스크 재열기 검증, NAS 재열기·배포 미확인 | 대상 native 삽입·autosave 차이 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-FMA-JENA-WAIT | [FMA Jena 92% 표시·편집 대기](changes/2026-10-27-fma-jena-progress-and-edit-wait.md) | 구현·67개 검사·실제 직접/앱 프록시 참조 편집 성공 | 대상 가상92% 존재 확인·미이식 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-FMA-SPLIT-CLOSE | [FMA 공급자 버튼 분리·이미지 편집 닫기](changes/2026-10-27-fma-provider-buttons-and-close.md) | WebDAV 구현·51개 검사·빌드·Edge 다크/라이트 클릭 | Viewer 별도 버튼 문서 비교·닫기 미이식 | 닫기 이식 후 반영 대기 |
| MDPRO-20261027-FMA-JENA-CONNECTION | [FMA Jena 공급자·모델 선택과 연결](changes/2026-10-27-fma-jena-provider-and-transport.md) | 구현·53개 검사·빌드·4B 신규 생성 성공, 실제 편집 timeout·Google/UI 미검증 | 독립 provider 차이 확인·미수정 | 웹 이식 후 반영 대기 |
| MDPRO-20261027-IMAGE-QUALITY | [Lemonade 이미지 원본 해상도·품질 설정](changes/2026-10-27-lemonade-image-quality.md) | WebDAV 이식·90개 검사·빌드·브라우저 저장 복원, 실제 생성은 서버 오류 | Viewer 원본 읽기 비교·미수정 | 원본 웹 자산의 native 반영 대기 |
| MDPRO-20261027-IMAGE-PREVIEW | [원본 크기 이미지 미리보기·창 조작](changes/2026-10-27-original-size-image-preview.md) | WebDAV 구현·39개 검사·빌드 통과·실제 UI 미검증 | 대상 기존 창 조작·축소 정책 차이 확인·미수정 | 배율 정책 조정 후 반영 대기 |
| MDPRO-20261026-UPLOAD-ACTIONS | [업로드 이미지 도구와 접기](changes/2026-10-26-uploaded-image-actions.md) | WebDAV 구현·46개 검사·빌드 통과·실제 UI 미검증 | 갤러리·CSV 차이 확인·미이식 | 이식 후 반영 대기 |
| MDPRO-20261027-LEMONADE-SAVE-BORDER | [Lemonade 저장 버튼 테두리](changes/2026-10-27-lemonade-save-button-border.md) | WebDAV 스타일 수정·검증은 기술문서 참고 | 대상 저장 버튼 확인 필요·미이식 | 이식 후 반영 대기 |
| MDPRO-20261027-APIKEY-FOLD | [API Key 입력 기본 접기](changes/2026-10-27-openai-api-key-fold.md) | WebDAV 구현·검사/빌드 결과는 기술문서 참고 | Viewer 고유 ID 확인·미이식 | 이식 후 반영 대기 |
| MDPRO-20261026-LLAMACPP | [llama.cpp 주소 기반 연결 이식](changes/2026-10-27-llamacpp-address-only.md) | WebDAV 이식·70개 검사·빌드 통과, 실제 UI/추론 미검증 | Viewer 원본 구현 읽기 확인·미수정 | Viewer 원본 native 반영 대기 |
| MDPRO-20261026-FLUX9B-VRAM | [Flux 9B 8GB VRAM 실행 오류](changes/2026-10-26-flux9b-low-vram.md) | 로컬 프로필 저장·실제 256 생성/512 참조 편집·재로딩 지속성 검증 | 같은 서버 프로필 공유·대상 코드 미수정 | 자산 변경 없음·재빌드 불필요 |
| MDPRO-20261026-FACE-REFERENCE | [이미지 재생성 얼굴 참조 유지](changes/2026-10-26-image-face-reference.md) | WebDAV 구현·60개 검사·빌드·옵션 UI 확인, 실제 얼굴 품질 미검증 | 기존 복수 참조 전송 확인·미수정 | 웹 이식 후 반영 대기 |
| MDPRO-20261026-LEMONADE-MODELS | [Lemonade 설치 모델 전체 표시](changes/2026-10-26-lemonade-installed-model-list.md) | WebDAV 구현·캐시 버전 갱신·ENV 동기화·자동 검사·빌드, 로컬 UI 10개 검증 | 공급자 구조 차이 확인·미수정 | 대상 확인 후 반영 대기 |
| MDPRO-20261026-FMA-INSERT | [내부 FMA → 문서 IMG 전달](changes/2026-10-26-fma-document-insert.md) | WebDAV 로컬 수정·회귀 검사·빌드, 실제 UI 미검증 | 대상 구형 수신 확인·미수정 | 메시지 계약 확인 후 반영 대기 |
| MDPRO-20261026-AI-IMAGES | [AI Jena 이미지 입력과 첨부 복원](changes/2026-10-26-ai-chat-image-attachments.md) | WebDAV 로컬 구현·자동 검사·빌드, 실제 모델/UI 미검증 | 대상 복원·별도 비전 경로 확인, 추가 검증 필요·미수정 | 차이 검증 후 반영 대기 |
| MDPRO-20261026-DOCX-MERMAID | [MS Word Mermaid 이미지 보존](changes/2026-10-26-docx-mermaid-images.md) | WebDAV 로컬 구현·브라우저 DOCX 생성 검증, Word 열기 미검증 | MDproViewer 차이 확인·미이식 | 이식 후 빌드 대기 |
| MDPRO-20261024-STATS-PV | [통계 별표와 PV 표 연결](changes/2026-10-24-statistical-stars-and-pv-continuation.md) | WebDAV 로컬 구현·검증 | MDproViewer 미적용, 선행 열 분할 이식 필요 | 이식 후 빌드 대기 |

이 목록은 현재 대화에서 수행한 두 기능을 초기 등록한다. 과거 전체 개발 이력을 전부 조사·등록했다는 뜻은 아니다. 이후 작업은 이 목록에 추가하고, 기존 항목의 상태를 증거에 맞춰 갱신한다.

## Tauri 명령 처리

MDproViewer에서 “타우리앱으로 빌드”, “Tauri 빌드”, “exe/설치파일 만들어줘” 요청을 받으면 먼저 [TAURI_BUILD.md](TAURI_BUILD.md)와 [TAURI_BUILD_QUEUE.md](TAURI_BUILD_QUEUE.md)를 읽고 그 절차로 실행한다. 대기 기능을 몰래 누락하거나, 문서의 존재만으로 앱에 반영된 것으로 처리하지 않는다.

- MDPRO-20261113-MATH-FOLD: [Jena Math 이름·모델 기본 접기·연결 상태](changes/2026-11-13-jena-math-fold.md) — WebDAV 구현/검사/빌드 통과, 실제 UI 미검증. Viewer 웹 이식/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-ME-PROVIDER-LAYOUT: [Jena ME 접기·모델 행 겹침·글자 크기](changes/2026-11-13-me-provider-layout.md) — WebDAV 구현·33검사/빌드 통과, 브라우저 소켓 권한으로 실제 UI 미검증. Viewer 웹/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-ME-COMPACT-ACTIONS: [참고 텍스트 버튼·코드 수정 배치](changes/2026-11-13-me-compact-actions.md) — 원본 구현·33검사/빌드 통과, 실제 UI 미검증. Viewer 웹/frontend/native/설치 대기, 빌드 요청 없음.

# MDproViewer Tauri 반영 대기 및 빌드 기록

최종 확인: 2026-10-24. 실제 빌드 대상은 `C:\CusorApps\md-viewerVscode\md_viewer`이다. WebDAV의 문서 사본은 참고용이며 대상 앱의 적용·빌드 사실을 대신하지 않는다.

## 대기 기능

- MDPRO-20261113-MERMAID-COMPACT-PREVIEW: [Mermaid Ref 저장기록 탭·프롬프트 실행 한 행·Dock·Crop](changes/2026-11-13-mermaid-ref-compact-preview.md) — WebDAV 구현·45관련검사/빌드 통과, 브라우저 소켓 권한 오류로 UI 미검증. Viewer 이식/Tauri/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-TIDY-DOCK-RESPONSIVE: [TIDY Dock 반응형 1열](changes/2026-11-13-tidy-dock-responsive.md) — WebDAV 구현/빌드 통과. 브라우저 검사는 playwright-core 부재로 실행 실패, 실제 UI 미검증. Viewer 웹 이식/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-TABLE-SIZE-COMPACT: [표 크기·편집 기본 접기·한 줄 격자](changes/2026-11-13-table-size-compact.md) — WebDAV 구현·6검사/빌드 통과, 실제 UI 미검증. Viewer 웹 이식·frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-MATH-PICKER: [Jena Math 연결·선택 상자 대비](changes/2026-11-13-jena-math-picker.md) — iframe 자체 AI 경로·Lemonade16개·UI 대비·55검사/빌드 통과. 실제 OCR 생성·Viewer 이식/Tauri/설치 미검증.

- MDPRO-20261113-TIDY-CONNECTION: [Jena Tidy·JS 연결 표시](changes/2026-11-13-tidy-connection.md). WebDAV 구현·34검사/웹 빌드 통과, 실제 UI 미검증. Viewer 독립 HTML 선택기 적응·웹 검증·frontend/native/설치 모두 대기. 이번 Tauri 빌드 요청 없음.

- MDPRO-20261113-FIGURE-CAPTION-FOLD: [그림 캡션 기본 접기·모바일 이미지 압축](changes/2026-11-13-figure-caption-fold.md). WebDAV 웹 검증/빌드 완료, Viewer 웹 이식/frontend/native/설치 대기. 이번 빌드 요청 없음.

- MDPRO-20261113-MOBILE-EDITOR-MENUS: [모바일 편집 메뉴·우측 Dock](changes/2026-11-13-mobile-editor-menus.md). WebDAV 표 크기 10열·숫자 입력·모바일 기본 Dock·크기/편집 접기·Mermaid Ref 압축/160px/기본 Dock·샘플/전체화면 후속 수정, Chrome 390/767/1280 검증/빌드 완료. Viewer mobile 변수 적응·웹 이식·frontend/native/설치 모두 대기, 이번 빌드 요청 없음.

| ID | 적용 항목 | 대상 웹 소스 | 웹 검증 | 프런트엔드 준비 | 네이티브 빌드 | 설치 앱 검증 |
| --- | --- | --- | --- | --- | --- | --- |
| MDPRO-20261113-MERMAID-REF-FOLD | [Mermaid Ref 기본 접기](changes/2026-11-13-mermaid-ref-revision-fold.md) | Viewer open 속성 확인·제거 미이식 | WebDAV 빌드 통과·실제 UI 미검증 | 미실행 | 요청 범위 밖·미실행 | 미실행 |
| MDPRO-20261112-WORKSPACE-UI | [Macro/Tidy/표 메뉴](changes/2026-11-12-macro-dock-tidy-workspace-table-anchor.md) | Viewer 고유 구현 비교·선택 역이식 대기 | WebDAV Chrome 3화면·모의 AI·로컬 저장/Worker·웹 빌드 통과 | Viewer 미실행 | 요청 범위 밖·미실행 | 미실행 |
| MDPRO-20261112-IMAGE-INSERT-DOCK | [이미지 넣기 Dock](changes/2026-11-12-image-insert-dock.md) | Viewer 기존 우측 정렬 확인·분할 Dock 미적용 | WebDAV Chrome 3화면·양 테마·삽입/복귀·빌드 통과 | Viewer 미실행 | 요청 범위 밖·미실행 | 미실행 |
| MDPRO-20261112-TABLE-DOCK-MERGE | [표 메뉴 Dock·병합](changes/2026-11-12-table-menu-dock-merge.md) | Viewer 대응 기능 이미 존재·이번 미수정 | WebDAV 43개·Chrome 1440/390·빌드 통과 | Viewer 미실행 | 자산 미수정·불필요 | 미실행 |
| MDPRO-20261112-TIDY-MENU-DOCK | [TIDY 메뉴 우측 도킹](changes/2026-11-12-tidy-menu-right-dock.md) | Viewer 원본 존재·pointer capture/Observer 가드 등 필요시 선택 반영·이번 미수정 | WebDAV Chrome 1440/800/390·양 테마·변환/복귀 검증 | WebDAV 웹 빌드 완료·Viewer 미실행 | 요청 범위 밖·미실행 | 미실행 |
| MDPRO-20261112-JENA-SERIES-RUNTIME | [Jena 군 연결·작업 실행·UI 안정화](changes/2026-11-12-jena-series-runtime-port.md) | Viewer 원본 기능 존재·WebDAV 고유 안정화 역이식은 대상 코드 비교 후 선택, 이번 Viewer 미수정 | WebDAV 도구별 root/nested·Worker·MPP/inDB·실제 Lemonade 확인, 다른 실제 공급자는 구분 | WebDAV 웹 빌드만·Viewer frontend 미실행 | 이번 요청에 포함 안 됨·미실행 | 미실행 |
| MDPRO-20261110-JENA-ALT4-DOC | [Alt+4 구현·모바일 기술서](changes/2026-11-10-ai-jena-alt4-bottom-floating.md) | Viewer floating 미구현 확인·이번 문서만 작성·대상 미수정 | WebDAV 소스/CSS 계약 29개 통과·브라우저/모바일 미검증 | 미실행·향후 이식 시 대상 절차 확인 | 문서 전용·이번 재빌드 불필요 | 미검증 |
| MDPRO-20261110-VITE-CLASSIC-SCRIPTS | [Vite 버튼 오류 수정](changes/2026-11-10-vite-classic-script-buttons.md) | WebDAV 개발 서버 전용·Viewer 런타임 변경 없음 | Node13개·실제Vite Chrome root/nested/React iframe 통과 | 자산 변경 없음 | 이 항목 재빌드 불필요·미실행 | 미실행 |
| MDPRO-20261110-ME-AI-SETTINGS | [ME AI 설정·고밀도 UI·테마 격리](changes/2026-11-10-me-ai-settings-port.md) | Viewer 원본 존재·WebDAV profile/저장 이전 적응은 비교 후 선택 적용 | WebDAV102개·Chrome4회귀·웹 빌드 통과, 실비전 미검증 | 이번 미실행 | 이번 미실행 | 미실행 |
| MDPRO-20261113-TABLE-ANCHOR-OWNER | [표 메뉴 위치 소유권](changes/2026-11-13-table-anchor-owner.md) | 공통 배치 가드 적응 필요·미이식 | WebDAV43개·desktop/mobile 실제 클릭 확인 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261112-GEMINI-FAST | [Gemini 즉시 응답](changes/2026-11-12-gemini-fast-thinking.md) | js/app.js·캐시 적응 필요·미이식 | WebDAV 42개 통과·실제 속도 미측정 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261104-WEBDAV-HWP | [HWP/HWPX 이식](changes/2026-11-04-hwp-hwpx-port.md) | 실제 Viewer 원본 rHwp 존재·미수정 | WebDAV69개·Chrome 열기/수식/중지 통과, PV 미완료 | 이번 작업 미실행 | 이번 작업 미실행 | 미검증 |
| MDPRO-20261104-LM-FAST | [LM Studio FAST 추론 정책](changes/2026-11-04-lmstudio-fast-reasoning.md) | app.js 요청 정책 적응·미이식 | WebDAV 31개 통과·실속도 미측정 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261029-SITES-INFOGRAPHIC | [Sites 인포그래픽 링크](changes/2026-10-29-sites-infographic-link.md) | 대상 Sites 경로 확인 필요·미이식 | WebDAV 2개 검사·빌드 통과, 실제 UI 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261108-IMAGE-DOWNLOAD | [DN·toPC·ME 저장](changes/2026-11-08-mermaid-image-download.md) | Viewer 원본 대응 기능 존재·이번 미수정 | WebDAV Chrome 두 회귀·35개 검사·빌드 통과, 대상 설치 앱 미검증 | 이번 미실행 | 이번 미실행 | 미실행 |
| MDPRO-20261027-JENA-FACE-LAYOUT | [얼굴 유지 위치 정리](changes/2026-10-27-jena-face-toggle-layout.md) | 대상 얼굴 유지·고유 생성 버튼・한 줄 CSS 대응 필요·미이식 | WebDAV 29개·빌드 통과, 실제 UI 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-DOCX-BOLD-MATH | [DOCX 수식 볼드](changes/2026-10-27-docx-bold-math.md) | 대상 OMML·파서·로더 적응 필요·미이식 | WebDAV 32개·빌드·DOCX XML 확인, Word 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-JENA-IMAGE-UI | [AI Jena 이미지 설정 UI](changes/2026-10-27-jena-image-settings-ui.md) | compatible-generation 클래스 적응 필요·미이식 | WebDAV 29개·빌드·Edge 도킹 확인 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-LEMONADE-QUALITY | [FMA Lemonade 생성·편집과 해상도](changes/2026-10-27-fma-lemonade-quality.md) | Viewer provider·identity 구조 적응 필요·미이식 | WebDAV90개·빌드·UI·실제256×512 생성/편집 성공 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-WEBDAV-REFRESH | [WebDAV 새 항목 확인](changes/2026-10-27-webdav-new-items-refresh.md) | nas-webdav.js 목록·선택 구조 적응 필요·미이식 | WebDAV 9개 검사·빌드 통과, NAS/UI 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-STUDIO-QUOTA | [AI Studio 이미지 할당량 오류](changes/2026-10-27-fma-studio-quota.md) | Google 전송 구조 차이 확인·미이식 | WebDAV 62개 검사·빌드 통과, 실제 편집 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-PERSON | [반복 편집 인물 보존](changes/2026-10-27-fma-person-preservation.md) | identity/cameraOnly·공급자 차이 확인·미이식 | WebDAV 67개·빌드 성공, 서버 연결 실패·실화질 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-LINK-PERSIST | [링크 삽입·저장 원문 보존](changes/2026-10-27-link-insert-persistence.md) | 대상 native 삽입・알림・autosave 이식 대기 | WebDAV 48개·빌드·Edge 격리 디스크 저장/새로고침 통과, NAS 재열기 미확인 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-JENA-WAIT | [FMA Jena 92% 표시·편집 대기](changes/2026-10-27-fma-jena-progress-and-edit-wait.md) | 대상 가상92% 존재·공급자 구조 차이·미이식 | 대상 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-SPLIT-CLOSE | [FMA 공급자 버튼 분리·이미지 편집 닫기](changes/2026-10-27-fma-provider-buttons-and-close.md) | Viewer 기존 버튼 보존·닫기 개선 미이식 | WebDAV 51개·빌드·Edge 다크/라이트 열기·닫기 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-FMA-JENA-CONNECTION | [FMA Jena 공급자·모델 선택과 연결](changes/2026-10-27-fma-jena-provider-and-transport.md) | 대상 독립 공급자/Google 경로 확인·미이식 | 대상 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-IMAGE-QUALITY | [Lemonade 이미지 원본 해상도·품질 설정](changes/2026-10-27-lemonade-image-quality.md) | Viewer 원본 존재·이번 WebDAV 적응, 대상 런타임 미수정 | WebDAV 90개·빌드·UI 저장 복원, 실생성 backend_error | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-IMAGE-PREVIEW | [원본 크기 이미지 미리보기·창 조작](changes/2026-10-27-original-size-image-preview.md) | 대상 이동·5방향 조절 존재·원본 배율/스크롤 정책 미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-LEMONADE-SAVE-BORDER | [Lemonade 저장 버튼 테두리](changes/2026-10-27-lemonade-save-button-border.md) | 대상 저장 버튼 확인 필요·미이식 | 실제 UI 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261027-APIKEY-FOLD | [API Key 입력 기본 접기](changes/2026-10-27-openai-api-key-fold.md) | Viewer 고유 ID 보존 필요·미이식 | 실제 UI 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-LLAMACPP | [llama.cpp 주소 기반 연결](changes/2026-10-27-llamacpp-address-only.md) | Viewer 원본 3개 자산 구현 확인·이번 WebDAV 이식만 수행 | WebDAV 70개·빌드 통과, Viewer UI/실제 추론 미검증 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-UPLOAD-ACTIONS | [업로드 이미지 도구와 접기](changes/2026-10-26-uploaded-image-actions.md) | 대상 갤러리 차이 확인·미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-FLUX9B-VRAM | [Flux 9B 저메모리 프로필](changes/2026-10-26-flux9b-low-vram.md) | 자산 수정 없음·동일 로컬 서버 프로필 공유 | 대상 설치 앱 미실행 | 불필요 | 불필요 | 미실행 |
| MDPRO-20261026-FACE-REFERENCE | [이미지 재생성 얼굴 참조 유지](changes/2026-10-26-image-face-reference.md) | 대상 복수 참조 전송 확인·프롬프트/원본 보존 미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-LEMONADE-MODELS | [Lemonade 설치 모델 전체 표시](changes/2026-10-26-lemonade-installed-model-list.md) | 공급자 구조 차이·하위 목록·로더 버전·ENV 동기화 확인 대기·미수정 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-FMA-INSERT | [내부 FMA → 문서 IMG 전달](changes/2026-10-26-fma-document-insert.md) | 구형 수신 확인·메시지 계약 추가 확인·미수정 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-AI-IMAGES | [이미지 입력과 질문 첨부 복원](changes/2026-10-26-ai-chat-image-attachments.md) | 대상 동등 경로 일부 확인·추가 차이 미적용 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261026-DOCX-MERMAID | [Word Mermaid 이미지·원본 코드 보존](changes/2026-10-26-docx-mermaid-images.md) | 차이 확인·미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261024-STATS-PV-A | 통계 별표 보존 | 미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261024-STATS-PV-B | 넓은 표 열 분할 선행 기능 및 표 연결 caption | 미이식 | 미실행 | 미실행 | 미실행 | 미실행 |
| MDPRO-20261024-STATS-PV-C | 긴 표의 다음 페이지 연결 caption | 미이식 | 미실행 | 미실행 | 미실행 | 미실행 |

상세 구현·코드·선행 작업·재현 입력: [기술문서](changes/2026-10-24-statistical-stars-and-pv-continuation.md).

## 상태 갱신 규칙

- 웹 소스 수정 시 문서 링크와 실제 변경 파일을 추가한다. 항목 ID는 유지한다.
- 성공한 단계만 완료로 바꾼다. 웹 소스 이식만으로 빌드 완료, frontend 준비만으로 EXE 완료라고 표시하지 않는다.
- 빌드 요청 시 아래 실행 기록을 새로 추가한다. 기존 기록은 보존한다.
- 대기 기능의 이식을 포함하는 빌드 요청이면 선행 이식·검증 후 빌드한다. 사용자가 현재 소스만 빌드하라고 범위를 정했다면 제외 항목과 이유를 기록하고 현재 소스를 빌드한다.
- 실제 장애가 있으면 실패 지점·로그·이미 완료한 단계를 기록한다. 누락된 기능을 포함했다고 보고하지 않는다.

## 빌드 실행 기록 양식

```text
실행 날짜/시간(Asia/Seoul):
소스 경로 / Git HEAD / dirty 파일 요약:
MDPRO_VIEWER_SOURCE / CARGO_TARGET_DIR 사용 여부와 실제 경로:
참조 기술문서와 포함 ID:
제외 ID 및 이유:
선행 이식 / 검사 / 실제 웹 검증 결과:
실행 명령과 각 종료 코드:
Tauri/dist 자산 확인(파일별 SHA256 또는 변환 결과):
네이티브 EXE 경로 / 크기 / 수정시각 / SHA256:
NSIS 경로 / 크기 / 수정시각 / SHA256:
publish 스크립트 결과와 최종 제공 경로:
설치 앱 / WebView2 / 실제 인쇄·PDF 검증 결과 또는 미실행:
실패 / 미완료 / 다음 조치:
```

현재 문서 등록 작업에서는 프런트엔드 준비, 네이티브 빌드, 설치 실행을 수행하지 않았다.

- MDPRO-20261113-HOSTED-IMAGE-REFERRER: [imgBB 보기 로딩 정책](changes/2026-11-13-hosted-image-referrer.md). WebDAV Chrome 9항목/빌드 통과, 사용자 문서 보기/PV 미검증. Viewer 경로 없음·웹 이식/프런트엔드 준비/네이티브 빌드/설치 검증 대기. 요청에 빌드 미포함.

- MDPRO-20261113-JENA-DOCK-POPOVER: [Jena Dock popover 분리](changes/2026-11-13-jena-dock-popover.md). WebDAV 방어 수정·Chrome iframe 전환/29개 계약 통과. 사용자 공백 재현/해결 미확인. Viewer 웹 이식·웹 검증·프런트엔드 준비·네이티브 빌드·설치 앱 검증 대기, 이번 요청에 빌드 미포함.

- MDPRO-20261113-STUDIO-NOTICE: [AI Studio 안내 제거](changes/2026-11-13-studio-model-notice.md). 원본 구현·빈 안내 영역 CSS/캐시2차 보완·계약/빌드 통과. Viewer 대상 확인·웹 이식·웹 검증·프런트엔드 준비·네이티브 빌드·설치 검증 대기. 빌드 미요청.

- MDPRO-20261113-RESUME-ANSWER: [중단 답변 이어쓰기](changes/2026-11-13-resume-answer.md). WebDAV Chrome 모의 중단→이어쓰기/32개 검사·빌드 통과. Viewer 대상 비교·웹 이식·웹 검증·프런트엔드 준비·네이티브 빌드·설치 앱 검증 대기. 빌드 미요청.

- MDPRO-20261113-LEMONADE-EMPTY: [Lemonade 빈 응답 복구](changes/2026-11-13-lemonade-empty-response.md). 원본 자동/브라우저 모의/로컬 실모델·빌드 통과. Viewer 비교·웹 이식·웹 검증·프런트엔드 준비·네이티브 빌드·설치 검증 대기. 빌드 미요청.

- MDPRO-20261113-LOCAL-MODEL-LOAD: [Viewer 로딩 이식](changes/2026-11-13-local-model-loading-port.md). WebDAV 세 공급자 실서버 목록·LM/Ollama 로드/생성·Lemonade health 확인. Viewer(C:\CusorApps\MDPRO\MDproViewer)는 참고 원본 미수정, frontend/native/설치 검증 미실행·이번 빌드 불필요. Vite 중계는 Viewer native에 직접 복사 금지.

- MDPRO-20261113-CONTINUATION-START: [이어쓰기/Auto/시작 지연](changes/2026-11-13-continuation-start.md). WebDAV 실제 클릭·실모델 첫 본문714ms 확인. Viewer 함수 대응·웹 이식·웹 검증·프런트엔드 준비·native/설치 검증 미실행, 빌드 미요청.

- MDPRO-20261113-PROVIDER-ISOLATION: [공급자 분리](changes/2026-11-13-provider-isolation.md). WebDAV 구현/자동검사·빌드, 새 live 측정 실패. Viewer 비교·웹 이식·웹 검증·frontend/native/설치 검증 대기. 빌드 미요청.

- MDPRO-20261113-NPU-TASK-ROUTE: [FLM 실행 경로](changes/2026-11-13-npu-task-route.md). Viewer 고유 프로필 읽기 비교, 웹 이식/frontend/native/설치 검증 미실행.

- MDPRO-20261113-ME-SCOPED-CHAT: [Mermaid Ref 상단 내부 분할](changes/2026-11-13-me-scoped-chat.md). Viewer 기존 source/result 구현 비교, 코드/미리보기 탭·JENA ME 실행·독립 테마/줌/DN PNG 포함. 웹 이식/frontend/native/설치 검증 대기.

- MDPRO-20261113-MATH-FOLD: [Jena Math 이름·모델 기본 접기·연결 상태](changes/2026-11-13-jena-math-fold.md) — WebDAV 구현/검사/빌드 통과, 실제 UI 미검증. Viewer 웹 이식/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-ME-PROVIDER-LAYOUT: [Jena ME 접기·모델 행 겹침·글자 크기](changes/2026-11-13-me-provider-layout.md) — WebDAV 구현·33검사/빌드 통과, 브라우저 소켓 권한으로 실제 UI 미검증. Viewer 웹/frontend/native/설치 대기, 빌드 요청 없음.

- MDPRO-20261113-ME-COMPACT-ACTIONS: [참고 텍스트 버튼·코드 수정 배치](changes/2026-11-13-me-compact-actions.md) — 원본 구현·33검사/빌드 통과, 실제 UI 미검증. Viewer 웹/frontend/native/설치 대기, 빌드 요청 없음.

- [Jena Table 인식 프롬프트 기본 접힘](changes/2026-11-13-table-prompt-fold.md): WebDAV 실제 소스 적용, Chrome 접힘/키보드/값 보존/실행 노출·웹 빌드 통과. Viewer 기존 구현 확인, Tauri/배포 미실행.

- MDPRO-20261114-MOVE-MODAL-LAYER: [파일 이동창 전면 표시](changes/2026-11-14-move-modal-layer.md) — WebDAV portal·레이어 수정/빌드 통과, 실제 UI 미검증. Viewer 대응 확인·이식/frontend/native/설치 대기, 빌드 요청 없음.

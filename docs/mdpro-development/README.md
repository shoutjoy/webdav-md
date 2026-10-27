# MDpro 개발 기록과 양방향 이식 절차

규칙 ID: `MDPRO-DEVELOPMENT-HANDOFF-01` / 작성일: 2026-10-24

## 적용 범위

WebDAV MDpro와 MDproViewer의 기능 개발, 버그 수정, 리팩터링, 이식 작업마다 이 절차를 적용한다. 코드 작업과 함께 **다른 앱에 다시 명령해 구현할 수 있는 기술문서**를 남긴다. 순수 문서·규칙 수정은 별도 변경 문서를 재귀적으로 만들지 않아도 된다. 사용자의 현재 명령이 우선한다.

| 항목 | WebDAV | MDproViewer |
| --- | --- | --- |
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

| ID | 기술문서 | 원본 구현 | 상대 앱 적용 | Tauri |
| --- | --- | --- | --- | --- |
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

# MDproViewer Tauri 반영 대기 및 빌드 기록

최종 확인: 2026-10-24. 실제 빌드 대상은 `C:\CusorApps\md-viewerVscode\md_viewer`이다. WebDAV의 문서 사본은 참고용이며 대상 앱의 적용·빌드 사실을 대신하지 않는다.

## 대기 기능

| ID | 적용 항목 | 대상 웹 소스 | 웹 검증 | 프런트엔드 준비 | 네이티브 빌드 | 설치 앱 검증 |
| --- | --- | --- | --- | --- | --- | --- |
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

# WebDAV Jena Table 인식 프롬프트 기본 접힘

문서 ID MDPRO-WEBDAV-20261113-TABLE-PROMPT-FOLD · 소스 확인2026-11-13 · 미커밋.
사용자가 실제 WebDAV MD 화면임을 확인해 해당 앱에 적용했다. 이전 Viewer 전용 수정은 WebDAV 반영이 아니었다.
mdpro/index.html에서 기존 두번째 인식 프롬프트 heading을 details#jena-table-prompt-settings/summary로 구성하고 모델 picker와 기존 textarea를 안에 보존했다. 생성 버튼/상태는 밖에 유지한다. mdpro/css/style.css의 scoped summary에 펼치기/접기 표시 및 focus-visible을 제공한다. 기존 ID/리스너/AI 모델·ENV 인증/프롬프트 값/생성/중지/원문·명시 적용·저장 경로 변경 없음. 새 영구 저장 키 없음, 최초 닫힘이며 세션 DOM 상태로 입력 보존. 창 전환/전체 WIN 준수는 이번 범위 밖이다. CSS query와 PWA CACHE_VERSION을 함께 갱신했다.

검증: WebDAV 실제 mdpro HTML/CSS를 정적 HTTP+Chrome으로 실행해 최초 open=false/textarea 비노출·실행 버튼 노출, 클릭 펼침→문구 입력→접기→Enter 펼침의 값 보존 통과. 테스트 harness와 캡처는 Viewer artifacts/webdav-table-prompt-fold.cjs, webdav-table-prompt-fold.png에 있다. npm run build 및 git diff --check 통과. 실제 공급자 OCR/실제 배포 서버/사용자 기존탭 캐시/모바일/설치 앱 미검증. 빌드는 배포를 의미하지 않는다.

Viewer는 Docs/mdpro-development/changes/2026-11-13-table-prompt-fold.md의 동일 목적 details 구현이 이미 있다. WebDAV는 모델 picker가 heading 내부여서 summary 밖 details 안으로 이동했다. 파일 전체 복사 없음. Tauri 포함 자산은 대상 Viewer index/CSS/PWA이며 이번 WebDAV 추가 수정으로 Tauri 빌드하지 않았다.
재명령: 양쪽 AGENTS와 이 기록을 읽고 모델·textarea ID를 유지하며 네이티브 disclosure를 함수/마크업 단위 대조하라. 실행/상태/중지는 밖에 두고 초기 접힘·키보드·입력 보존·실행 접근을 실제 대상 브라우저에서 확인하라.

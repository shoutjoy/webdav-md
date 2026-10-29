# Sites 인포그래픽 일괄작업 Gemini 주소 변경

- 변경 ID: MDPRO-20261029-SITES-INFOGRAPHIC
- 작성·확인: 2026-10-29 / 원본: WebDAV MDpro, 미커밋
- 대상: `C:\CusorApps\md-viewerVscode\md_viewer` / 대상 경로 접근 불가, 대상 확인 필요·미이식
- 상태: 원본 구현·자동 검사·빌드 완료 / 실제 웹 UI·대상 웹·Tauri 준비·네이티브 빌드·설치 앱 검증 미실행

## 요청과 실제 구현

Sites의 기존 `인포그래픽 일괄작업` 이름과 모든 컨트롤을 유지하고 링크만 변경했다.
`mdpro/ShareSites/sitesshow/sitesshow.js`의 `INFOGRAPHIC_BATCH_SITE_URL`을
`https://share.gemini.google/c9j7dKVXR5Ay`에서 `https://share.gemini.google/gbLtf5UsOzKs`로 변경했다.
기본 목록은 이 상수를 사용하고, 기존 저장 목록은 `normalizeSitesList()`에서 같은 이름의 항목 주소를 이 상수로 갱신한다. 저장 구조와 다른 사이트는 유지한다.
`mdpro/index.html`의 스크립트 캐시 버전을 `20261029-infographic-batch-link-1`로 갱신하고 기존 `tests/sitesDefaults.test.mjs` 기대값을 수정했다. 신규 의존성 없음. 보기/PV/miniPV/AI/내보내기 영향 없음.

## 상대 앱 대응과 이식

| 원본 | 대상 | 상태·적응 조건 |
| --- | --- | --- |
| `mdpro/ShareSites/sitesshow/sitesshow.js`, `normalizeSitesList()` | 실제 Sites 구현 위치 확인 필요 | 대상 확인 필요·미이식. 대상 기본 목록·저장 목록 마이그레이션 구조 확인 후 URL만 변경 |
| `mdpro/index.html` 스크립트 버전 | 대상 로더 확인 필요 | 대상 고유 캐시·자산 처리 유지 |

전체 파일을 복사하지 않는다. 대상 코드의 사용자 설정과 컨트롤을 보존한다.

## 검증

- `node --test tests/sitesDefaults.test.mjs`: 2개 통과.
- `node --check mdpro/ShareSites/sitesshow/sitesshow.js`: 통과.
- `git diff --check`: 통과.
- `npm run build`: 통과. 번들 크기·플러그인 처리 시간 경고 있음.
- diff 검토: URL·캐시 버전·기존 테스트 기대값만 수정, 컨트롤/CSS 제거 없음.
- 신규 목록과 기존 동일 이름 목록의 새 URL 사용은 기존 정적 계약 검사로 확인. 실제 클릭·Gemini 공유 앱 접근은 미검증.

## Tauri 반영 계획

대기 항목: MDPRO-20261029-SITES-INFOGRAPHIC. 대상 웹 이식 후 해당 Sites 자산의 프런트엔드 포함 여부와 `Tauri/dist` URL을 확인하고 설치 앱에서 새 링크를 검증한다. 빌드 요청 시 대상 `Docs/mdpro-development/TAURI_BUILD.md`를 따른다. 이번 작업에서 상대 앱 수정·빌드·배포는 수행하지 않았다.

## 다른 앱에서 다시 실행할 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 작업해줘. AGENTS.md와 WebDAV 저장소 docs/mdpro-development/changes/2026-10-29-sites-infographic-link.md를 읽고 Sites 인포그래픽 일괄작업 Gemini 링크를 https://share.gemini.google/gbLtf5UsOzKs 로 변경해줘. 대상 Sites 로더·기본 목록·저장 목록 처리부터 확인하고 전체 파일 덮어쓰기 없이 적용해줘. 기존 컨트롤과 사용자 설정을 보존하고 신규/기존 목록의 주소와 실제 클릭을 검증해줘. 이식 문서·목록·Tauri 대기 상태를 갱신하고 빌드·배포는 하지 마. 미검증 항목을 구분해서 보고해줘.
```

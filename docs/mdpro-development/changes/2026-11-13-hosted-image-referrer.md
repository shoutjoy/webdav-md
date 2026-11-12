# 2026-11-13 imgBB 보기 이미지 Referer 제한

- 변경 ID: MDPRO-20261113-HOSTED-IMAGE-REFERRER
- 원본: C:\CusorApps\WebDav-MD\webdav-md (미커밋). 대상: C:\CusorApps\md-viewerVscode\md_viewer (경로 없음, 대상 확인 필요).
- 상태: WebDAV 구현/Chrome 격리 검사/웹 빌드 완료. 실제 사용자 문서 메인 보기·PV 및 Viewer 이식/네이티브 빌드/설치 앱 미검증.

## 요청과 실제 구현

사용자 URL https://i.ibb.co/bg7d86C4/img-insert-1788399936901.jpg 는 직접 열리지만 보기에서는 imgBB service unavailable 그림이 나타남. 서버가 정상 이미지로 오류 그림을 반환할 수 있어 onerror만으로 감지할 수 없다. 외부 삽입 Referer 차이에 대한 예방 수정이며 원인이 확정된 것은 아니다.

mdpro/js/app.js의 prepareHostedImageReferrers(html)는 inert template에서 https://i.ibb.co 호스트의 실제 img에만 referrerpolicy="no-referrer"를 설정한다. renderMarkdownSnapshotToHtml의 공통 MathRender/marked 반환 직후 호출하므로 DOM 삽입 이전에 정책이 존재한다. 메인 보기와 editpv.js의 공통 snapshot 호출에 함께 적용한다. 코드 예제의 이스케이프 img, 다른 호스트, internal 이미지, 원본 Markdown, 크기 속성, 캡션은 보존한다. 수식 처리 순서·MathJax·출력 처리·UI 컨트롤은 변경하지 않았다. 신규 의존성 없음.

mdpro/index.html app.js 쿼리 hostedImage=20261113-1 및 PWA service-worker 캐시 버전 20261113-hosted-image-referrer-1 갱신. 기존 표 메뉴 관련 미커밋 변경은 보존.

## 검증

- node tests/hostedImageReferrer.browser.cjs: 실제 headless Chrome inert DOM 9항목 통과. 최초 sandbox 실행은 Chrome stdout 없음으로 실패, 승인된 재실행 통과.
- node --check mdpro/js/app.js, git diff --check, npm run build 통과. 기존 큰 청크 경고 존재.
- 제공 URL curl HEAD: Referer 없음/https://example.com/ 있음 모두 HTTP 200, image/jpeg, 484966 bytes. 최초 sandbox DNS 실패 후 외부 읽기 재실행 성공. HEAD는 실제 픽셀 또는 원인 확정 증거가 아니다.
- 실제 사용자 문서 보기/PV 시각 검증 미실행. 이전 호스트 오류 그림이 브라우저 캐시에 남은 경우 캐시를 무시한 새로고침 후 확인 필요. 원격 서비스 일시 장애 자체는 앱에서 보장 불가.
- Chrome 테스트는 메인/PV 전체 UI 검증을 대체하지 않는다. 수식 파이프라인은 미변경이며 수식 실렌더 회귀 미실행.

## 대상 적응 및 Tauri

| 원본 | 대상 대응 | 상태 |
| --- | --- | --- |
| app.js prepareHostedImageReferrers/renderMarkdownSnapshotToHtml | 대상 js/app.js 및 PV HTML 생성 경로 실제 확인 필요 | 경로 없음·미이식 |
| index.html/PWA 캐시 | 대상 독립 자산 버전 및 Tauri 포함 경로 확인 필요 | 미검증 |

전체 app.js나 index.html을 덮어쓰지 않는다. 대상 공통 HTML 생성 후 DOM 삽입 전 정책을 연결한다. 대상 독립 저장소/브리지/수식 파이프라인을 보존한다. 웹 이식 후 Docs/mdpro-development/TAURI_BUILD.md에 따라 자산 포함과 Tauri/dist를 확인하고 설치 앱에서 이미지 크기·캡션·PV를 검증한다. 이번 요청은 Viewer 빌드를 포함하지 않는다. 빌드 대기 ID는 위 변경 ID와 같다.

## 복사할 구현 명령

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 원본 C:\CusorApps\WebDav-MD\webdav-md\docs\mdpro-development\changes\2026-11-13-hosted-image-referrer.md를 읽어줘. 대상의 공통 Markdown HTML 생성/PV 경로를 먼저 비교하고 https://i.ibb.co 이미지에 DOM 삽입 전 no-referrer 정책을 좁게 적용해줘. 전체 파일을 복사하지 말고 원본 Markdown·크기·캡션·다른 호스트·코드 예제·수식 처리 순서를 보존해줘. 제공 URL을 실제 보기와 PV에서 확인하고 격리 Chrome 테스트를 대상에 맞게 이식해줘. 문서·목록·Tauri 빌드 대기를 갱신하되 네이티브 빌드와 설치는 실행하지 말고 미검증을 구분해줘.
```

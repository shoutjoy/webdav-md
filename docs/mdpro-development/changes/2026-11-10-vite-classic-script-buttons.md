# 2026-11-10 Vite 개발 서버의 버튼 전체 실행 오류

- 변경 ID: `MDPRO-20261110-VITE-CLASSIC-SCRIPTS`
- 작업 저장소: `C:/CusorApps/Webdav_md/webdav-md`, 미커밋.
- 선행 ME AI 이식 변경은 그대로 보존. 이번 런타임 수정은 `vite.config.js`, 신규 `src/mdproScriptServer.js`에 한정한다.
- 상태: WebDAV 개발 서버 수정·실제 Chrome root/nested/React iframe 검증·Node 13개·웹 빌드 완료. 배포/커밋/Viewer 수정/Tauri 빌드 미실행.

## 요청과 재현 원인

사용자가 `npm run dev` 로그의 HWP 동적 import 경고와 여러 버튼의 미실행을 보고했다. 실제 Vite 8.0.1 + Chrome으로 `/mdpro/index.html?webdav=1`을 열어 재현했다.

서버가 제공한 app.js 첫 줄은 다음과 같았다.

```js
import { injectQuery as __vite__injectQuery } from "/@vite/client";
```

MDpro의 app.js는 HTML의 일반 `<script defer>`로 실행되어 전역 함수와 inline onclick을 제공한다. Vite가 HWP의 `import(openModuleUrl.href)`/`import(moduleUrl.href)`를 변환하며 위 정적 import를 삽입해 `Cannot use import statement outside a module` 오류가 발생했다. app.js 전체가 실행되지 않아 `openSettingsModal`, `openMermaidEditorModal`, `showToast`가 undefined였고, 다른 초기화에서 `currentStorageSourceTab is not defined`도 이어졌다. 터미널 경고만의 문제가 아니었다.

`@vite-ignore`를 세 import에 적용해 시험했으나 현재 설치된 Vite는 경고만 억제하고 injectQuery 변환을 계속했다. 이 시험 변경은 제거했다. `type=module`로 바꾸면 기존 전역 함수/inline handler 계약이 깨지므로 적용하지 않았다.

앞선 ME AI 검증은 자체 정적 HTTP 서버에서 실행해 이 개발 서버 경로를 놓쳤다. [앞선 이식 기록](2026-11-10-me-ai-settings-port.md)의 실제 범위는 정적 런타임/모의 API 회귀이며, 본 문서가 Vite 환경 검증을 추가한다.

## 구현과 처리 순서

1. `src/mdproScriptServer.js`의 `createMdproScriptMiddleware({root,base})` 신규.
2. `vite.config.js`의 `copy-mdpro-runtime.configureServer`가 Vite 내부 transform보다 먼저 middleware를 등록한다. 실제 `server.config.base`를 사용해 root와 `/nested/` 배포 경로 모두 지원한다.
3. `/[base/]mdpro/` 아래 `.js`/`.mjs` GET/HEAD만 읽어 **원문 바이트 그대로** 제공한다. 버전 query는 파일 경로에서 제외한다. MIME은 `text/javascript; charset=utf-8`, 개발 중 `Cache-Control: no-store`, HEAD는 길이만 제공한다.
4. realpath/relative 경계 검사로 런타임 디렉터리 밖의 파일을 거부한다. 잘못된 경로 400, 경계 밖 403, 없는 스크립트 404를 반환한다.
5. React의 `/src/*.jsx`, HTML/CSS/이미지/wasm 및 쓰기 요청은 기존 Vite/프록시에 넘긴다. 빌드의 기존 `cpSync(mdpro,dist/mdpro)`는 유지한다.

```js
configureServer(server) {
  server.middlewares.use(createMdproScriptMiddleware({ base: server.config.base }));
}
```

HWP import/내보내기 함수나 ME·Jena·수식·보기/PV/인쇄/저장 코드는 이번 수정에서 변경하지 않는다. 새 패키지 의존성은 없다. MDpro 런타임은 개발 중에도 정적 script로 제공하므로 해당 script 수정 후에는 페이지 새로고침으로 확인한다. React 개발 서버 처리는 유지한다.

## 실제 검증과 증거

- 수정 전 실제 Vite 재현: SyntaxError 및 후속 storage ReferenceError, 대표 버튼 함수 3개 undefined.
- `node --test tests/mdproScriptServer.test.mjs tests/hwp-core.test.mjs tests/hwp-export-job.test.mjs`: **13/13 통과**. 원문/query/HEAD/MIME/cache/base/ESM/React fallthrough/경로 보호와 기존 HWP 직렬화·취소 등을 확인.
- `tests/viteButtons.browser.cjs`: 실제 Vite `createServer`와 Chrome으로 **`/`, `/nested/`, React host iframe**을 검증. app.js 응답이 디스크 원문과 바이트 동일, 설정 버튼 클릭, 보기/편집 전환, Mermaid 메뉴 클릭/입력 후 렌더/UI 테마 버튼, 실제 `openHwpInEditor`의 동적 모듈 import→선택 dialog→Esc 취소를 확인.
- React 호스트는 가짜 테스트 계정/모의 WebDAV PROPFIND 응답을 사용했다. 실제 NAS/사용자 계정 접속 검증은 아니다.
- 브라우저 예외 세 경우 모두 **0건**. 증거: `artifacts/vite-buttons-20261110/result.json`, `root-buttons.png`, `nested-buttons.png`, `host-settings.png`.
- `node --check vite.config.js`, `node --check src/mdproScriptServer.js`, `git diff --check` 통과.
- `npm run build` 성공. 기존 대형 chunk 안내는 남는다. 빌드가 개발 서버 검증을 대신한 것이 아니다.

재실행:

```powershell
node --test tests/mdproScriptServer.test.mjs tests/hwp-core.test.mjs tests/hwp-export-job.test.mjs
$env:PLAYWRIGHT_MODULE='C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core'
node tests/viteButtons.browser.cjs
npm run build
```

사용자의 기존 개발 서버에는 설정을 확실히 다시 로드하도록 Ctrl+C 후 `npm run dev` 재실행, 브라우저 새로고침을 안내한다. 사용자 데이터/사이트 저장소 삭제는 필요하지 않다.

## 상대 앱 차이·Tauri

Viewer 실제 `js/app.js`에도 동일한 세 동적 import가 있는 것을 읽기 확인했다. 그러나 해당 루트에는 `vite.config.js`가 없으므로 WebDAV 개발 서버용 middleware를 Viewer 런타임에 복사할 근거가 없다. 다른 경로의 개발 서버 유무까지 조사한 것은 아니다. Viewer 수정 없음.

| WebDAV 변경 | Viewer 대응 | 상태 |
| --- | --- | --- |
| `vite.config.js` configureServer | 루트 Vite 설정 없음 | WebDAV 전용 적용 |
| `src/mdproScriptServer.js` | Vite를 도입할 때 서버 측 필요 여부 판단 | 미이식·현재 선행 필요 없음 |
| classic app.js/HWP 모듈 | Viewer에도 동일 동적 import 존재 | 변경하지 않음 |

대기 ID `MDPRO-20261110-VITE-CLASSIC-SCRIPTS`: 런타임 자산/프런트엔드 복사 변경이 없는 서버 수정이므로 이 항목만으로 Tauri 재빌드는 필요하지 않다. 선행 ME AI 등 다른 항목의 대기 상태는 유지한다. 실제 설치 앱/Word/인쇄/PV/실제 HWP 문서 재출력은 이번 개발 서버 수정의 검증 범위 밖이다.

## 다른 앱에서 다시 실행할 명령

```text
대상 앱의 AGENTS.md와 C:/CusorApps/Webdav_md/webdav-md/docs/mdpro-development/changes/2026-11-10-vite-classic-script-buttons.md를 읽어줘.
대상 앱이 Vite에서 classic MDpro 스크립트를 서비스하는지 먼저 확인해줘.
해당하면 script 원문 바이트를 개발 서버 transform 전에 제공하도록 그 서버 구조에 맞춰 적용하고,
모듈화로 기존 전역 함수/inline onclick을 깨뜨리지 마.
root와 중첩 base, 실제 호스트 iframe의 설정/보기/편집/Mermaid 버튼 클릭 및 HWP 동적 import를 Chrome에서 검증해줘.
단순 정적 서버나 빌드 성공으로 개발 서버 검증을 대신하지 마.
Vite를 사용하지 않으면 불필요한 middleware를 가져오지 말고 차이를 기록해줘.
문서·목록·Tauri 영향을 기록하되 별도 요청 없는 빌드/배포/커밋/푸시는 하지 마.
```

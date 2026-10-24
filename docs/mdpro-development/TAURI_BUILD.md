# MDproViewer Tauri 빌드 절차

규칙 ID: `MDPRO-TAURI-BUILD-01` / 확인일: 2026-10-24

## 시작 조건

MDproViewer에서 “타우리앱으로 빌드”, “Tauri 빌드”, “exe/설치파일 생성” 요청을 받으면 이 문서와 [대기 목록](TAURI_BUILD_QUEUE.md), 그 목록이 가리키는 기술문서를 먼저 읽는다. 이 절차를 만들었다는 이유만으로 지금 빌드하지 않는다. 사용자 요청의 대상 기능과 플랫폼·산출물 범위를 우선한다.

`C:\CusorApps\md-viewerVscode\md_viewer`를 기준으로 아래 순서대로 실행한다. 문서에 적힌 경로·버전·명령은 실행 전에 실제 스크립트와 다시 대조한다.

## 1. 소스와 대기 항목 확인

1. `AGENTS.md`, `Docs/mdpro-development/README.md`, 대기 목록, 해당 변경 문서와 수식·인쇄 계약을 읽는다.
2. `git status --short`, `git diff --name-only --diff-filter=U`, 관련 소스 diff를 확인한다. 기존 미커밋 변경은 보존하고 빌드에 실제 포함될 내용을 기록한다. 미커밋이라는 이유만으로 중단하지 않는다.
3. 대기 목록과 실제 구현을 비교한다. 사용자가 문서의 기능을 포함해 빌드하도록 요청했다면 미이식 기능을 먼저 대상 구조에 맞춰 구현·검증한다. 사용자가 현재 소스만 빌드하도록 지정했으면 그 범위대로 진행하며 제외 항목을 기록한다. 애매한 기능을 몰래 추가하거나 제외하지 않는다.
4. `Tauri/package.json`, `Tauri/scripts/build-tauri-frontend.cjs`, `Tauri/src-tauri/tauri.conf.json`, `Cargo.toml`, `Tauri/scripts/publish-tauri-artifacts.cjs`를 확인한다. `MDPRO_VIEWER_SOURCE`가 설정돼 있으면 이 값이 의도한 소스인지 확인하고, 다른 경로라면 기본 저장소를 빌드했다고 주장하지 않는다.
5. Node/npm, Rust/Cargo, Windows 빌드 도구와 NSIS 빌드 가능 여부를 확인한다. 의존성이 이미 있으면 불필요하게 재설치하지 않는다. 빠진 경우 기존 lockfile을 보존하는 프로젝트 방식으로 준비한다. 전역 설정·서명·버전을 임의로 바꾸지 않는다.

2026-10-24 조사에서 `.gitignore` 안에 기존 충돌 마커가 보였다. 이것만으로 Git index가 미해결 병합 상태라고 단정하지 말고 위 명령으로 확인한다. 이 문서 작업에서 그 마커는 수정하지 않았다. 향후 빌드에서 관련 장애가 발생하면 기존 작업을 보호하며 필요한 범위만 처리하고 기록한다.

## 2. 검증 후 프런트엔드 준비

변경 파일의 구문 검사, 해당 기능의 회귀 검사와 실제 보기/PV 검증을 수행한다. 원본 WebDAV에서 통과한 결과는 대상 앱 검사 결과가 아니다. 대상 루트에는 package.json이 없으므로 WebDAV의 `npm run build`를 루트에서 그대로 실행하지 않는다.

대상에 이미 존재하는 수식 테스트 예:

```powershell
node --check js/math_render/math_render.js
node --check js/Markdown_bold.js
node --check js/UI_PV/editpv.js
node --test tests/math-render-contract.test.mjs tests/math-render-regression.test.mjs tests/markdown-bold-math.test.mjs tests/docx-math-export.test.mjs
git diff --check
npm.cmd --prefix Tauri run build
```

해당 기능에 추가한 통계·PV 회귀 검사도 함께 실행한다. 테스트 파일의 존재와 실제 호출 방법을 먼저 확인한다. 위 `npm ... run build`는 **프런트엔드 준비**이며 EXE 생성 명령이 아니다.

확인한 빌드 스크립트는 기본적으로 대상 루트에서 `Tauri/dist`를 재생성한다. `MDPRO_VIEWER_SOURCE`로 소스를 바꿀 수 있고, 생성된 `index.html`의 CDN 자산을 로컬 vendor로 바꾸며, 데스크톱 캐시 파라미터와 서비스 워커 관련 변환을 수행한다. 원본 소스 대신 dist만 고치는 방식은 금지한다. 이 스크립트는 dist를 재생성하므로 실행 전에 실제 output 경로가 이 프로젝트의 `Tauri/dist`인지 확인하고 필요한 수작업 파일이 있으면 보존한다.

일반 JS 파일 비교 예:

```powershell
Get-FileHash js/math_render/math_render.js, Tauri/dist/js/math_render/math_render.js -Algorithm SHA256
Get-FileHash js/Markdown_bold.js, Tauri/dist/js/Markdown_bold.js -Algorithm SHA256
Get-FileHash js/UI_PV/editpv.js, Tauri/dist/js/UI_PV/editpv.js -Algorithm SHA256
```

세 쌍의 SHA256이 각각 같고 새 helper·호출 코드가 포함됐는지 확인한다. 빌드가 변환하는 `index.html`, `latex_render.js`, PWA 설정 등은 무조건 바이트 일치를 요구하지 말고 실제 변환 결과·자산 링크·동작을 확인한다. 코드·스타일·이미지·동적 로드 모듈이 빠지지 않았는지도 확인한다.

## 3. 네이티브 빌드와 설치파일 정리

현재 설정은 `beforeBuildCommand: npm run build`, `frontendDist: ../dist`, 기본 bundle target `nsis`이다. 네이티브 빌드는 beforeBuildCommand를 다시 실행하므로 두 번째 frontend 준비 실패도 확인해야 한다.

```powershell
npm.cmd --prefix Tauri run tauri -- build
```

프로세스가 끝나고 종료 코드 0인지 확인한다. 기존 EXE가 존재한다는 이유만으로 성공으로 처리하지 않는다. 실패하면 그 지점에서 로그와 완료 단계를 기록하고 오래된 설치파일을 새 빌드로 제공하지 않는다.

성공 후 기존 제공 스크립트를 확인하고 실행한다.

```powershell
node Tauri/scripts/publish-tauri-artifacts.cjs
```

이 스크립트는 최신 release EXE와 NSIS가 있는지 확인하고 설치파일을 Tauri 루트로 복사한다. 예전 Tauri 루트의 `mdpro-viewer.exe` 사본은 제거하는 동작이 있으므로 실행 전 그 정확한 경로와 보존 필요 여부를 확인한다. 실행 중이라 제거에 실패하면 프로세스를 임의로 강제 종료하지 말고 원인을 기록한다. 기존 설치파일이 잠겨 있으면 `-setup-new.exe` 대체 이름을 사용할 수 있으므로 로그의 최종 경로를 따른다.

현재 기본 경로(이름·버전·아키텍처·환경 변수는 실행 시 재확인):

| 산출물 | 기본 위치 |
| --- | --- |
| release 실행파일 | `Tauri/src-tauri/target/release/mdpro-viewer.exe` |
| NSIS 원본 | `Tauri/src-tauri/target/release/bundle/nsis/MDpro Viewer_1.0.0_x64-setup.exe` |
| 제공 설치파일 | `Tauri/MDpro Viewer_1.0.0_x64-setup.exe` 또는 `-setup-new.exe` |

`CARGO_TARGET_DIR`가 설정돼 있으면 release/NSIS 경로는 그 값 아래다. 이번 실행에서 생성된 파일의 절대 경로·크기·수정시각·SHA256을 기록하고, 복사한 설치파일이 원본 NSIS와 같은 해시인지 확인한다. 버전은 요청이 없으면 임의로 올리지 않는다.

## 4. 실제 앱 확인과 기록

빌드 요청만으로 사용자 기존 설치를 자동 교체하거나 설치 프로그램을 실행하지 않는다. 검증 가능한 경우 새 실행파일로 실제 WebView2 UI를 열어 변경 기능을 확인하고, 실행/설치가 불가하면 그 단계는 미검증이라고 기록한다. 웹 브라우저 PV가 성공해도 설치 앱·OS 인쇄·Word·저장 PDF까지 성공했다고 보고하지 않는다.

이번 대기 기능의 확인 항목: 통계 별표 1/2/3개, 숫자 뒤 별표, p값 설명, 일반 강조·코드·수식 보존, 넓은 표 연결 번호, 긴 표 페이지 연결 문구, 모든 셀/행/병합/footer와 원문 보존. 네이티브 창의 PV 동작도 확인한다.

완료 시 [대기 목록](TAURI_BUILD_QUEUE.md)에 실행 기록을 추가하고, 변경 기술문서와 README 상태를 갱신한다. 최종 응답은 포함/제외 기능, 웹 검증, frontend 준비, EXE/NSIS 빌드, 실제 앱 검증, 최종 산출물 링크와 한계를 구분한다. 사용자가 이미 빌드를 요청했으면 검증이 끝날 때마다 같은 빌드 허가를 다시 묻지 않고 그 요청 범위까지 진행한다.

# 2026-10-26 Flux-2-Klein-9B-GGUF 실행 오류와 8GB VRAM 프로필

- 변경 ID: MDPRO-20261026-FLUX9B-VRAM
- 원본 작업: `C:\CusorApps\Webdav_md\webdav-md`; 비교 대상: `C:\CusorApps\md-viewerVscode\md_viewer`
- 작성·확인일: 2026-10-26 (Asia/Seoul). 미커밋. 기존 UI/이미지 첨부/얼굴 유지 변경 보존.
- 범위: 이 컴퓨터의 Lemonade 9B 모델 프로필 수정과 재실행·복원 스크립트. 앱 공급자와 모델 이름·모델 파일은 바꾸지 않았다. 상대 앱 런타임·Tauri 빌드·배포는 미실행.

## 요청과 완료 기준

AI Jena에서 Flux-2-Klein-9B-GGUF 사용 시 보이는 `sd-server request failed`를 해결하고 실제 이미지 생성과 참조 이미지 편집을 실행한다. 로더의 ready 응답만으로 생성 성공을 판정하지 않는다.

## 원인과 증거

- Lemonade `2026.42.1`, Windows, RTX 4060 Laptop GPU VRAM 8188 MiB.
- diffusion: `unsloth/FLUX.2-klein-9B-GGUF`의 `flux-2-klein-9b-Q8_0.gguf`; 인코더: `unsloth/Qwen3-8B-GGUF`의 `Qwen3-8B-Q8_0.gguf`; Flux2 VAE 사용.
- 최초 health는 9B를 `ready`로 보고했지만 작은 `images/generations` 요청도 HTTP 500 `generate_image returned no results`로 실패했다. 실제 모델 가중치·작업 메모리 확보는 첫 생성 시 지연 실행되므로 ready만으로 확인할 수 없었다.
- 해당 9B 백엔드만 unload한 뒤 동일 명령의 별도 진단 프로세스(임시 포트 8003, debug 출력)를 실행해 원인을 확인했다. 다른 채팅 모델은 유지했다. 진단 프로세스는 확인 후 종료했다.
- 핵심 로그:

```text
model manager staged compute params (5909.96 MB, 298 tensors, 6 blocks) to CUDA0
reported free 0.00 MB / total 8187.50 MB
cannot make enough memory available on CUDA0: need 601.00 MB device
qwen3 segment 1/1 (graph) failed during workspace capacity check
LLM prompt encoding failed
failed to encode prompt
```

원인은 이 환경의 Qwen3-8B 인코더 GPU 메모리 부족이다. 모델 파일 누락이나 AI Jena의 텍스트/이미지 라우팅 오류로 확인된 것은 아니다. 기본 로딩 시 `sdcpp_args`는 빈 문자열이었다.

## 실제 수정

Lemonade `POST /api/v1/load`로 **해당 9B 모델에만** 아래 옵션을 적용하고 `save_options:true`로 저장했다.

```json
{
  "model_name": "Flux-2-Klein-9B-GGUF",
  "sdcpp_args": "--offload-to-cpu --clip-on-cpu --vae-on-cpu --diffusion-fa --vae-tiling --max-vram 4",
  "save_options": true
}
```

- 인코더·VAE를 CPU에서 처리하고 RAM 오프로딩, diffusion flash attention, VAE 타일링 및 4 GiB GPU 예산을 사용한다. 속도보다 이 8GB 장비의 실행 가능성을 우선한 프로필이다.
- 설치된 `sd-server.exe --help`에서 모든 플래그의 지원을 확인했다. 백엔드 버전: `master-890-74988b2-4-g6dcb5bb`.
- `scripts/configure-flux9b-low-vram.ps1`: 로컬 HTTP 서버만 허용, 진행 중 작업 검사, 원래 모델 custom args 백업, Apply/Restore 지원. 다른 custom args가 있으면 자동 덮어쓰지 않고 병합 검토 오류를 낸다. 글로벌 SD 설정·채팅 모델·모델 파일은 수정하지 않는다.
- `.flux9b-profile-backup.local`에 이 세션의 원래 빈 `sdcpp_args` 백업. `.flux9b-diagnostics.local/`에 초기 health와 진단 출력 보관. 이 파일들은 기존 `*.local` ignore에 따라 로컬 전용이다.
- `scripts/verify-flux9b-edit.mjs`: 실제 `mdpro/js/app.js`의 `generateLemonadeImage` 함수를 불러와 합성 컵 이미지를 512×512 편집 요청으로 전송한다. 인물 사진이나 외부 서비스는 사용하지 않는다.
- 런타임 JS·CSS·HTML을 이번 서버 진단 작업 때문에 추가 수정하지 않았다. 서버 프로필을 브라우저 앱 전체에 강제 하드코딩하지 않는다.

공식 계약: [Lemonade sd-cpp 옵션](https://github.com/lemonade-sdk/lemonade/blob/main/docs/dev/backends-reference.md)의 `sdcpp_args`, [공식 backend 구현](https://github.com/lemonade-sdk/lemonade/blob/main/src/cpp/server/backends/sdcpp/sdcpp_server.cpp)의 custom args 전달 및 이미지 편집 경로를 확인했다. 최종 플래그 지원은 설치된 바이너리의 help를 기준으로 했다.

## 검증

- 수정 전: 256×256 신규 생성도 HTTP 500. 진단 로그에서 VRAM workspace 확보 실패 재현.
- 수정 후: Lemonade API로 256×256, 4 steps, CFG 1의 빨간 컵 생성 HTTP 200, 이미지 1개. PNG를 실제로 열어 정상 컵 이미지 확인.
- 저장 후 health: 9B `status:ready`, 지정한 `recipe_options.sdcpp_args` 확인. 채팅 모델 Gemma-4-E4B-it-GGUF 유지.
- Node 검증 스크립트 `node --check`, PowerShell AST parser, `git diff --check` 통과.
- 512×512 참조 편집: `node scripts/verify-flux9b-edit.mjs flux9b-diagnostic.png flux9b-edit-512.png` 종료 0, 실제 Lemonade 응답 이미지 1개, 약 60초. 결과 PNG를 열어 빨간 컵이 파란 컵으로 편집된 것을 확인했다. 사용 함수는 실제 `generateLemonadeImage`, multipart 파일 업로드·4 steps·CFG 1이다.
- `scripts/configure-flux9b-low-vram.ps1` Apply를 실제 실행하여 성공 확인. 그 뒤 9B만 unload하고 옵션을 생략한 `/load`로 다시 로드했으며 저메모리 `sdcpp_args` 유지와 Gemma 채팅 모델 유지 확인. Restore 명령은 구문 검사만 수행했으며 실제 실행하지 않았다.
- 증거 이미지: [신규 생성 256](evidence/2026-10-26-flux9b-generation.png), [참조 편집 512](evidence/2026-10-26-flux9b-edit-512.png). 기본 프롬프트는 합성 컵이며 사용자 인물 사진은 사용하지 않았다.
- 이번 변경은 서버 프로필·지원 스크립트·문서뿐이므로 프런트엔드 빌드 및 UI 회귀 검사를 다시 실행하지 않았다. 앞선 코드 작업의 검사·빌드 결과와 구분한다.
- 실제 인물 얼굴 품질, 모바일 UI, 서버 재시작 이후, 다른 GPU/OS, 온라인 배포·설치 앱은 별도 미검증. 모델·화질·프롬프트·참조 크기에 따라 처리 시간이 늘 수 있다.

## 상대 앱 대응표와 Tauri 영향

| 원본 경로/설정 | 대상 대응 | 차이·적용 상태 |
| --- | --- | --- |
| Lemonade 9B `recipe_options.sdcpp_args` | 동일 PC의 같은 Lemonade 서버 | 서버에 저장한 프로필이므로 같은 서버에 접속하면 공유된다. 대상 코드 이식을 의미하지 않음 |
| `mdpro/js/app.js` / `generateLemonadeImage`, `AIChatBridge.loadLemonadeModel` | `js/app.js` / `generateLemonadeChatImage`와 대상 로더 | 앞서 확인한 대상은 독립 OpenAI 호환 공급자 경로. 이번에는 서버 프로필만 수정했으므로 대상 파일 수정 불필요 |
| `scripts/configure-flux9b-low-vram.ps1` | 대상 환경의 별도 지원 스크립트 | 다른 PC에서는 GPU·RAM·플래그 지원부터 확인. 8GB 프로필을 모든 장비에 자동 적용하지 말 것 |

대기 ID: MDPRO-20261026-FLUX9B-VRAM. Tauri 자산 변경 없음·네이티브 재빌드 불필요. 설치 앱 실제 생성 검증은 미실행이며 요청 시 별도로 수행한다.

## 재실행과 복원

```powershell
pwsh -File scripts/configure-flux9b-low-vram.ps1
pwsh -File scripts/configure-flux9b-low-vram.ps1 -Mode Restore
```

```text
C:\CusorApps\md-viewerVscode\md_viewer에서 AGENTS.md와 C:\CusorApps\Webdav_md\webdav-md\docs\mdpro-development\changes\2026-10-26-flux9b-low-vram.md를 읽어줘. 같은 PC의 Lemonade Flux-2-Klein-9B-GGUF에 저장된 저메모리 프로필을 health 및 실제 이미지 편집으로 확인해줘. 모델을 ready로 보고하는 것만으로 성공 처리하지 말고 실제 생성 PNG를 확인해줘. 다른 PC라면 GPU VRAM과 설치 sd-server의 플래그 지원을 먼저 확인하고 기존 custom args를 백업·보존해줘. 관련 없는 모델을 종료하거나 런타임 파일을 통째로 복사하지 말고 문서·목록 상태를 갱신해줘. 네이티브 자산 변경이 없으므로 Tauri 빌드는 실행하지 마.
```

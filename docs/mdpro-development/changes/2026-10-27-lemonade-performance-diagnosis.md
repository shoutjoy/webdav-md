# Lemonade 연결·추론 지연 진단

- 점검일: 2026-10-27
- 범위: 로컬 서버·장치·실제 추론·앱 전송 코드 읽기 점검. 런타임 코드·서버 설정·모델 상주 상태 변경 없음.
- 사용자 정정: 속도가 느린 대상은 이 PC가 아니라 별도의 NPU 컴퓨터이다. 아래 수치는 현재 GPU PC에서 측정한 참고 자료이며, 대상 NPU 컴퓨터의 고장 여부·지연 원인에 대한 진단 결과가 아니다. 대상 컴퓨터의 장치·모델·로그·요청은 미확인이다.

## 확인 결과

1. `http://127.0.0.1:13305/api/v1/health`는 200, `status=ok`, 버전 `2026.42.1`. 최초 health 274ms, models 6ms, stats 4ms. 후속 health는 localhost 22ms, 127.0.0.1 1.5ms. 서버 접속 자체의 장시간 지연은 재현되지 않았다.
2. 로드된 채팅 모델은 `Gemma-4-12B-it-GGUF`, recipe `llamacpp`, CUDA/GPU. 이미지 모델 `Flux-2-Klein-9B-GGUF`도 상주한다. CPU 조회는 `13th Gen Intel(R) Core(TM) i7-13620H`, PnP 장치명 NPU/Neural/IPU/Ryzen AI/Compute Accelerator 검색 결과 없음. `/models?show_all=true`에도 FLM 항목이 없었다. 현재 확인한 구성에서 NPU 추론을 사용 중이라는 근거가 없다. 장치명 검색만으로 모든 종류의 외부 장치 존재를 단정하지 않는다.
3. `nvidia-smi`: RTX 4060 Laptop GPU, VRAM 8188MiB 중 7780MiB 사용(약 95%). 이미지·채팅 모델 및 별도 Ollama llama-server 동시 존재. 각 프로세스의 VRAM 점유율 및 메모리 압박이 지연에 기여하는 정도는 측정하지 않았다.
4. `C:\Users\USER\AppData\Local\Temp\lemonade-server.log`: `MDproViewer AI Jena model load`가 10:38:04.609 시작, 기존 26B 퇴거 후 12B CUDA 로드, 10:38:29.123 완료. 총 약 24.5초. 이 구간의 긴 연결 대기는 실제 모델 교체·초기화 시간으로 설명된다. 로그상 로드 실패가 아니다.
5. 현재 12B 모델에 32토큰 제한 스트림 2회: 총 2.87/2.09초, 서버 TTFT 0.922/0.171초, 생성 16.23/16.28토큰/초. 기본 추론이 활성화되어 두 요청 모두 reasoning만 생성하다 길이 제한에 도달했다. 완성 답변 성공으로 집계하지 않는다.
6. 같은 짧은 질문, 128토큰 제한, `chat_template_kwargs.enable_thinking=false`: 1.25초, `Two plus two is four.`, 7토큰, stop. true: 8.26초, 128토큰 reasoning만 생성, length. 응답성 차이를 확인했으며 긴 실제 사용자 질문의 속도를 보장하는 수치는 아니다. 두 실행의 프롬프트 캐시 조건은 다르다.
7. Lemonade 데스크톱 `AppData/Roaming/lemonade/app_settings.json`에는 enableThinking.value=true/useDefault=true. WebDAV `mdpro/js/app.js`의 Lemonade 요청은 reasoning 모드에서만 thinking을 켜고 quick/FAST에서 끄는 코드가 이미 있다. 따라서 데스크톱 설정을 WebDAV 현재 세션 설정으로 간주하지 않는다. 실제 사용자가 선택한 화면·모드와 브라우저 요청은 이번에 확인하지 않았다.

## 코드 확인과 상대 앱 차이

- WebDAV `src/lemonadeProxy.js`: 로컬 13305 프록시. `mdpro/js/app.js:getNPUBaseUrl/listNPUModels/callNPUChat`: FLM 모델만 선택하는 NPU 별도 경로. FLM 모델이 없는 현재 서버에서 이 경로를 사용할 수 없다.
- WebDAV 일반 Lemonade 요청은 `chat_template_kwargs.enable_thinking`, `enable_thinking`, `thinking`을 모드에 맞춰 전달한다. NPU 경로에는 동일한 추론 제어가 없다. 이번 환경에서는 FLM 부재로 NPU 실측 불가.
- Viewer `C:\CusorApps\md-viewerVscode\md_viewer\js\app.js` 읽기 확인: 별도 NPU 경로, `/models` 조회, enable_thinking=false 전송 위치가 있다. WebDAV의 `/models?show_all=true` 및 모드별 제어와 차이가 있으므로 전체 파일 덮어쓰기 금지. 대상 수정·이식 없음.

## 판정과 후속 작업

현재 GPU PC에서는 서버 고장이나 모델 로드 실패가 재현되지 않았다. 이 PC에서 확인된 대기 요인은 모델 전환 시 약 24.5초 로드와 추론 활성화 시 답변 전 reasoning 생성이다. VRAM 여유 부족은 추가 성능 저하 가능성이 있으나 인과관계는 미확정이다. 이 결과로 별도 NPU 컴퓨터가 정상이라고 판정하거나 그 컴퓨터의 지연을 GPU 메모리·모델 교체 문제로 설명할 수 없다.

실제 후속 점검은 문제가 발생한 NPU 컴퓨터에서 수행해야 한다. 서버 버전, NPU 장치·드라이버 상태, 설치된 FLM 모델, health의 실제 backend/device, 연결·모델 로드 시간, 첫 토큰·첫 본문 시간, 생성 속도, 서버 로그와 요청 payload를 수집한다. GPU PC의 모델·메모리 구성을 대상에 그대로 적용하지 않는다. 이번 점검에서는 타 작업의 상주 모델이나 사용 설정을 변경하지 않았다.

재명령 프롬프트:

> 문제가 발생한 별도의 NPU 컴퓨터에서 `docs/mdpro-development/changes/2026-10-27-lemonade-performance-diagnosis.md`를 읽고 Lemonade 지연을 점검하라. 문서의 GPU PC 수치를 대상 NPU의 진단 결과로 사용하지 마라. 실제 사용 앱·모드·요청 payload, 서버 버전, NPU 장치·드라이버, FLM 모델과 backend/device를 확인하라. 연결 시간, 모델 교체 시간, 첫 토큰, 첫 본문, 생성 속도를 구분해서 측정하고 서버 로그와 대조하라. quick/FAST의 thinking=false 동작을 보존하고 확인된 원인만 수정하라. 기능을 삭제하지 말고 상대 앱 고유 코드를 보존하며 코드 변경 시 기술문서·목록·Tauri 대기 상태와 관련 검증을 갱신하라.

## 검증·빌드 상태

- 실제 로컬 API·스트림·비스트림 비교 수행. 테스트 중 사용 모델 변경 없음.
- 브라우저 UI, 실제 NPU 추론, 장문 성능, 이미지 모델 해제 전후, GPU 메모리 기여도 미검증.
- 문서만 추가. 코드 검사·웹 빌드·상대 런타임 수정·Tauri 빌드·설치 앱 검증 미실행. 네이티브에 반영할 자산 변경 없음.

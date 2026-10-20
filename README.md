# 청기백기 · AI Motion Play

오픈랩 AI 체험 부스 기획안을 바탕으로 만든 웹캠 기반 청기백기 웹 게임입니다. Vite와 MediaPipe Pose Landmarker를 사용합니다.

## 실행

Node.js 22.12 이상 또는 24 이상을 사용하세요.

```sh
npm ci
npm run dev
```

브라우저에서 개발 서버를 열고 **카메라 연결하기**를 누른 뒤 카메라 권한을 허용하세요. 양쪽 어깨·팔꿈치·손목이 화면에 보이면 게임 시작이 활성화됩니다. 카메라는 **HTTPS 또는 localhost**에서만 사용할 수 있습니다. 원격 접속 시 HTTPS로 제공하세요. Chrome / Edge 최신 버전을 권장합니다.

```sh
npm test        # 팔 판정·명령·난이도 테스트
npm run build  # dist/ 생성
npm run preview
```

## 게임 규칙

- 참가자의 **오른팔 = 청기**, **왼팔 = 백기**입니다. 영상과 관절은 거울처럼 표시합니다.
- 손목이 어깨보다 충분히 위에 있으면 올림, 아래에 있으면 내림으로 판정합니다. 어깨 근처는 전환 중으로 취급합니다.
- 양팔의 관절이 모두 인식되고 지시한 자세를 350ms 유지해야 성공합니다. 지시하지 않은 팔은 자유입니다.
- 2분 동안 진행합니다. 기본 성공 점수는 100점이며, 연속 성공마다 10점씩 추가합니다(보너스 최대 100점).
- 처음 5개 지시는 단일 동작입니다. 이후 복합 지시가 추가되고, 5개 지시마다 제한 시간이 0.5초씩 줄어듭니다(5초 → 최소 2초).
- 인식이 끊기면 성공 판정을 중단하지만 게임 시간은 계속 흐릅니다. 화면에서 다른 탭으로 이동하거나 카메라 연결이 끊기면 결과를 표시합니다.
- 정확도는 완료된 지시의 성공 횟수 / (성공 + 시간 초과)입니다. 종료 순간 진행 중이던 지시는 제외합니다.

## AI 모델과 네트워크

WASM 런타임은 `npm ci`의 postinstall에서 `public/wasm/`에 복사되어 앱과 함께 제공됩니다. 모델은 최초 카메라 연결 시 Google 공식 배포 주소에서 다운로드합니다.

```text
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

실행하는 브라우저에서 `storage.googleapis.com` 접근이 가능해야 합니다. 현재 클라우드에서는 이 주소가 네트워크 정책의 403으로 차단되어, 허용 도메인을 환경 설정 초안에 추가했습니다. 설정 저장·적용 후 실제 모델 다운로드와 웹캠으로 확인해야 합니다.

행사장에서 외부 연결 없이 운영하려면 미리 공식 모델을 내려받아 로컬로 제공하세요.

```sh
mkdir -p public/models
curl -fL https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task -o public/models/pose_landmarker_lite.task
VITE_POSE_MODEL_URL=/models/pose_landmarker_lite.task npm run dev
# 배포용으로 빌드할 때에도 같은 환경변수를 지정합니다.
VITE_POSE_MODEL_URL=/models/pose_landmarker_lite.task npm run build
```

모델과 WASM 생성물은 Git에서 제외합니다. 배포할 때는 `npm ci` 후 빌드하세요. 개인정보나 API 키 설정은 필요하지 않습니다. 카메라 영상은 브라우저의 메모리에서만 처리하며 서버 전송·녹화·저장 기능이 없습니다. 카메라 끄기 또는 페이지 종료 시 미디어 트랙을 중지합니다.

## 검증 범위

- 팔 상태·신뢰도·좌우 매핑·정답 판정·명령 생성·난이도 단위 테스트 5개 통과.
- 프로덕션 빌드와 개발 서버 HTML/WASM 응답 확인.
- 헤드리스 Chromium에서 데스크톱/모바일 레이아웃, 권한 거부 후 재시도, 관절 표시 토글 확인.
- 모의 카메라/관절 입력으로 인식 → 시작 → 성공/점수/연속 성공 → 결과 → 재시작 → 연결 해제 흐름 확인.
- 실제 카메라의 자세 인식 정확도와 모델 초기화는 이 클라우드에서 미검증입니다. 행사 전 실제 장비·조명·거리에서 확인하세요.

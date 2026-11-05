# TILON GPU 활용 기록

CatchUp AI 개발 중 TILON GPU 환경에서 수행한 두 가지 실험의 **결과 파일과 확인된 내용**을 정리합니다. 이 문서에는 결과 파일에서 직접 확인되는 내용만 적었습니다.

> **Qwen은 별도 GPU 실험이며 배포 서비스에는 연결되어 있지 않습니다.**
> https://catchup-ai-liart.vercel.app/ 의 요구사항 추출·변경 탐지·코드 비교는 모두 **OpenAI API**로 동작합니다. SDXL Turbo 결과물만 서비스 화면(`public/gpu-hero.png`)에 쓰였습니다.

## 파일

| 파일 | 내용 |
|---|---|
| [`results/qwen/catchup_requirements.json`](results/qwen/catchup_requirements.json) | Qwen2.5-1.5B-Instruct 요구사항 추출 실험(Greedy / Temperature 0.7)의 프롬프트·설정·생성 결과 |
| [`results/sdxl/text2img_5c3d0963fcc2.json`](results/sdxl/text2img_5c3d0963fcc2.json) | SDXL Turbo 이미지 생성 설정(프롬프트·시드·단계·해상도) |
| [`../public/gpu-hero.png`](../public/gpu-hero.png) | 위 SDXL 설정으로 생성한 이미지. 서비스 메인 화면에 적용됨 |

**포함하지 않은 것**: 실험을 실행한 Jupyter 노트북(`workshop.ipynb`)은 이번에 내려받은 파일에 없어 이 저장소에 포함하지 못했습니다. 실험 조건은 위 JSON의 `prompt`와 `settings`로 확인할 수 있습니다. 두 JSON 모두 모델 이름을 기록하지 않았으며, 사용한 모델은 TILON 워크숍 실습 구성(Qwen2.5-1.5B-Instruct, SDXL Turbo)에 따른 것입니다.

## 1. Qwen2.5-1.5B-Instruct — 요구사항 추출 비교 실험

### 목적
소형 오픈 모델이 회의록에서 요구사항·결정 상태·원문 근거를 뽑는 데 얼마나 믿을 만한지, **디코딩 설정(Greedy와 Temperature 0.7)** 에 따라 어떻게 달라지는지 시험했습니다.

### 조건
- 입력: CatchUp AI 개발 회의를 가정한 5문장짜리 회의록 1건 (확정 3건 성격, 제안 1건, 보류 1건 포함. 전문은 JSON의 `prompt` 필드)
- 출력 형식: `요구사항 / 결정 상태(확정·제안·미확정) / 원문 근거` 3줄 형식, 원문 그대로 인용하도록 지시
- 공통: `seed` 42, `max_new_tokens` 384, `top_p` 1.0, `top_k` 0, `repetition_penalty` 1.0, `num_beams` 1

| 구분 | Greedy | Temperature 0.7 |
|---|---|---|
| `do_sample` | `false` | `true` |
| `temperature` | 사용 안 함 | 0.7 |
| 생성 토큰 | 286 | 322 |
| 생성 시간 | 5.298초 | 5.872초 |
| 출력 항목 수 | 4 | 5 |

### 관찰된 사례
아래는 JSON에 저장된 출력 텍스트를 원문 회의록과 대조해 확인한 내용입니다.

| 유형 | 관찰 | Greedy | Temp 0.7 |
|---|---|---|---|
| 원문 근거 불일치 | "기본 브랜치와 최신 커밋을 조회" 요구사항의 근거로 다른 요구사항의 문장("오늘 회의에서는 AI가 …")을 인용함. 인용 문장은 원문에 실제로 있지만 해당 요구사항을 뒷받침하지 않음 | 있음 | 있음 |
| 근거 불일치 (결정 상태 항목) | 제안 문장("리포트에 코드 파일 경로와 라인 번호를 표시하자는 제안")의 근거로 관리자 기능 문장을 인용함 | 있음 | 있음 |
| 중복 요구사항 | 같은 요구사항("AI가 회의록에서 요구사항을 자동 추출")을 같은 인용과 함께 반복 출력함 | 2회 반복(항목 2·4) | 2회 반복(항목 2·4) |
| 결정 상태 오분류 | 원문상 **제안**인 항목을 **미확정**으로 분류함 | 있음 | 있음 |
| 허용되지 않은 값 | 결정 상태 칸에 `확정/제안/미확정`이 아닌 `MISMATCH`, `UNKNOWN`이 출력됨 (구현 상태 용어가 섞임) | 없음 | 있음 (2건) |
| 문장 깨짐 | 요구사항이 "…구현하기"로 끝나는 불완전한 문장이 됨 | 없음 | 있음 (3건) |
| 누락 | "구현 상태를 VERIFIED, PARTIAL, MISMATCH, UNKNOWN 네 가지로 분류하기로 했다"가 추출되지 않음 | 누락 | 누락 |
| 누락 | "관리자 기능 추가 여부는 다음 회의에서 결정한다"(미확정 항목)가 요구사항으로 추출되지 않음 | 누락 | 추출됨(단, 결정 상태 `UNKNOWN`) |

### 해석 시 주의
- **입력 1건, 설정당 1회 실행**한 결과입니다. 두 설정의 우열이나 오류율 같은 통계는 낼 수 없으며, 이 표는 "이런 유형의 문제가 실제로 관찰되었다"는 사례 기록입니다.
- Greedy가 항상 더 정확하다고 결론 내릴 수 없습니다. 다만 이 실행에서는 Temperature 0.7에서 형식 위반(허용되지 않은 값, 불완전한 문장)이 추가로 나타났습니다.

### 서비스에 반영된 방식
같은 유형의 문제에 대해 서비스는 모델 출력을 그대로 쓰지 않는 구조를 택했습니다. 이 구조는 OpenAI API 기반 분석에 적용되어 있으며, Qwen 출력을 서비스가 사용하지는 않습니다.

| 관찰된 문제 | 서비스의 대응 (`lib/`) |
|---|---|
| 허용되지 않은 결정 상태 값 | 결정 상태를 `confirmed / suggestion / undecided`로 한정한 JSON Schema(Structured Outputs `strict`)로 요청하고 서버가 다시 검증 |
| 원문에 없는 인용 | 서버가 인용문이 입력 문서에 그대로 있는지 대조하고, 틀리면 결과를 쓰지 않음 (`lib/extract/quote.ts`) |
| 중복 요구사항 | 프롬프트에서 같은 의미의 항목을 합치도록 지시 |
| 제안·보류의 처리 | 제안은 `MISMATCH`로, 미확정은 구현 여부 판정 대상으로 보지 않도록 서버 정책으로 제한 (`lib/compare/policy.ts`) |

한계도 있습니다. 이 실험의 "근거 불일치" 사례는 **인용문이 원문에 실제로 있어도 요구사항을 뒷받침하지 않을 수 있음**을 보여 줍니다. 서비스의 인용 검증은 "원문에 있는가"를 확인하며, "그 문장이 해당 요구사항을 뒷받침하는가"는 AI 판단에 의존합니다. 메인 README의 한계 항목에도 같은 내용을 적었습니다.

## 2. SDXL Turbo — 메인 히어로 이미지 생성

### 생성 설정
`results/sdxl/text2img_5c3d0963fcc2.json`에 기록된 값입니다.

| 항목 | 값 |
|---|---|
| 프롬프트 | `Premium 3D SaaS illustration, laptop with blank blue screen, three floating glass panels representing documents code and verification, white studio background, royal blue accents, subtle shadows, clean geometric design, no writing` |
| seed | 42 |
| steps | 2 |
| guidance_scale | 0.0 |
| 해상도 | 512 × 512 |
| 생성 시간 | 0.968초 |
| 결과 파일명 | `text2img_5c3d0963fcc2.png` |

### 서비스 반영
- TILON에서 내려받은 `text2img_5c3d0963fcc2.png`와 서비스의 [`public/gpu-hero.png`](../public/gpu-hero.png)는 **바이트 단위로 동일한 파일**입니다 (SHA-256 `E4497E64518B08F7174523054961EB126922E59373183FD2B7A2DF5D7AF4BC51`). 같은 파일을 중복해서 두지 않고 `public/gpu-hero.png`만 사용합니다.
- 적용 위치: `app/(marketing)/page.tsx`의 히어로 영역 (`next/image`로 표시, 가장자리를 마스크로 흐려 배경과 섞음)

![SDXL Turbo로 생성한 히어로 이미지](../public/gpu-hero.png)

## 요약

| 항목 | 사용 | Production 서비스 반영 |
|---|---|---|
| Qwen2.5-1.5B-Instruct | 요구사항 추출 비교 실험 (GPU) | 반영 안 됨. 문제 유형 관찰과 설계 참고용 |
| SDXL Turbo | 히어로 이미지 생성 (GPU) | 반영됨 — `public/gpu-hero.png` |
| OpenAI API | 요구사항 추출·변경 탐지·코드 비교 | 반영됨 — 실제 서비스의 AI 분석 |

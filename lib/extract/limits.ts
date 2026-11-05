import { LIMITS } from "../validate.ts";

// 대회용 공용 키를 아끼기 위한 상한. 정상 분석 한 번에 모델 호출은 한 번이다.
export const EXTRACT_LIMITS = {
  nameMax: LIMITS.name,
  textMin: LIMITS.textMin,
  textMax: LIMITS.textMax,
  /** 요구사항 최대 개수 */
  maxItems: 30,
  /** 모델 출력 상한(추론 토큰 포함) */
  maxOutputTokens: 6000,
  /** 모델 호출 한 번의 제한 시간(ms) */
  callTimeoutMs: 40_000,
  /** 요청 전체 제한 시간(ms) */
  totalTimeoutMs: 55_000,
  /** 모델 호출 최대 횟수 (최초 1회 + 재시도 1회) */
  maxAttempts: 2,
  /** 재시도를 시작하려면 남아 있어야 하는 시간(ms) */
  retryMinRemainingMs: 12_000,
  titleMax: 120,
  descriptionMax: 600,
  quoteMin: 6,
  quoteMax: 500,
  ambiguityMax: 300,
} as const;

/** IP당 요청 빈도 제한 */
export const RATE_LIMIT = {
  windowMs: 10 * 60_000,
  maxPerWindow: 8,
  maxConcurrentPerClient: 1,
  /** 서버 인스턴스 전체 상한 (1시간) */
  globalWindowMs: 60 * 60_000,
  globalMax: 120,
} as const;

export const DEFAULT_MODEL = "gpt-5-mini";

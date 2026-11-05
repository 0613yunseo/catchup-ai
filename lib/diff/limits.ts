import { EXTRACT_LIMITS as E } from "../extract/limits.ts";

// 변경 비교 상한. 모델 호출은 정상 경로에서 한 번이다. (검증 실패 때만 한 번 더)
export const DIFF_LIMITS = {
  nameMax: E.nameMax,
  /** 회의록 하나의 글자 수 범위 (단일 분석과 같다) */
  textMin: E.textMin,
  textMax: E.textMax,
  /** 변경 항목 최대 개수 */
  maxItems: 40,
  maxOutputTokens: 9000,
  titleMax: E.titleMax,
  descriptionMax: E.descriptionMax,
  quoteMin: E.quoteMin,
  quoteMax: E.quoteMax,
  summaryMax: 400,
  reasonMax: E.ambiguityMax,
} as const;

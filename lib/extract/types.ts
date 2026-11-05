// 요구사항 추출 타입. 서버 모듈, API 응답, 화면이 함께 쓴다. (런타임 코드 없음)
import type { InputType } from "../validate.ts";

export type DecisionType = "confirmed" | "suggestion" | "undecided";
export type ChangeType = "new" | "changed" | "removed" | "unspecified";

/**
 * 추출된 요구사항 한 건. 구현 여부는 아직 판정하지 않는다.
 * sourceType은 lib/report.ts의 Requirement.source와 같은 값(InputType)이다.
 */
export type ExtractedRequirement = {
  /** 서버가 순서대로 붙이는 식별자 (R-1, R-2 ...). 재분석 시 같은 id가 유지된다는 보장은 없다. */
  id: string;
  title: string;
  /** 이후 코드와 비교할 수 있는 구체적 구현 조건 */
  description: string;
  sourceType: InputType;
  /** 입력 문서에서 그대로 가져온 근거 문장. 서버가 실제 존재 여부를 검증했다. */
  sourceQuote: string;
  decisionType: DecisionType;
  changeType: ChangeType;
  /** 불확실한 점. 확실하면 null */
  ambiguity: string | null;
};

export type ExtractRequest = {
  projectName: string;
  documentType: InputType;
  text: string;
};

export type ExtractUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** 모델 호출 횟수 (재시도 포함) */
  attempts: number;
  durationMs: number;
};

export type ExtractResponse = {
  projectName: string;
  documentType: InputType;
  requirements: ExtractedRequirement[];
  count: number;
  /** ISO 8601 */
  extractedAt: string;
  model: string;
  usage: ExtractUsage;
};

export type ExtractErrorCode =
  | "INVALID_REQUEST"
  | "INPUT_TOO_LONG"
  | "NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "BUSY"
  | "MODEL_UNAVAILABLE"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "NETWORK"
  | "MODEL_REFUSED"
  | "OUTPUT_TRUNCATED"
  | "INVALID_OUTPUT"
  | "INTERNAL";

export type ExtractErrorInfo = {
  code: ExtractErrorCode;
  message: string;
  retryAfterSec?: number;
};

export type ExtractOutcome =
  | { ok: true; data: ExtractResponse }
  | { ok: false; error: ExtractErrorInfo };

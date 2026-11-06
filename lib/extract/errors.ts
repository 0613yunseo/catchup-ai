import type { ExtractErrorCode, ExtractErrorInfo } from "./types.ts";

export const MESSAGES: Record<ExtractErrorCode, string> = {
  INVALID_REQUEST: "요청 형식이 올바르지 않습니다. 프로젝트 이름, 문서 유형, 문서 내용을 확인해 주세요.",
  INPUT_TOO_LONG: "문서가 너무 깁니다. 길이를 줄여서 다시 시도해 주세요.",
  NOT_CONFIGURED: "AI 분석 기능이 아직 준비되지 않아 사용할 수 없습니다. 서비스 관리자에게 문의해 주세요.",
  AUTH_FAILED: "AI 분석 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속되면 서비스 관리자에게 문의해 주세요.",
  QUOTA_EXCEEDED: "현재 AI 분석 사용량이 한도에 도달해 분석할 수 없습니다. 잠시 후 다시 시도하거나 서비스 관리자에게 문의해 주세요.",
  RATE_LIMITED: "AI 요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
  BUSY: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
  MODEL_UNAVAILABLE: "AI 분석 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
  MODEL_NOT_FOUND: "AI 분석 서비스 설정에 문제가 있어 분석할 수 없습니다. 서비스 관리자에게 문의해 주세요.",
  TIMEOUT: "AI 응답이 너무 오래 걸려 중단했습니다. 문서를 줄이거나 다시 시도해 주세요.",
  NETWORK: "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  MODEL_REFUSED: "AI가 이 내용의 분석을 거부했습니다. 문서 내용을 확인한 뒤 다시 시도해 주세요.",
  OUTPUT_TRUNCATED: "분석할 내용이 많아 AI 응답이 중간에 끊겼습니다. 문서를 나누거나 길이를 줄여 다시 시도해 주세요.",
  INVALID_OUTPUT:
    "AI가 원문과 일치하는 결과를 만들지 못해 이번 결과를 사용하지 않았습니다. 같은 입력으로 다시 시도하면 다른 결과가 나올 수 있습니다.",
  INTERNAL: "분석하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export class ExtractError extends Error {
  code: ExtractErrorCode;
  retryAfterSec: number | undefined;

  constructor(code: ExtractErrorCode, retryAfterSec?: number, message?: string) {
    super(message ?? MESSAGES[code]);
    this.name = "ExtractError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }

  toInfo(): ExtractErrorInfo {
    return { code: this.code, message: this.message, retryAfterSec: this.retryAfterSec };
  }
}

export function httpStatusFor(code: ExtractErrorCode): number {
  switch (code) {
    case "INVALID_REQUEST":
      return 400;
    case "INPUT_TOO_LONG":
      return 413;
    case "BUSY":
    case "RATE_LIMITED":
      return 429;
    case "NOT_CONFIGURED":
      return 503;
    case "QUOTA_EXCEEDED":
      return 402;
    case "TIMEOUT":
      return 504;
    case "MODEL_UNAVAILABLE":
    case "MODEL_NOT_FOUND":
    case "NETWORK":
    case "AUTH_FAILED":
    case "MODEL_REFUSED":
    case "OUTPUT_TRUNCATED":
    case "INVALID_OUTPUT":
      return 502;
    default:
      return 500;
  }
}

// 제3자 라이브러리의 오류 객체를 구조만 보고 분류한다. 메시지 본문은 사용자에게 보여 주지 않는다.
type ApiLikeError = {
  name?: string;
  status?: number;
  code?: string | null;
  message?: string;
  headers?: { get?: (k: string) => string | null } | null;
  error?: { code?: string | null } | null;
};

export function classifyModelError(e: unknown): ExtractError {
  if (e instanceof ExtractError) return e;
  const err = (e ?? {}) as ApiLikeError;
  const code = err.code ?? err.error?.code ?? "";
  if (err.name === "APIConnectionTimeoutError" || err.name === "TimeoutError" || err.name === "AbortError") {
    return new ExtractError("TIMEOUT");
  }
  if (err.name === "APIConnectionError" || err.status === undefined) return new ExtractError("NETWORK");
  const status = err.status;
  if (status === 401 || status === 403) return new ExtractError("AUTH_FAILED");
  if (status === 429) {
    if (code === "insufficient_quota" || /quota|billing/i.test(err.message ?? "")) return new ExtractError("QUOTA_EXCEEDED");
    const ra = Number(err.headers?.get?.("retry-after"));
    return new ExtractError("RATE_LIMITED", Number.isFinite(ra) && ra > 0 ? Math.ceil(ra) : undefined);
  }
  if (status === 404 || code === "model_not_found") {
    return new ExtractError("MODEL_NOT_FOUND");
  }
  if (status >= 500) return new ExtractError("MODEL_UNAVAILABLE");
  return new ExtractError("INTERNAL");
}

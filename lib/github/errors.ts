import type { InspectErrorCode, InspectErrorInfo } from "./types.ts";

const DEFAULT_MESSAGES: Record<InspectErrorCode, string> = {
  INVALID_REQUEST: "요청 형식이 올바르지 않습니다.",
  INVALID_URL: "https://github.com/소유자/저장소 형식의 공개 저장소 주소를 입력해 주세요.",
  NOT_FOUND: "저장소를 찾을 수 없습니다. 주소를 확인하세요. 존재하지 않거나 비공개 저장소일 수 있습니다.",
  PRIVATE_REPOSITORY: "비공개 저장소는 조회할 수 없습니다. 공개 저장소만 지원합니다.",
  EMPTY_REPOSITORY: "저장소에 커밋이 없어 조회할 코드가 없습니다.",
  RATE_LIMITED: "GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
  FORBIDDEN: "GitHub가 이 저장소에 대한 접근을 허용하지 않습니다.",
  UNAVAILABLE_FOR_LEGAL_REASONS: "법적 사유로 GitHub에서 제공되지 않는 저장소입니다.",
  GITHUB_UNAVAILABLE: "GitHub 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
  AUTH_FAILED: "서버의 GitHub 인증 설정에 문제가 있습니다. 관리자에게 문의하세요.",
  TIMEOUT: "GitHub 응답이 너무 오래 걸려 조회를 중단했습니다. 다시 시도해 주세요.",
  NETWORK: "GitHub에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.",
  INTERNAL: "저장소를 조회하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export class GithubError extends Error {
  code: InspectErrorCode;
  retryAfterSec: number | undefined;

  constructor(code: InspectErrorCode, retryAfterSec?: number, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "GithubError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }

  toInfo(): InspectErrorInfo {
    return { code: this.code, message: this.message, retryAfterSec: this.retryAfterSec };
  }
}

export const ERROR_MESSAGES = DEFAULT_MESSAGES;

/** 오류 코드 → HTTP 상태 */
export function httpStatusFor(code: InspectErrorCode): number {
  switch (code) {
    case "INVALID_REQUEST":
    case "INVALID_URL":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "PRIVATE_REPOSITORY":
    case "FORBIDDEN":
      return 403;
    case "EMPTY_REPOSITORY":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "UNAVAILABLE_FOR_LEGAL_REASONS":
      return 451;
    case "TIMEOUT":
      return 504;
    case "GITHUB_UNAVAILABLE":
    case "NETWORK":
    case "AUTH_FAILED":
      return 502;
    default:
      return 500;
  }
}

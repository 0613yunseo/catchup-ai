import { ERROR_MESSAGES as GITHUB_MESSAGES, GithubError, httpStatusFor as githubStatus } from "../github/errors.ts";
import { ExtractError, MESSAGES as EXTRACT_MESSAGES, httpStatusFor as extractStatus } from "../extract/errors.ts";
import type { CompareErrorCode, CompareErrorInfo } from "./types.ts";

export class CompareError extends Error {
  code: CompareErrorCode;
  retryAfterSec: number | undefined;

  constructor(code: CompareErrorCode, retryAfterSec?: number, message?: string) {
    super(message ?? defaultMessage(code));
    this.name = "CompareError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }

  toInfo(): CompareErrorInfo {
    return { code: this.code, message: this.message, retryAfterSec: this.retryAfterSec };
  }
}

function defaultMessage(code: CompareErrorCode): string {
  if (code === "COMMIT_MISMATCH") return "조회한 커밋과 비교한 커밋이 달라 결과를 사용하지 않았습니다. 저장소를 다시 확인해 주세요.";
  if (code === "INVALID_REQUEST") return "요청 형식이 올바르지 않습니다. 저장소 주소와 요구사항 목록을 확인해 주세요.";
  if (code in EXTRACT_MESSAGES) return EXTRACT_MESSAGES[code as keyof typeof EXTRACT_MESSAGES];
  return GITHUB_MESSAGES[code as keyof typeof GITHUB_MESSAGES] ?? "비교하는 중 오류가 발생했습니다.";
}

/** 하위 모듈의 오류를 비교 API의 오류로 바꾼다. 메시지는 이미 사용자용으로 정리되어 있다. */
export function toCompareError(e: unknown): CompareError {
  if (e instanceof CompareError) return e;
  if (e instanceof ExtractError || e instanceof GithubError) return new CompareError(e.code, e.retryAfterSec, e.message);
  return new CompareError("INTERNAL");
}

export function httpStatusFor(code: CompareErrorCode): number {
  if (code === "COMMIT_MISMATCH") return 409;
  if (code === "INVALID_REQUEST" || code === "INVALID_URL") return 400;
  // 같은 이름의 코드는 두 모듈이 같은 상태를 준다. 모델 쪽 코드를 먼저 찾고 없으면 GitHub 쪽을 쓴다.
  const modelCodes = Object.keys(EXTRACT_MESSAGES);
  return modelCodes.includes(code) ? extractStatus(code as never) : githubStatus(code as never);
}

import { ExtractError } from "../extract/errors.ts";
import { normalizeForMatch } from "../extract/quote.ts";
import { DIFF_LIMITS as L } from "./limits.ts";
import type { DiffRequest } from "./types.ts";

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");

// 요청 본문 검증. 신뢰할 수 없는 입력이므로 형식과 길이를 서버에서 다시 확인한다.
export function parseDiffRequest(body: unknown): DiffRequest {
  const o = (body ?? {}) as Record<string, unknown>;
  const projectName = typeof o.projectName === "string" ? o.projectName.trim() : "";
  const previousText = clean(o.previousText);
  const latestText = clean(o.latestText);

  if (!projectName || projectName.length > L.nameMax) throw new ExtractError("INVALID_REQUEST");
  if (previousText.length < L.textMin || latestText.length < L.textMin) throw new ExtractError("INVALID_REQUEST");
  if (previousText.length > L.textMax || latestText.length > L.textMax) throw new ExtractError("INPUT_TOO_LONG");
  // 같은 문서끼리는 비교할 변경이 없다. 모델을 부르지 않는다.
  if (normalizeForMatch(previousText) === normalizeForMatch(latestText)) {
    throw new ExtractError("INVALID_REQUEST", undefined, "이전 회의록과 최신 회의록이 같습니다. 서로 다른 두 문서를 입력해 주세요.");
  }
  return { projectName, previousText, latestText };
}

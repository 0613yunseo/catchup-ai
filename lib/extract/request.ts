import { INPUT_TYPES, type InputType } from "../validate.ts";
import { ExtractError } from "./errors.ts";
import { EXTRACT_LIMITS as L } from "./limits.ts";
import type { ExtractRequest } from "./types.ts";

// 요청 본문 검증. 신뢰할 수 없는 입력이므로 형식과 길이를 서버에서 다시 확인한다.
export function parseExtractRequest(body: unknown): ExtractRequest {
  const o = (body ?? {}) as Record<string, unknown>;
  const projectName = typeof o.projectName === "string" ? o.projectName.trim() : "";
  const documentType = o.documentType;
  const text = typeof o.text === "string" ? o.text.replace(/\r\n?/g, "\n").trim() : "";

  if (!projectName || projectName.length > L.nameMax) throw new ExtractError("INVALID_REQUEST");
  if (!INPUT_TYPES.some((t) => t.value === documentType)) throw new ExtractError("INVALID_REQUEST");
  if (text.length < L.textMin) throw new ExtractError("INVALID_REQUEST");
  if (text.length > L.textMax) throw new ExtractError("INPUT_TOO_LONG");
  return { projectName, documentType: documentType as InputType, text };
}

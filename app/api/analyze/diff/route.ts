import { ExtractError, httpStatusFor } from "@/lib/extract/errors";
import { readConfig } from "@/lib/extract/config";
import { createOpenAIClient } from "@/lib/extract/openai-client";
import { clientKey, getSharedLimiter } from "@/lib/extract/shared-limiter";
import type { ExtractErrorInfo } from "@/lib/extract/types";
import { detectChanges } from "@/lib/diff/diff";
import { DIFF_LIMITS } from "@/lib/diff/limits";
import { parseDiffRequest } from "@/lib/diff/request";

export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };
// 회의록 두 개(각 20,000자 이하)와 JSON 이스케이프 여유
const MAX_BODY_CHARS = DIFF_LIMITS.textMax * 2 * 3 + 2000;

// 요구사항 추출·코드 비교와 같은 요청 제한을 공유한다. 서버 인스턴스 안에서만 유지된다.
const limiter = getSharedLimiter();

function fail(error: ExtractErrorInfo) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (error.retryAfterSec) headers["Retry-After"] = String(error.retryAfterSec);
  return Response.json({ ok: false, error }, { status: httpStatusFor(error.code), headers });
}

// POST /api/analyze/diff  { projectName, previousText, latestText }
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(new ExtractError("INVALID_REQUEST").toInfo());
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return fail(new ExtractError("INPUT_TOO_LONG").toInfo());
    body = JSON.parse(text);
  } catch {
    return fail(new ExtractError("INVALID_REQUEST").toInfo());
  }

  let input;
  try {
    input = parseDiffRequest(body);
  } catch (e) {
    return fail((e as ExtractError).toInfo());
  }

  // 키가 없으면 모델을 부르지 않고 설정 누락을 그대로 알린다. 가짜 결과를 만들지 않는다.
  const { apiKey, model } = readConfig(process.env);
  if (!apiKey) return fail(new ExtractError("NOT_CONFIGURED").toInfo());

  const slot = limiter.acquire(clientKey(request));
  if (!slot.ok) return fail(new ExtractError(slot.code, slot.retryAfterSec).toInfo());

  try {
    const result = await detectChanges(input, { client: createOpenAIClient(apiKey), model });
    // 문서 내용과 키는 기록하지 않는다. 개수와 사용량만 남긴다.
    console.info(
      "diff.ok",
      JSON.stringify({ model: result.model, items: result.items.length, counts: result.counts, rejected: result.quality.rejected, repaired: result.quality.repaired, calls: result.usage.attempts, tokens: result.usage.totalTokens, ms: result.usage.durationMs }),
    );
    return Response.json({ ok: true, data: result }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ExtractError) {
      console.warn("diff.fail", JSON.stringify({ code: e.code }));
      return fail(e.toInfo());
    }
    console.error("diff.error", e instanceof Error ? e.name : "unknown");
    return fail(new ExtractError("INTERNAL").toInfo());
  } finally {
    slot.release();
  }
}

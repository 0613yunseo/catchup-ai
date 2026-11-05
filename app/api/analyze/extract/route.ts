import { ExtractError, httpStatusFor } from "@/lib/extract/errors";
import { readConfig } from "@/lib/extract/config";
import { extractRequirements } from "@/lib/extract/extract";
import { EXTRACT_LIMITS, RATE_LIMIT } from "@/lib/extract/limits";
import { createOpenAIClient } from "@/lib/extract/openai-client";
import { createLimiter } from "@/lib/extract/rate-limit";
import { parseExtractRequest } from "@/lib/extract/request";
import type { ExtractErrorInfo } from "@/lib/extract/types";

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_CHARS = 80_000;

// 서버 인스턴스 안에서만 유지되는 제한이다.
const limiter = createLimiter(RATE_LIMIT);

function fail(error: ExtractErrorInfo) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (error.retryAfterSec) headers["Retry-After"] = String(error.retryAfterSec);
  return Response.json({ ok: false, error }, { status: httpStatusFor(error.code), headers });
}

function clientKey(request: Request): string {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

// GET: 설정 상태 확인. 키 값은 절대 반환하지 않고 설정 여부(true/false)만 알려 준다.
export async function GET() {
  const { apiKey, model } = readConfig(process.env);
  return Response.json(
    {
      configured: apiKey !== null,
      model,
      limits: {
        maxChars: EXTRACT_LIMITS.textMax,
        maxItems: EXTRACT_LIMITS.maxItems,
        maxOutputTokens: EXTRACT_LIMITS.maxOutputTokens,
        requestsPerWindow: RATE_LIMIT.maxPerWindow,
        windowMinutes: RATE_LIMIT.windowMs / 60_000,
      },
    },
    { headers: NO_STORE },
  );
}

// POST /api/analyze/extract  { projectName, documentType, text }
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
    input = parseExtractRequest(body);
  } catch (e) {
    return fail((e as ExtractError).toInfo());
  }

  // 키가 없으면 모델을 부르지 않고 설정 누락을 그대로 알린다. 가짜 결과를 만들지 않는다.
  const { apiKey, model } = readConfig(process.env);
  if (!apiKey) return fail(new ExtractError("NOT_CONFIGURED").toInfo());

  const slot = limiter.acquire(clientKey(request));
  if (!slot.ok) return fail(new ExtractError(slot.code, slot.retryAfterSec).toInfo());

  try {
    const result = await extractRequirements(input, { client: createOpenAIClient(apiKey), model });
    // 문서 내용과 키는 기록하지 않는다. 사용량과 시간만 남긴다.
    console.info(
      "extract.ok",
      JSON.stringify({ model: result.model, items: result.count, attempts: result.usage.attempts, tokens: result.usage.totalTokens, ms: result.usage.durationMs }),
    );
    return Response.json({ ok: true, data: result }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ExtractError) {
      console.warn("extract.fail", JSON.stringify({ code: e.code }));
      return fail(e.toInfo());
    }
    console.error("extract.error", e instanceof Error ? e.name : "unknown");
    return fail(new ExtractError("INTERNAL").toInfo());
  } finally {
    slot.release();
  }
}

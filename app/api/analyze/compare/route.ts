import { compareRequirements } from "@/lib/compare/compare";
import { CompareError, httpStatusFor, toCompareError } from "@/lib/compare/errors";
import { COMPARE_LIMITS } from "@/lib/compare/limits";
import { parseCompareRequest } from "@/lib/compare/request";
import type { CompareErrorInfo } from "@/lib/compare/types";
import { readConfig } from "@/lib/extract/config";
import { createOpenAIClient } from "@/lib/extract/openai-client";
import { clientKey, getSharedLimiter } from "@/lib/extract/shared-limiter";
import { collectRepository } from "@/lib/github/collect";

// GitHub 수집(최대 25초)과 AI 호출(파일 선별 + 판정)을 한 요청에서 처리한다.
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_CHARS = 120_000;
const limiter = getSharedLimiter();

function fail(error: CompareErrorInfo) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (error.retryAfterSec) headers["Retry-After"] = String(error.retryAfterSec);
  return Response.json({ ok: false, error }, { status: httpStatusFor(error.code), headers });
}

// GET: 설정 상태. 키 값은 반환하지 않는다.
export async function GET() {
  const { apiKey, model } = readConfig(process.env);
  return Response.json(
    {
      configured: apiKey !== null,
      model,
      limits: {
        maxRequirements: COMPARE_LIMITS.maxRequirements,
        batchSize: COMPARE_LIMITS.batchSize,
        maxModelCalls: COMPARE_LIMITS.maxModelCalls,
        maxContextChars: COMPARE_LIMITS.maxContextChars,
      },
    },
    { headers: NO_STORE },
  );
}

// POST /api/analyze/compare  { repoUrl, commitSha?, projectName?, requirements: ExtractedRequirement[] }
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(new CompareError("INVALID_REQUEST").toInfo());
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return fail(new CompareError("INPUT_TOO_LONG").toInfo());
    body = JSON.parse(text);
  } catch {
    return fail(new CompareError("INVALID_REQUEST").toInfo());
  }

  let input;
  try {
    input = parseCompareRequest(body);
  } catch (e) {
    return fail(toCompareError(e).toInfo());
  }

  // 키가 없으면 모델도 GitHub도 부르지 않고 설정 누락을 그대로 알린다. 가짜 결과를 만들지 않는다.
  const { apiKey, model } = readConfig(process.env);
  if (!apiKey) return fail(new CompareError("NOT_CONFIGURED").toInfo());

  const slot = limiter.acquire(clientKey(request));
  if (!slot.ok) return fail(new CompareError(slot.code, slot.retryAfterSec).toInfo());

  try {
    const result = await compareRequirements(input, {
      client: createOpenAIClient(apiKey),
      model,
      collect: (ref, opts) => collectRepository(ref, { commitSha: opts.commitSha, token: process.env.GITHUB_TOKEN }),
    });
    // 코드와 요구사항 원문, 키는 기록하지 않는다. 건수·토큰·시간만 남긴다.
    console.info(
      "compare.ok",
      JSON.stringify({
        model: result.model,
        reqs: result.summary.total,
        calls: result.usage.modelCalls,
        tokens: result.usage.totalTokens,
        ms: result.usage.durationMs,
        githubMs: result.usage.githubMs,
        complete: result.coverage.complete,
      }),
    );
    return Response.json({ ok: true, data: result }, { headers: NO_STORE });
  } catch (e) {
    const err = toCompareError(e);
    console.warn("compare.fail", JSON.stringify({ code: err.code }));
    return fail(err.toInfo());
  } finally {
    slot.release();
  }
}

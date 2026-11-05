// 문서에서 요구사항을 추출하는 서버 전용 모듈. OpenAI Responses API + Structured Outputs를 쓴다.
// UI와 무관하다. 모델 호출은 정상 경로에서 한 번이며, 일시 오류나 검증 실패일 때만 한 번 더 시도한다.
import { randomUUID } from "node:crypto";
import { ExtractError, classifyModelError } from "./errors.ts";
import { EXTRACT_LIMITS as L } from "./limits.ts";
import { INSTRUCTIONS, buildInput } from "./prompt.ts";
import { SCHEMA_NAME, buildSchema, validateOutput } from "./schema.ts";
import type { ExtractRequest, ExtractResponse } from "./types.ts";

type ModelResponse = {
  status?: string;
  output_text?: string;
  output?: { type?: string; content?: { type?: string }[] }[];
  incomplete_details?: { reason?: string } | null;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null;
};

/** OpenAI SDK의 client.responses.create 중 우리가 쓰는 부분만 정의한다. 테스트에서는 가짜로 바꾼다. */
export type ResponsesClient = {
  responses: {
    create(params: Record<string, unknown>, options?: { timeout?: number; maxRetries?: number }): Promise<ModelResponse>;
  };
};

export type ExtractDeps = {
  client: ResponsesClient;
  model: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  newDelimiter?: () => string;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function hasRefusal(res: ModelResponse): boolean {
  return (res.output ?? []).some((i) => i?.type === "message" && (i.content ?? []).some((c) => c?.type === "refusal"));
}

export async function extractRequirements(req: ExtractRequest, deps: ExtractDeps): Promise<ExtractResponse> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const delimiter = (deps.newDelimiter ?? (() => randomUUID().slice(0, 8)))();
  const start = now();
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let attempts = 0;
  let feedback: string[] | undefined;

  while (attempts < L.maxAttempts) {
    const remaining = L.totalTimeoutMs - (now() - start);
    if (remaining <= 0 || (attempts > 0 && remaining < L.retryMinRemainingMs)) throw new ExtractError("TIMEOUT");
    attempts++;

    const params: Record<string, unknown> = {
      model: deps.model,
      instructions: INSTRUCTIONS,
      input: buildInput(req, delimiter, feedback),
      max_output_tokens: L.maxOutputTokens,
      store: false, // OpenAI 쪽에 응답을 저장하지 않는다.
      text: { format: { type: "json_schema", name: SCHEMA_NAME, strict: true, schema: buildSchema(req.documentType) } },
    };
    if (/^(gpt-5|o\d)/.test(deps.model)) params.reasoning = { effort: "low" };

    let res: ModelResponse;
    try {
      res = await deps.client.responses.create(params, { timeout: Math.min(L.callTimeoutMs, remaining), maxRetries: 0 });
    } catch (e) {
      const err = classifyModelError(e);
      const transient = err.code === "NETWORK" || err.code === "MODEL_UNAVAILABLE" || (err.code === "RATE_LIMITED" && (err.retryAfterSec ?? 1) <= 3);
      if (transient && attempts < L.maxAttempts) {
        await sleep(Math.min((err.retryAfterSec ?? 1) * 1000, 3000));
        continue;
      }
      throw err;
    }

    usage.inputTokens += res.usage?.input_tokens ?? 0;
    usage.outputTokens += res.usage?.output_tokens ?? 0;
    usage.totalTokens += res.usage?.total_tokens ?? (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0);

    if (hasRefusal(res)) throw new ExtractError("MODEL_REFUSED");
    if (res.status === "incomplete") {
      throw new ExtractError(res.incomplete_details?.reason === "max_output_tokens" ? "OUTPUT_TRUNCATED" : "MODEL_REFUSED");
    }
    if (res.status === "failed") throw new ExtractError("MODEL_UNAVAILABLE");

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.output_text ?? "");
    } catch {
      feedback = ["응답이 올바른 JSON이 아니었습니다."];
      continue;
    }

    const check = validateOutput(parsed, req.text, req.documentType);
    if (check.ok) {
      return {
        projectName: req.projectName,
        documentType: req.documentType,
        requirements: check.items.map((it, i) => ({ id: `R-${i + 1}`, ...it })),
        count: check.items.length,
        extractedAt: new Date(now()).toISOString(),
        model: deps.model,
        usage: { ...usage, attempts, durationMs: now() - start },
      };
    }
    // 검증에 실패한 결과는 고쳐서 쓰지 않는다. 문제점을 알려 주고 한 번만 다시 받는다.
    feedback = check.problems.slice(0, 10);
  }
  throw new ExtractError("INVALID_OUTPUT");
}

// 모델 호출 한 단계(파일 선별 또는 판정)를 실행한다. 시간·호출 횟수 예산을 지키고, 제한적으로만 다시 시도한다.
import { ExtractError, classifyModelError } from "../extract/errors.ts";
import type { ResponsesClient } from "../extract/extract.ts";
import { COMPARE_LIMITS as L } from "./limits.ts";
import type { Check } from "./schema.ts";

export type Budget = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** 요청 전체 시작 시각 */
  start: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** 모델 호출에 쓴 누적 시간(병렬 호출은 겹쳐 더해진다) */
  modelMs: number;
};

export type StageSpec<T> = {
  schemaName: string;
  /** 추론 강도. 기본은 low이다. */
  effort?: "low" | "medium";
  schema: object;
  instructions: string;
  maxOutputTokens: number;
  /** 피드백이 있으면 입력에 덧붙여 다시 요청한다. */
  build: (feedback?: string[]) => string;
  validate: (parsed: unknown) => Check<T>;
};

type ModelResponse = Awaited<ReturnType<ResponsesClient["responses"]["create"]>>;

function hasRefusal(res: ModelResponse): boolean {
  return (res.output ?? []).some((i) => i?.type === "message" && (i.content ?? []).some((c) => c?.type === "refusal"));
}

export async function runStage<T>(client: ResponsesClient, model: string, budget: Budget, spec: StageSpec<T>): Promise<T> {
  let feedback: string[] | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = L.totalTimeoutMs - (budget.now() - budget.start);
    if (remaining <= 0 || (attempt > 1 && remaining < L.retryMinRemainingMs)) throw new ExtractError("TIMEOUT");
    if (budget.calls >= L.maxModelCalls) throw new ExtractError("INTERNAL");
    budget.calls++;

    const params: Record<string, unknown> = {
      model,
      instructions: spec.instructions,
      input: spec.build(feedback),
      max_output_tokens: spec.maxOutputTokens,
      store: false, // OpenAI 쪽에 응답을 저장하지 않는다.
      text: { format: { type: "json_schema", name: spec.schemaName, strict: true, schema: spec.schema } },
    };
    if (/^(gpt-5|o\d)/.test(model)) params.reasoning = { effort: spec.effort ?? "low" };

    const t0 = budget.now();
    let res: ModelResponse;
    try {
      res = await client.responses.create(params, { timeout: Math.min(L.callTimeoutMs, remaining), maxRetries: 0 });
    } catch (e) {
      budget.modelMs += budget.now() - t0;
      const err = classifyModelError(e);
      const transient = err.code === "NETWORK" || err.code === "MODEL_UNAVAILABLE" || (err.code === "RATE_LIMITED" && (err.retryAfterSec ?? 1) <= 3);
      if (transient && attempt < 2) {
        await budget.sleep(Math.min((err.retryAfterSec ?? 1) * 1000, 3000));
        continue;
      }
      throw err;
    }
    budget.modelMs += budget.now() - t0;
    budget.inputTokens += res.usage?.input_tokens ?? 0;
    budget.outputTokens += res.usage?.output_tokens ?? 0;
    budget.totalTokens += res.usage?.total_tokens ?? (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0);

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
    const check = spec.validate(parsed);
    if (check.ok) return check.value;
    feedback = check.problems.slice(0, 10);
  }
  throw new ExtractError("INVALID_OUTPUT");
}

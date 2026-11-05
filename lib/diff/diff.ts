// 이전·최신 회의록의 변경사항을 찾는 서버 전용 모듈. OpenAI Responses API + Structured Outputs를 쓴다.
// 모델 호출은 정상 경로에서 한 번이고, 검증에 실패했을 때만 문제점을 알려 주며 한 번 더 받는다.
import { randomUUID } from "node:crypto";
import { runStage, type Budget } from "../compare/model.ts";
import type { ResponsesClient } from "../extract/extract.ts";
import { DIFF_LIMITS as L } from "./limits.ts";
import { DIFF_INSTRUCTIONS, buildDiffInput } from "./prompt.ts";
import { DIFF_SCHEMA, DIFF_SCHEMA_NAME, validateDiff } from "./schema.ts";
import { toRequirements } from "./to-requirements.ts";
import { CHANGE_KINDS, type ChangeKind, type DiffRequest, type DiffResponse } from "./types.ts";

export type DiffDeps = {
  client: ResponsesClient;
  model: string;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  newDelimiter?: () => string;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function detectChanges(req: DiffRequest, deps: DiffDeps): Promise<DiffResponse> {
  const now = deps.now ?? Date.now;
  const start = now();
  const delimiter = (deps.newDelimiter ?? (() => randomUUID().slice(0, 8)))();
  const budget: Budget = {
    now,
    sleep: deps.sleep ?? defaultSleep,
    start,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    modelMs: 0,
  };

  const items = await runStage(deps.client, deps.model, budget, {
    schemaName: DIFF_SCHEMA_NAME,
    effort: "low",
    schema: DIFF_SCHEMA,
    instructions: DIFF_INSTRUCTIONS,
    maxOutputTokens: L.maxOutputTokens,
    build: (feedback) => buildDiffInput(req, delimiter, feedback),
    validate: (parsed) => validateDiff(parsed, req),
  });

  const counts = Object.fromEntries(CHANGE_KINDS.map((k) => [k, 0])) as Record<ChangeKind, number>;
  for (const it of items) counts[it.kind]++;

  return {
    projectName: req.projectName,
    items,
    requirements: toRequirements(items),
    counts,
    diffedAt: new Date(now()).toISOString(),
    model: deps.model,
    usage: {
      inputTokens: budget.inputTokens,
      outputTokens: budget.outputTokens,
      totalTokens: budget.totalTokens,
      attempts: budget.calls,
      durationMs: now() - start,
    },
  };
}

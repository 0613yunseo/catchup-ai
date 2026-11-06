// 모델 출력 JSON Schema(strict)와 서버 측 구조 검증. 근거 검증(경로·라인·인용)은 evidence.ts가 한다.
import { COMPARE_LIMITS as L } from "./limits.ts";
import { sanitizeTerm } from "./select.ts";

export const STATUSES = ["VERIFIED", "PARTIAL", "MISMATCH", "UNKNOWN"] as const;
export type VerdictStatus = (typeof STATUSES)[number];

export const SELECT_SCHEMA_NAME = "file_selection";
export const VERDICT_SCHEMA_NAME = "requirement_verdicts";

export const SELECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["selections"],
  properties: {
    selections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirementId", "searchTerms", "files"],
        properties: {
          requirementId: { type: "string" },
          searchTerms: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirementId", "status", "reason", "evidence", "missingConditions", "recommendation"],
        properties: {
          requirementId: { type: "string" },
          status: { type: "string", enum: [...STATUSES] },
          reason: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "startLine", "endLine", "quote", "role"],
              properties: {
                path: { type: "string" },
                startLine: { type: "integer" },
                endLine: { type: "integer" },
                quote: { type: "string" },
                role: { type: "string", enum: ["direct", "partial", "context"] },
              },
            },
          },
          missingConditions: { type: "array", items: { type: "string" } },
          recommendation: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export type Check<T> = { ok: true; value: T } | { ok: false; problems: string[] };

export type SelectionDraft = { requirementId: string; searchTerms: string[]; files: string[] };

/** 파일 선별 응답 검증. 목록에 없는 파일 경로와 위험한 검색어는 버린다. */
export function validateSelection(raw: unknown, askedIds: Set<string>, knownPaths: Set<string>): Check<SelectionDraft[]> {
  const list = (raw as { selections?: unknown } | null)?.selections;
  if (!Array.isArray(list)) return { ok: false, problems: ["selections 배열이 없습니다."] };
  const out: SelectionDraft[] = [];
  for (const it of list) {
    const o = (it ?? {}) as Record<string, unknown>;
    if (typeof o.requirementId !== "string" || !Array.isArray(o.searchTerms) || !Array.isArray(o.files)) {
      return { ok: false, problems: ["selections 항목의 형식이 올바르지 않습니다."] };
    }
    if (!askedIds.has(o.requirementId)) continue;
    out.push({
      requirementId: o.requirementId,
      searchTerms: o.searchTerms.map(sanitizeTerm).filter((t): t is string => t !== null).slice(0, L.maxSearchTerms),
      files: o.files.filter((p): p is string => typeof p === "string" && knownPaths.has(p)).slice(0, L.maxSelectFiles),
    });
  }
  return { ok: true, value: out };
}

export type RawEvidence = { path: string; startLine: number; endLine: number; quote: string };
export type VerdictDraft = {
  requirementId: string;
  status: VerdictStatus;
  reason: string;
  evidence: unknown[];
  missingConditions: string[];
  recommendation: string | null;
};

/** 판정 응답의 구조를 검증한다. 요청하지 않은 id는 무시하고, 형식이 틀린 항목이 있으면 전체를 다시 받는다. */
export function validateVerdicts(raw: unknown, askedIds: Set<string>): Check<Map<string, VerdictDraft>> {
  const list = (raw as { verdicts?: unknown } | null)?.verdicts;
  if (!Array.isArray(list)) return { ok: false, problems: ["verdicts 배열이 없습니다."] };
  const out = new Map<string, VerdictDraft>();
  const problems: string[] = [];
  for (const it of list) {
    const o = (it ?? {}) as Record<string, unknown>;
    const id = typeof o.requirementId === "string" ? o.requirementId : "?";
    const ok =
      typeof o.requirementId === "string" &&
      STATUSES.includes(o.status as VerdictStatus) &&
      typeof o.reason === "string" &&
      o.reason.trim().length > 0 &&
      Array.isArray(o.evidence) &&
      Array.isArray(o.missingConditions) &&
      o.missingConditions.every((m) => typeof m === "string") &&
      (o.recommendation === null || typeof o.recommendation === "string");
    if (!ok) {
      problems.push(`${id} 항목의 형식이 올바르지 않습니다.`);
      continue;
    }
    if (!askedIds.has(o.requirementId as string) || out.has(o.requirementId as string)) continue;
    out.set(o.requirementId as string, {
      requirementId: o.requirementId as string,
      status: o.status as VerdictStatus,
      reason: (o.reason as string).trim().slice(0, L.reasonMax),
      evidence: (o.evidence as unknown[]).slice(0, L.evidencePerRequirement),
      missingConditions: (o.missingConditions as string[]).slice(0, L.missingMax).map((m) => m.trim().slice(0, L.missingItemMax)).filter(Boolean),
      recommendation: o.recommendation === null ? null : (o.recommendation as string).trim().slice(0, L.recommendationMax) || null,
    });
  }
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: out };
}

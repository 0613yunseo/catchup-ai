// 모델 출력 JSON Schema(strict)와 서버 측 검증·정책. 모델이 Structured Outputs를 지켰더라도 서버가 다시 확인한다.
// 분류의 마지막 결정권은 서버에 있다: 근거 인용이 문서에 없으면 결과를 쓰지 않고,
// 근거가 부족한 삭제·변경 분류는 서버가 낮춘다.
import type { DecisionType } from "../extract/types.ts";
import { normalizeForMatch, quoteExistsInDocument } from "../extract/quote.ts";
import type { Check } from "../compare/schema.ts";
import { DIFF_LIMITS as L } from "./limits.ts";
import { CHANGE_KINDS, type ChangeItem, type ChangeKind, type ChangeSide, type DiffRequest } from "./types.ts";

const DECISIONS: DecisionType[] = ["confirmed", "suggestion", "undecided"];
export const DIFF_SCHEMA_NAME = "meeting_changes";

const nullableStr = { type: ["string", "null"] } as const;

export const DIFF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "summary",
          "previousTitle",
          "previousDescription",
          "previousQuote",
          "latestTitle",
          "latestDescription",
          "latestQuote",
          "latestDecision",
          "needsReview",
          "reviewReason",
        ],
        properties: {
          kind: { type: "string", enum: [...CHANGE_KINDS] },
          summary: { type: "string" },
          previousTitle: nullableStr,
          previousDescription: nullableStr,
          previousQuote: nullableStr,
          latestTitle: nullableStr,
          latestDescription: nullableStr,
          latestQuote: nullableStr,
          latestDecision: { type: ["string", "null"], enum: [...DECISIONS, null] },
          needsReview: { type: "boolean" },
          reviewReason: nullableStr,
        },
      },
    },
  },
} as const;

const isStr = (v: unknown, max: number, min = 1): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const isNull = (v: unknown) => v === null || v === undefined;

type Side = { side: ChangeSide | null; bad: boolean };

// 세 필드가 모두 있거나 모두 없어야 한다. 일부만 있으면 형식 오류이다.
function readSide(title: unknown, description: unknown, quote: unknown): Side {
  if (isNull(title) && isNull(description) && isNull(quote)) return { side: null, bad: false };
  if (isStr(title, L.titleMax) && isStr(description, L.descriptionMax) && typeof quote === "string" && quote.length <= L.quoteMax && quote.trim().length > 0) {
    return { side: { title: title.trim(), description: description.trim(), quote: quote.trim() }, bad: false };
  }
  return { side: null, bad: true };
}

const NOTE = {
  removedNoLatest:
    "최신 회의록에서 삭제를 명시한 문장을 찾지 못했습니다. 언급되지 않았다는 이유만으로는 삭제로 확정하지 않아 ‘불확실’로 분류했습니다.",
  removedNotConfirmed: "최신 회의록의 삭제 관련 문장이 확정 표현이 아니어서 삭제로 확정하지 않고 ‘불확실’로 분류했습니다.",
  removedStillThere: "이전 회의록의 해당 문장이 최신 회의록에도 그대로 있어 삭제로 확정하지 않고 ‘불확실’로 분류했습니다.",
  sameQuote: "두 회의록의 근거 문장이 같아 변경이 아닌 ‘유지’로 분류했습니다.",
} as const;

const DEFAULT_REASON: Partial<Record<ChangeKind, string>> = {
  CONFLICT: "두 회의록의 내용이 서로 맞지 않습니다. 어느 쪽이 최종 결정인지 원문을 확인해 주세요.",
  UNCERTAIN: "문서만으로는 분류하기 어렵습니다. 원문을 확인해 주세요.",
};

export function validateDiff(raw: unknown, req: DiffRequest): Check<ChangeItem[]> {
  const list = (raw as { changes?: unknown } | null)?.changes;
  if (!Array.isArray(list)) return { ok: false, problems: ["changes 배열이 없습니다."] };
  if (list.length === 0) return { ok: false, problems: ["비교할 요구사항을 하나도 찾지 못했습니다. 두 문서를 다시 읽고 요구사항·결정사항을 항목으로 나누세요."] };
  if (list.length > L.maxItems) return { ok: false, problems: [`변경 항목이 ${L.maxItems}개를 넘었습니다. 같은 주제는 합쳐 ${L.maxItems}개 이하로 만드세요.`] };

  const problems: string[] = [];
  const items: ChangeItem[] = [];

  list.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const label = `#${i + 1}${typeof o.summary === "string" ? ` "${o.summary.slice(0, 30)}"` : ""}`;
    const kind = o.kind as ChangeKind;
    const prev = readSide(o.previousTitle, o.previousDescription, o.previousQuote);
    const last = readSide(o.latestTitle, o.latestDescription, o.latestQuote);

    if (
      !CHANGE_KINDS.includes(kind) ||
      !isStr(o.summary, L.summaryMax) ||
      prev.bad ||
      last.bad ||
      typeof o.needsReview !== "boolean" ||
      !(isNull(o.reviewReason) || isStr(o.reviewReason, L.reasonMax)) ||
      !(isNull(o.latestDecision) || DECISIONS.includes(o.latestDecision as DecisionType))
    ) {
      problems.push(`${label}의 형식이 올바르지 않습니다. (제목·설명·인용 세 필드는 함께 채우거나 함께 null이어야 합니다.)`);
      return;
    }

    const previous = prev.side;
    const latest = last.side;
    let latestDecision = (o.latestDecision ?? null) as DecisionType | null;
    if (latest && !latestDecision) {
      problems.push(`${label}: latest 쪽 내용이 있으면 latestDecision이 필요합니다.`);
      return;
    }
    if (!latest) latestDecision = null;

    // 분류별로 필요한 쪽이 있는지 확인한다.
    const needs: Record<ChangeKind, boolean> = {
      ADDED: !!latest && !previous,
      MODIFIED: !!latest && !!previous,
      UNCHANGED: !!latest && !!previous,
      CONFLICT: !!latest && !!previous,
      REMOVED: !!previous,
      UNCERTAIN: !!latest || !!previous,
    };
    if (!needs[kind]) {
      problems.push(`${label}: ${kind} 분류에 필요한 이전/최신 회의록 내용이 맞지 않습니다.`);
      return;
    }

    // 원문 인용은 각 문서에 그대로 있어야 한다. 한 글자라도 다르면 결과를 쓰지 않는다.
    if (previous && !quoteExistsInDocument(req.previousText, previous.quote, L.quoteMin)) {
      problems.push(`${label}의 이전 회의록 인용이 이전 문서에 그대로 없습니다.`);
      return;
    }
    if (latest && !quoteExistsInDocument(req.latestText, latest.quote, L.quoteMin)) {
      problems.push(`${label}의 최신 회의록 인용이 최신 문서에 그대로 없습니다.`);
      return;
    }

    // ---- 서버 정책: 근거가 부족한 분류는 낮춘다 ----
    let k = kind;
    let serverNote: string | null = null;

    if (k === "REMOVED") {
      // 삭제는 최신 회의록이 명시적으로 확정했을 때만 인정한다. 언급이 없다는 것만으로는 삭제가 아니다.
      if (!latest) {
        k = "UNCERTAIN";
        serverNote = NOTE.removedNoLatest;
      } else if (latestDecision !== "confirmed") {
        k = "UNCERTAIN";
        serverNote = NOTE.removedNotConfirmed;
      } else if (previous && quoteExistsInDocument(req.latestText, previous.quote, L.quoteMin)) {
        k = "UNCERTAIN";
        serverNote = NOTE.removedStillThere;
      }
    } else if (k === "MODIFIED" && previous && latest && normalizeForMatch(previous.quote) === normalizeForMatch(latest.quote)) {
      // 근거 문장이 같으면 변경의 증거가 없다. 표현만 다른 경우를 변경으로 세지 않는다.
      k = "UNCHANGED";
      serverNote = NOTE.sameQuote;
    }

    let needsReview = o.needsReview;
    let reviewReason = (o.reviewReason as string | null | undefined)?.trim() || null;
    if (k === "CONFLICT" || k === "UNCERTAIN") {
      needsReview = true;
      reviewReason ??= DEFAULT_REASON[k] ?? null;
      // 충돌하거나 불확실한 항목은 확정된 결정이 아니므로 구현 여부를 판정하지 않는다.
      if (latest) latestDecision = "undecided";
    }
    if (!latest) latestDecision = null;
    // 최신 회의록에서 아직 확정되지 않은 내용은 사람이 결정 여부를 확인해야 한다.
    if (latest && latestDecision === "undecided" && !needsReview) {
      needsReview = true;
      reviewReason ??= "최신 회의록에서 아직 확정되지 않은 내용입니다. 결정 여부를 확인해 주세요.";
    }

    items.push({
      id: "",
      kind: k,
      summary: (o.summary as string).trim(),
      previous,
      latest,
      latestDecision,
      needsReview,
      reviewReason,
      serverNote,
    });
  });

  if (problems.length) return { ok: false, problems: problems.slice(0, 10) };
  return { ok: true, value: items.map((it, i) => ({ ...it, id: `R-${i + 1}` })) };
}

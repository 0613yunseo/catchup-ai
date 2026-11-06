// 모델 출력 JSON Schema(strict)와 서버 측 검증·정책. 모델이 Structured Outputs를 지켰더라도 서버가 다시 확인한다.
// 분류의 마지막 결정권은 서버에 있다: 원문에 없는 인용은 화면에 쓰지 않고,
// 근거가 부족한 삭제·변경 분류는 서버가 낮춘다.
//
// 실제 모델 응답 20회 중 5회가 검증 실패(502)였고, 원인은 세 가지였다.
//  1) 삭제 항목에서 인용문만 채우고 제목·설명을 비움  → 인용이 검증되면 서버가 인용문으로 채운다.
//  2) 분류가 가리키는 쪽 내용이 없음(예: 최신에 없는데 UNCHANGED) → 확정하지 않고 UNCERTAIN으로 낮춘다.
//  3) 인용문이 원문과 한 글자라도 다름 → 그 인용은 쓰지 않고, 그 쪽 근거를 잃은 항목은 UNCERTAIN으로 낮춘다.
// 어느 경우에도 원문에 없는 인용을 화면에 보여 주지 않으며, 확정 쪽으로 보정하지 않는다.
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

const isNull = (v: unknown) => v === null || v === undefined;
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

type SideRead = { side: ChangeSide | null; repaired: boolean; problem: string | null };

// 인용(quote)이 있으면 쪽 내용이 있는 것으로 본다. 제목·설명이 비었거나 너무 길면 서버가 인용문으로 채우거나 줄인다.
// 인용이 없는데 제목·설명만 있으면 근거를 확인할 수 없으므로 형식 오류이다.
function readSide(label: string, title: unknown, description: unknown, quote: unknown): SideRead {
  if (isNull(title) && isNull(description) && isNull(quote)) return { side: null, repaired: false, problem: null };
  if (!nonEmpty(quote)) return { side: null, repaired: false, problem: `${label} 인용(quote)이 비어 있는데 제목·설명만 있습니다.` };
  if (quote.length > L.quoteMax) return { side: null, repaired: false, problem: `${label} 인용이 ${L.quoteMax}자를 넘습니다. 한 문장 또는 짧은 구절만 인용하세요.` };
  const q = quote.trim();
  const t = nonEmpty(title) ? clip(title.trim(), L.titleMax) : clip(q, 60);
  const d = nonEmpty(description) ? clip(description.trim(), L.descriptionMax) : clip(q, L.descriptionMax);
  return { side: { title: t, description: d, quote: q }, repaired: !nonEmpty(title) || !nonEmpty(description), problem: null };
}

const NOTE = {
  removedNoLatest:
    "최신 회의록에서 삭제를 명시한 문장을 찾지 못했습니다. 언급되지 않았다는 이유만으로는 삭제로 확정하지 않아 ‘불확실’로 분류했습니다.",
  removedNotConfirmed: "최신 회의록의 삭제 관련 문장이 확정 표현이 아니어서 삭제로 확정하지 않고 ‘불확실’로 분류했습니다.",
  removedStillThere: "이전 회의록의 해당 문장이 최신 회의록에도 그대로 있어 삭제로 확정하지 않고 ‘불확실’로 분류했습니다.",
  sameQuote: "두 회의록의 근거 문장이 같아 변경이 아닌 ‘유지’로 분류했습니다.",
  noLatest: "최신 회의록에서 해당 내용을 찾지 못해 ‘불확실’로 분류했습니다. 언급되지 않았다는 이유만으로 변경·삭제를 확정하지 않습니다.",
  noPrevious: "이전 회의록에서 짝지을 내용을 찾지 못해 ‘불확실’로 분류했습니다. 새로 생긴 것인지 원문을 확인해 주세요.",
  hasPrevious: "이전 회의록에도 관련 내용이 있어 ‘추가’로 확정하지 않고 ‘불확실’로 분류했습니다. 원문을 확인해 주세요.",
  quoteDropped: (which: string) => `AI가 제시한 ${which} 회의록 인용이 원문과 일치하지 않아 사용하지 않았습니다. 해당 내용은 원문을 직접 확인해 주세요.`,
} as const;

const DEFAULT_REASON: Partial<Record<ChangeKind, string>> = {
  CONFLICT: "두 회의록의 내용이 서로 맞지 않습니다. 어느 쪽이 최종 결정인지 원문을 확인해 주세요.",
  UNCERTAIN: "문서만으로는 분류하기 어렵습니다. 원문을 확인해 주세요.",
};

export type DiffValidation = {
  items: ChangeItem[];
  /** 원문 인용을 확인하지 못해 결과에서 뺀 항목 수 */
  rejected: number;
  /** 서버가 비어 있던 제목·설명을 인용문으로 채운 항목 수 (로그용) */
  repaired: number;
};

export function validateDiffDetailed(raw: unknown, req: DiffRequest): Check<DiffValidation> {
  const list = (raw as { changes?: unknown } | null)?.changes;
  if (!Array.isArray(list)) return { ok: false, problems: ["changes 배열이 없습니다."] };
  if (list.length === 0) return { ok: false, problems: ["비교할 요구사항을 하나도 찾지 못했습니다. 두 문서를 다시 읽고 요구사항·결정사항을 항목으로 나누세요."] };
  if (list.length > L.maxItems) return { ok: false, problems: [`변경 항목이 ${L.maxItems}개를 넘었습니다. 같은 주제는 합쳐 ${L.maxItems}개 이하로 만드세요.`] };

  const problems: string[] = [];
  const items: ChangeItem[] = [];
  let rejected = 0;
  let repaired = 0;
  const droppedReasons: string[] = [];

  list.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const label = `#${i + 1}${typeof o.summary === "string" ? ` "${o.summary.slice(0, 30)}"` : ""}`;
    const kind = o.kind as ChangeKind;

    // ---- 형식: 고칠 수 없는 오류는 어느 필드인지 밝혀 다시 요청한다 ----
    if (!CHANGE_KINDS.includes(kind)) return void problems.push(`${label}: kind 값이 올바르지 않습니다.`);
    if (!nonEmpty(o.summary)) return void problems.push(`${label}: summary가 비어 있습니다.`);
    if (typeof o.needsReview !== "boolean") return void problems.push(`${label}: needsReview는 true 또는 false여야 합니다.`);
    if (!(isNull(o.reviewReason) || typeof o.reviewReason === "string")) return void problems.push(`${label}: reviewReason은 문자열 또는 null이어야 합니다.`);
    if (!(isNull(o.latestDecision) || DECISIONS.includes(o.latestDecision as DecisionType))) {
      return void problems.push(`${label}: latestDecision은 confirmed, suggestion, undecided, null 중 하나여야 합니다.`);
    }
    const prevRead = readSide("이전", o.previousTitle, o.previousDescription, o.previousQuote);
    const lastRead = readSide("최신", o.latestTitle, o.latestDescription, o.latestQuote);
    if (prevRead.problem || lastRead.problem) return void problems.push(`${label}: ${prevRead.problem ?? lastRead.problem}`);

    let previous = prevRead.side;
    let latest = lastRead.side;
    if (!previous && !latest) return void problems.push(`${label}: 이전·최신 회의록 내용이 모두 비어 있습니다.`);
    const wasRepaired = prevRead.repaired || lastRead.repaired;

    // ---- 원문 인용 검증: 틀린 인용은 쓰지 않는다 ----
    let dropped: "이전" | "최신" | null = null;
    if (previous && !quoteExistsInDocument(req.previousText, previous.quote, L.quoteMin)) {
      droppedReasons.push(`${label}의 이전 회의록 인용이 이전 문서에 그대로 없습니다.`);
      previous = null;
      dropped = "이전";
    }
    if (latest && !quoteExistsInDocument(req.latestText, latest.quote, L.quoteMin)) {
      droppedReasons.push(`${label}의 최신 회의록 인용이 최신 문서에 그대로 없습니다.`);
      latest = null;
      dropped = dropped ?? "최신";
    }
    if (!previous && !latest) {
      rejected++; // 확인된 근거가 하나도 없는 항목은 결과에서 뺀다
      return;
    }
    if (wasRepaired) repaired++;

    let latestDecision = (o.latestDecision ?? null) as DecisionType | null;
    if (latest && !latestDecision) latestDecision = "undecided"; // 결정 상태를 밝히지 않았으면 확정으로 보지 않는다

    // ---- 서버 정책: 근거가 부족한 분류는 낮춘다 (확정 쪽으로는 보정하지 않는다) ----
    let k = kind;
    let serverNote: string | null = null;
    const downgrade = (note: string) => {
      k = "UNCERTAIN";
      serverNote = note;
    };

    if (dropped) {
      downgrade(NOTE.quoteDropped(dropped));
    } else if (k === "REMOVED" && !previous) {
      return void problems.push(`${label}: REMOVED 분류에는 이전 회의록 내용이 필요합니다.`);
    } else if (k === "ADDED") {
      if (!latest) downgrade(NOTE.noLatest);
      else if (previous) downgrade(NOTE.hasPrevious);
    } else if (k === "MODIFIED" || k === "UNCHANGED" || k === "CONFLICT") {
      if (!latest) downgrade(NOTE.noLatest);
      else if (!previous) downgrade(NOTE.noPrevious);
    }

    if (k === "REMOVED") {
      // 삭제는 최신 회의록이 명시적으로 확정했을 때만 인정한다. 언급이 없다는 것만으로는 삭제가 아니다.
      if (!latest) downgrade(NOTE.removedNoLatest);
      else if (latestDecision !== "confirmed") downgrade(NOTE.removedNotConfirmed);
      else if (previous && quoteExistsInDocument(req.latestText, previous.quote, L.quoteMin)) downgrade(NOTE.removedStillThere);
    } else if (k === "MODIFIED" && previous && latest && normalizeForMatch(previous.quote) === normalizeForMatch(latest.quote)) {
      // 근거 문장이 같으면 변경의 증거가 없다. 표현만 다른 경우를 변경으로 세지 않는다.
      k = "UNCHANGED";
      serverNote = NOTE.sameQuote;
    }

    let needsReview = o.needsReview;
    let reviewReason = nonEmpty(o.reviewReason) ? clip(o.reviewReason.trim(), L.reasonMax) : null;
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
      summary: clip((o.summary as string).trim(), L.summaryMax),
      previous,
      latest,
      latestDecision,
      needsReview,
      reviewReason,
      serverNote,
    });
  });

  if (problems.length) return { ok: false, problems: problems.slice(0, 10) };
  if (items.length === 0) {
    // 쓸 수 있는 항목이 하나도 없다. 인용이 원문과 다르다는 이유를 알려 주고 다시 받는다.
    return { ok: false, problems: (droppedReasons.length ? droppedReasons : ["확인된 항목이 없습니다."]).slice(0, 10) };
  }
  return { ok: true, value: { items: items.map((it, i) => ({ ...it, id: `R-${i + 1}` })), rejected, repaired } };
}

/** 항목만 돌려주는 검증. 제외된 항목 수가 필요하면 validateDiffDetailed를 쓴다. */
export function validateDiff(raw: unknown, req: DiffRequest): Check<ChangeItem[]> {
  const r = validateDiffDetailed(raw, req);
  return r.ok ? { ok: true, value: r.value.items } : r;
}

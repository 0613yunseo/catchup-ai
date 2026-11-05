// 모델 출력 JSON Schema와 서버 측 검증. 모델이 Structured Outputs를 지켰더라도 서버가 다시 확인한다.
import type { InputType } from "../validate.ts";
import { EXTRACT_LIMITS as L } from "./limits.ts";
import { quoteExistsInDocument } from "./quote.ts";
import type { ChangeType, DecisionType, ExtractedRequirement } from "./types.ts";

const DECISIONS: DecisionType[] = ["confirmed", "suggestion", "undecided"];
const CHANGES: ChangeType[] = ["new", "changed", "removed", "unspecified"];

export const SCHEMA_NAME = "requirements_extraction";

/** sourceType은 이번 요청의 문서 유형 하나로 고정한다. */
export function buildSchema(sourceType: InputType) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["requirements"],
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "sourceType", "sourceQuote", "decisionType", "changeType", "ambiguity"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            sourceType: { type: "string", enum: [sourceType] },
            sourceQuote: { type: "string" },
            decisionType: { type: "string", enum: DECISIONS },
            changeType: { type: "string", enum: CHANGES },
            ambiguity: { type: ["string", "null"] },
          },
        },
      },
    },
  } as const;
}

export type RawItem = Omit<ExtractedRequirement, "id">;

export type Validation =
  | { ok: true; items: RawItem[] }
  | { ok: false; kind: "structure" | "quote"; problems: string[] };

const isStr = (v: unknown, max: number, min = 1): v is string =>
  typeof v === "string" && v.trim().length >= min && v.length <= max;

export function validateOutput(raw: unknown, document: string, sourceType: InputType): Validation {
  const list = (raw as { requirements?: unknown } | null)?.requirements;
  if (!Array.isArray(list)) return { ok: false, kind: "structure", problems: ["requirements 배열이 없습니다."] };
  if (list.length > L.maxItems) {
    return { ok: false, kind: "structure", problems: [`요구사항이 ${L.maxItems}개를 넘었습니다. 의미가 같은 항목을 합쳐 ${L.maxItems}개 이하로 만드세요.`] };
  }

  const structure: string[] = [];
  const quotes: string[] = [];
  const items: RawItem[] = [];
  list.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const label = typeof o.title === "string" && o.title ? `"${o.title.slice(0, 40)}"` : `#${i + 1}`;
    const ok =
      isStr(o.title, L.titleMax) &&
      isStr(o.description, L.descriptionMax) &&
      o.sourceType === sourceType &&
      typeof o.sourceQuote === "string" &&
      o.sourceQuote.length <= L.quoteMax &&
      DECISIONS.includes(o.decisionType as DecisionType) &&
      CHANGES.includes(o.changeType as ChangeType) &&
      (o.ambiguity === null || isStr(o.ambiguity, L.ambiguityMax));
    if (!ok) {
      structure.push(`${label}의 형식이 올바르지 않습니다.`);
      return;
    }
    if (!quoteExistsInDocument(document, o.sourceQuote as string, L.quoteMin)) {
      quotes.push(`${label}의 sourceQuote가 문서에 그대로 없습니다.`);
      return;
    }
    items.push({
      title: (o.title as string).trim(),
      description: (o.description as string).trim(),
      sourceType,
      sourceQuote: (o.sourceQuote as string).trim(),
      decisionType: o.decisionType as DecisionType,
      changeType: o.changeType as ChangeType,
      ambiguity: o.ambiguity === null ? null : (o.ambiguity as string).trim(),
    });
  });

  if (structure.length) return { ok: false, kind: "structure", problems: structure };
  if (quotes.length) return { ok: false, kind: "quote", problems: quotes };
  return { ok: true, items };
}

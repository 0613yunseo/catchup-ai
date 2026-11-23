// Google Gemini API 어댑터. 서버에서만 쓴다.
// 분석 로직(extract · compare · diff)은 OpenAI Responses API 모양(responses.create)을 기대하므로,
// 같은 모양으로 요청을 받아 Gemini generateContent로 보내고 응답을 다시 그 모양으로 바꿔 돌려준다.
// 키는 인자로만 받고 어디에도 기록하지 않는다.
import type { ResponsesClient } from "./extract.ts";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const THINKING_BUDGET = 512;

// Gemini responseJsonSchema가 받는 키워드만 남긴다. 나머지(minLength, pattern 등)는 서버 쪽 validateOutput이 검사한다.
const SCHEMA_KEYS = new Set([
  "type", "format", "title", "description", "enum", "items", "prefixItems", "minItems", "maxItems",
  "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties", "required", "$defs", "$ref",
]);

export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (!SCHEMA_KEYS.has(k)) continue;
    if (k === "properties" || k === "$defs") {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    } else if (k === "additionalProperties" && typeof v === "boolean") {
      out[k] = v;
    } else {
      out[k] = toGeminiSchema(v);
    }
  }
  return out;
}

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
};

const REFUSAL_REASONS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE"]);

/** OpenAI SDK 오류처럼 status · code · headers를 가진 오류. classifyModelError가 그대로 분류한다. */
class GeminiApiError extends Error {
  status: number;
  code: string;
  headers: Headers;
  constructor(status: number, code: string, message: string, headers: Headers) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function createGeminiClient(apiKey: string, fetchImpl: typeof fetch = fetch): ResponsesClient {
  return {
    responses: {
      async create(params, options) {
        const model = String(params.model);
        const format = (params.text as { format?: { schema?: unknown } } | undefined)?.format;
        const maxOut = Number(params.max_output_tokens) || 6000;
        const body = {
          systemInstruction: { parts: [{ text: String(params.instructions ?? "") }] },
          contents: [{ role: "user", parts: [{ text: String(params.input ?? "") }] }],
          generationConfig: {
            // 생각(thinking) 토큰도 출력 한도에 포함되므로 답변 몫과 별도로 여유를 둔다.
            maxOutputTokens: maxOut + 4096,
            // 생각을 길게 하면 호출 제한 시간(40초)을 넘기므로 짧게 제한한다. 정확성은 서버 검증이 맡는다.
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
            responseMimeType: "application/json",
            ...(format?.schema ? { responseJsonSchema: toGeminiSchema(format.schema) } : {}),
          },
        };

        const ctrl = new AbortController();
        const timer = options?.timeout ? setTimeout(() => ctrl.abort(), options.timeout) : null;
        let res: Response;
        try {
          res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
        } catch (e) {
          const err = e as Error;
          // AbortError → TIMEOUT, 그 밖의 연결 실패 → NETWORK 로 분류된다.
          throw Object.assign(new Error(err.message), { name: err.name === "AbortError" ? "AbortError" : "APIConnectionError" });
        } finally {
          if (timer) clearTimeout(timer);
        }

        if (!res.ok) {
          let reason = "";
          let message = `Gemini API ${res.status}`;
          try {
            const j = (await res.json()) as { error?: { status?: string; message?: string; details?: { reason?: string }[] } };
            reason = j.error?.details?.find((d) => d.reason)?.reason ?? j.error?.status ?? "";
            message = j.error?.message ?? message;
          } catch { /* 본문이 JSON이 아니면 상태 코드만 쓴다 */ }
          // 잘못된 키는 Gemini가 400(API_KEY_INVALID)으로 돌려주므로 인증 실패(401)로 맞춘다.
          const status = reason === "API_KEY_INVALID" ? 401 : res.status;
          throw new GeminiApiError(status, reason === "RESOURCE_EXHAUSTED" && /quota/i.test(message) ? "insufficient_quota" : reason, message, res.headers);
        }

        const data = (await res.json()) as GeminiResponse;
        const u = data.usageMetadata ?? {};
        const usage = {
          input_tokens: u.promptTokenCount ?? 0,
          output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
          total_tokens: u.totalTokenCount ?? 0,
        };
        const cand = data.candidates?.[0];
        const reason = cand?.finishReason ?? "";

        if (data.promptFeedback?.blockReason || REFUSAL_REASONS.has(reason)) {
          return { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }], output_text: "", usage };
        }
        if (!cand) return { status: "failed", output_text: "", usage };
        if (reason === "MAX_TOKENS") {
          return { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: "", usage };
        }
        const text = (cand.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        return { status: "completed", output_text: text, usage };
      },
    },
  };
}

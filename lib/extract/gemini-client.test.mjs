// Gemini 어댑터 테스트. 실제 API는 부르지 않고 fetch를 가짜로 바꾼다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGeminiClient, toGeminiSchema } from "./gemini-client.ts";
import { readConfig, DEFAULT_GEMINI_MODEL } from "./config.ts";
import { classifyModelError } from "./errors.ts";

const PARAMS = {
  model: "gemini-flash-latest",
  instructions: "지시문",
  input: "입력 문서",
  max_output_tokens: 1000,
  store: false,
  text: { format: { type: "json_schema", name: "s", strict: true, schema: { type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "string", minLength: 1, pattern: "x" } } } } },
};

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("요청을 generateContent 모양으로 보내고 키는 헤더로만 전달한다", async () => {
  let seen;
  const client = createGeminiClient("test-key", async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return json(200, { candidates: [{ content: { parts: [{ text: '{"a":"ok"}' }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2, totalTokenCount: 17 } });
  });
  const res = await client.responses.create(PARAMS, { timeout: 5000 });
  assert.match(seen.url, /models\/gemini-flash-latest:generateContent$/);
  assert.doesNotMatch(seen.url, /test-key/);
  assert.equal(seen.init.headers["x-goog-api-key"], "test-key");
  assert.equal(seen.body.systemInstruction.parts[0].text, "지시문");
  assert.equal(seen.body.contents[0].parts[0].text, "입력 문서");
  assert.equal(seen.body.generationConfig.responseMimeType, "application/json");
  assert.equal(seen.body.generationConfig.maxOutputTokens, 1000 + 4096);
  assert.equal(seen.body.generationConfig.thinkingConfig.thinkingBudget, 512);
  assert.deepEqual(res, { status: "completed", output_text: '{"a":"ok"}', usage: { input_tokens: 10, output_tokens: 7, total_tokens: 17 } });
});

test("스키마에서 Gemini가 모르는 키워드는 뺀다", () => {
  assert.deepEqual(toGeminiSchema(PARAMS.text.format.schema), {
    type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "string" } },
  });
});

test("생각 파트는 출력 텍스트에서 제외한다", async () => {
  const client = createGeminiClient("k", async () => json(200, { candidates: [{ content: { parts: [{ text: "생각", thought: true }, { text: "{}" }] }, finishReason: "STOP" }] }));
  assert.equal((await client.responses.create(PARAMS)).output_text, "{}");
});

test("MAX_TOKENS는 incomplete, 안전 차단은 refusal, 후보 없음은 failed", async () => {
  const mk = (body) => createGeminiClient("k", async () => json(200, body)).responses.create(PARAMS);
  const trunc = await mk({ candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] });
  assert.equal(trunc.status, "incomplete");
  assert.equal(trunc.incomplete_details.reason, "max_output_tokens");
  const blocked = await mk({ candidates: [{ finishReason: "SAFETY" }] });
  assert.equal(blocked.output[0].content[0].type, "refusal");
  const promptBlocked = await mk({ promptFeedback: { blockReason: "OTHER" } });
  assert.equal(promptBlocked.output[0].content[0].type, "refusal");
  assert.equal((await mk({})).status, "failed");
});

test("오류는 기존 분류 규칙으로 이어진다", async () => {
  const fail = (status, error) => createGeminiClient("k", async () => json(status, { error })).responses.create(PARAMS).catch((e) => classifyModelError(e).code);
  assert.equal(await fail(400, { status: "INVALID_ARGUMENT", message: "API key not valid", details: [{ reason: "API_KEY_INVALID" }] }), "AUTH_FAILED");
  assert.equal(await fail(403, { status: "PERMISSION_DENIED", message: "denied" }), "AUTH_FAILED");
  assert.equal(await fail(429, { status: "RESOURCE_EXHAUSTED", message: "Too many requests" }), "RATE_LIMITED");
  assert.equal(await fail(429, { status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota" }), "QUOTA_EXCEEDED");
  assert.equal(await fail(404, { status: "NOT_FOUND", message: "model not found" }), "MODEL_NOT_FOUND");
  assert.equal(await fail(503, { status: "UNAVAILABLE", message: "overloaded" }), "MODEL_UNAVAILABLE");
  const net = await createGeminiClient("k", async () => { throw new TypeError("fetch failed"); }).responses.create(PARAMS).catch((e) => classifyModelError(e).code);
  assert.equal(net, "NETWORK");
});

test("시간 초과는 TIMEOUT으로 분류된다", async () => {
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const code = await createGeminiClient("k", slow).responses.create(PARAMS, { timeout: 20 }).catch((e) => classifyModelError(e).code);
  assert.equal(code, "TIMEOUT");
});

test("GEMINI_API_KEY가 있으면 Gemini를 우선 쓴다", () => {
  assert.deepEqual(readConfig({ GEMINI_API_KEY: " g ", OPENAI_API_KEY: "o" }), { apiKey: "g", model: DEFAULT_GEMINI_MODEL, provider: "gemini" });
  assert.equal(readConfig({ GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-2.5-flash" }).model, "gemini-2.5-flash");
  assert.equal(readConfig({ GEMINI_API_KEY: "g", GEMINI_MODEL: "bad model;rm" }).model, DEFAULT_GEMINI_MODEL);
  assert.equal(readConfig({ GEMINI_API_KEY: "  ", OPENAI_API_KEY: "o" }).provider, "openai");
});

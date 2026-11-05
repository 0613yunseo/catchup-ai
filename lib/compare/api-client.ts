// 브라우저에서 /api/analyze/compare를 부르는 함수. 서버 전용 코드를 가져오지 않는다.
import type { CompareOutcome, CompareRequestBody } from "./types.ts";

// 서버 제한 시간(105초)보다 조금 길게 기다린다.
const CLIENT_TIMEOUT_MS = 115_000;

export async function requestCompare(body: CompareRequestBody, signal?: AbortSignal): Promise<CompareOutcome> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/analyze/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const json = (await res.json()) as CompareOutcome;
    if (json && typeof json === "object" && "ok" in json) return json;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (signal?.aborted) throw e; // 사용자가 취소한 경우
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, error: { code: "TIMEOUT", message: "비교가 너무 오래 걸려 기다리기를 중단했습니다. 다시 시도해 주세요." } };
    }
  }
  return {
    ok: false,
    error: { code: "NETWORK", message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요." },
  };
}

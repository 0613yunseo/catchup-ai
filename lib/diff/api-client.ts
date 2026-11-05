// 브라우저에서 /api/analyze/diff를 부르는 함수. 서버 전용 코드를 가져오지 않는다.
import type { DiffOutcome, DiffRequest } from "./types.ts";

// 서버 제한 시간(120초)보다 조금 길게 기다린다.
const CLIENT_TIMEOUT_MS = 125_000;

export async function requestDiff(input: DiffRequest, signal?: AbortSignal): Promise<DiffOutcome> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/analyze/diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const body = (await res.json()) as DiffOutcome;
    if (body && typeof body === "object" && "ok" in body) return body;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (signal?.aborted) throw e; // 사용자가 취소한 경우
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, error: { code: "TIMEOUT", message: "AI 응답이 너무 오래 걸려 기다리기를 중단했습니다. 다시 시도해 주세요." } };
    }
  }
  return {
    ok: false,
    error: { code: "NETWORK", message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요." },
  };
}

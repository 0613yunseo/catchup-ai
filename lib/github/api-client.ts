// 브라우저에서 /api/github/inspect를 부르는 함수. 서버 전용 코드를 가져오지 않는다.
import type { InspectOutcome } from "./types.ts";

export async function requestInspect(repoUrl: string, signal?: AbortSignal): Promise<InspectOutcome> {
  try {
    const res = await fetch("/api/github/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
      signal,
    });
    const body = (await res.json()) as InspectOutcome;
    if (body && typeof body === "object" && "ok" in body) return body;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
  }
  return {
    ok: false,
    error: { code: "NETWORK", message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요." },
  };
}

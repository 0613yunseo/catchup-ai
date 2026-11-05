import { RATE_LIMIT } from "./limits.ts";
import { createLimiter } from "./rate-limit.ts";

// 요구사항 추출과 코드 비교가 같은 요청 제한을 공유한다. (한 사용자의 AI 호출 총량을 제한하기 위해서다.)
// 서버 인스턴스마다 따로 세며, 같은 프로세스 안의 여러 라우트 번들이 한 인스턴스를 쓰도록 globalThis에 둔다.
type G = typeof globalThis & { __catchupLimiter?: ReturnType<typeof createLimiter> };

export function getSharedLimiter() {
  const g = globalThis as G;
  g.__catchupLimiter ??= createLimiter(RATE_LIMIT);
  return g.__catchupLimiter;
}

export function clientKey(request: Request): string {
  const h = request.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

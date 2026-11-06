// 로그인 후 이동할 경로(next)를 검증한다. 같은 사이트의 내부 경로만 허용해 오픈 리다이렉트를 막는다.
export const DEFAULT_AFTER_LOGIN = "/history";

// 로그인 화면 자체로 돌아가는 경로는 허용하지 않는다(무한 이동 방지).
const BLOCKED_PREFIXES = ["/login", "/auth"];

const hasControlChar = (s: string) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
};

export function safeNextPath(raw: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim();
  // 반드시 "/"로 시작하는 상대 경로. "//host"(프로토콜 상대 URL), "/\host", 제어 문자는 거부한다.
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || hasControlChar(v) || v.length > 500) return fallback;
  try {
    const base = "http://internal.invalid";
    const u = new URL(v, base);
    if (u.origin !== base) return fallback;
    if (BLOCKED_PREFIXES.some((p) => u.pathname === p || u.pathname.startsWith(`${p}/`))) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

/** /login?next=... 주소를 만든다. next는 검증된 내부 경로만 담긴다. */
export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}

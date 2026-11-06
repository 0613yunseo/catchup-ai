// Supabase 연결 설정. 값이 없거나 올바르지 않으면 null을 돌려주며, 이때 앱은 Supabase 없이 기존 방식(비로그인 분석)으로 동작한다.
// 주의: NEXT_PUBLIC_* 값은 브라우저 번들에 들어가므로 아래처럼 process.env.NEXT_PUBLIC_X를 직접 참조해야 한다.
// 이 변수들은 공개되는 값이다. service_role / secret 키는 어떤 환경 변수에도 넣지 않는다.
export type SupabaseConfig = { url: string; publishableKey: string };

// 비밀 키(sb_secret_..., 또는 role이 service_role인 JWT)가 공개 변수에 잘못 들어간 경우를 막는다.
function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.role === "service_role";
  } catch {
    return false;
  }
}

export function parseSupabaseConfig(urlRaw: string | undefined, keyRaw: string | undefined): SupabaseConfig | null {
  const url = urlRaw?.trim();
  const key = keyRaw?.trim();
  if (!url || !key) return null;
  let origin: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))) return null;
    origin = u.origin;
  } catch {
    return null;
  }
  if (looksLikeSecretKey(key)) return null;
  return { url: origin, publishableKey: key };
}

export function getSupabaseConfig(): SupabaseConfig | null {
  return parseSupabaseConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export const isSupabaseConfigured = () => getSupabaseConfig() !== null;

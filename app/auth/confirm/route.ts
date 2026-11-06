import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "recovery", "invite", "email_change"];

// GET /auth/confirm — 이메일 링크의 인증을 마무리한다.
//  - token_hash + type : 이메일 템플릿을 token_hash 링크로 바꿨을 때(다른 브라우저에서 열어도 동작)
//  - code             : 기본 템플릿의 PKCE 링크(링크를 요청한 브라우저에서 열어야 동작)
// 이동할 경로(next)는 같은 사이트의 내부 경로만 허용한다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, origin));

  const db = await createClient();
  if (!db) return fail("not_configured");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail("link") : NextResponse.redirect(new URL(next, origin));
  }
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    return error ? fail("link") : NextResponse.redirect(new URL(next, origin));
  }
  return fail("link");
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loginUrl } from "@/lib/auth/redirect";
import { getSupabaseConfig } from "@/lib/supabase/config";

// 로그인이 필요한 화면(/history)에서만 동작한다. 세션 쿠키를 갱신하고, 검증된 사용자(getUser)가 없으면 로그인으로 보낸다.
// /analyze, /report, 홈은 matcher에 없으므로 로그인 없이 기존처럼 동작하고, Supabase 설정이 없을 때도 아무 일도 하지 않는다.
export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // 쿠키의 값을 그대로 믿지 않고 Supabase 인증 서버에서 확인한다.
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const target = request.nextUrl.pathname + request.nextUrl.search;
    const redirect = NextResponse.redirect(new URL(loginUrl(target), request.url));
    // 세션 갱신 중 만들어진 쿠키(만료 정리 등)를 리다이렉트 응답에도 싣는다.
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/history/:path*"],
};

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config.ts";

// 서버(Route Handler, Server Action, 요청 시점의 서버 컴포넌트)용 Supabase 클라이언트.
// cookies()는 요청 시점 API이므로 Suspense 안이나 요청 처리 중에만 호출한다. 설정이 없으면 null.
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 이후 단계에서 추가할 proxy가 맡는다.
        }
      },
    },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config.ts";

// 브라우저용 Supabase 클라이언트. 설정이 없으면 null이므로 호출하는 쪽은 "로그인 기능 없음"으로 처리한다.
export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.publishableKey);
}

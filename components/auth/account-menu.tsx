"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loginUrl } from "@/lib/auth/redirect";
import { clearPending } from "@/lib/pending-report";
import { clearReport } from "@/lib/report-store";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// 사이드바의 로그인 상태 표시. Supabase가 설정되지 않았으면 아무것도 그리지 않아 기존 화면이 그대로 유지된다.
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const configured = isSupabaseConfigured();
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined: 확인 중

  useEffect(() => {
    const db = createClient();
    if (!db) return;
    let alive = true;
    // 서버가 검증한 사용자 정보로 로그인 상태를 정한다.
    void db.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? null);
    });
    const { data: sub } = db.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user?.email ?? null);
      if (event === "SIGNED_OUT") {
        // 다른 탭에서 로그아웃해도 이 브라우저에 남은 리포트가 다음 사용자에게 보이지 않게 한다.
        clearReport();
        clearPending();
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!configured || email === undefined) return null;

  async function signOut() {
    const db = createClient();
    await db?.auth.signOut();
    clearReport();
    clearPending();
    router.replace("/");
    router.refresh();
  }

  const cls = "text-sm text-muted hover:text-fg";
  if (email === null) {
    return (
      <Link href={loginUrl(pathname)} className={`${cls} ${compact ? "px-2" : "block py-1"}`}>
        로그인
      </Link>
    );
  }
  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
      {!compact && <p className="truncate text-sm text-faint" title={email}>{email}</p>}
      <button type="button" onClick={() => void signOut()} className={cls}>
        로그아웃
      </button>
    </div>
  );
}

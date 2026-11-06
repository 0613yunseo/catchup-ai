"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { btnPrimary } from "@/components/button-styles";
import { InfoIcon } from "@/components/icons";
import { ReportWorkspace } from "@/components/report/report-workspace";
import { loginUrl } from "@/lib/auth/redirect";
import { DB_MESSAGES, fetchReport, type DbErrorCode } from "@/lib/reports/cloud";
import type { Report } from "@/lib/report";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Loaded = { id: string; report: Report; createdAt: string } | { id: string; code: DbErrorCode };

// 저장된 기록 한 건을 기존 리포트 화면으로 보여 준다. 저장된 JSON을 그대로 쓰며 AI를 다시 호출하지 않는다.
// 이 화면의 리포트는 현재 탭의 분석 결과(sessionStorage)를 건드리지 않는다.
export function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const configured = isSupabaseConfigured();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const db = createClient();
    if (!db) return;
    let alive = true;
    void fetchReport(db, id).then((r) => {
      if (alive) setLoaded(r.ok ? { id, report: r.report, createdAt: r.createdAt } : { id, code: r.code });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const back = (
    <Link href="/history" className="text-sm text-accent-text underline-offset-2 hover:underline">
      ← 분석 기록
    </Link>
  );

  if (!configured) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">분석 기록 저장 기능이 설정되지 않았습니다.</div>;
  }
  const cur = loaded && loaded.id === id ? loaded : null;
  if (!cur) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">기록을 불러오는 중…</div>;
  if ("code" in cur) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        {back}
        <p role="alert" className="flex items-start gap-2 text-sm text-bad">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          {DB_MESSAGES[cur.code]}
        </p>
        {cur.code === "UNAUTHENTICATED" && (
          <Link href={loginUrl(`/history/${id}`)} className={btnPrimary}>
            로그인
          </Link>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8">{back}</div>
      <ReportWorkspace report={cur.report} cloud={{ createdAt: cur.createdAt }} />
    </div>
  );
}

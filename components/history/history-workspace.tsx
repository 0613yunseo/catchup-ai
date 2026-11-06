"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { InfoIcon } from "@/components/icons";
import { NewAnalysisLink } from "@/components/new-analysis-link";
import { loginUrl } from "@/lib/auth/redirect";
import { DB_MESSAGES, PAGE_SIZE, deleteReport, listReports, type DbErrorCode, type HistoryRow, type ListQuery } from "@/lib/reports/cloud";
import { STATUSES, STATUS_META } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Mode = ListQuery["mode"];
type Loaded = { key: string; rows: HistoryRow[]; total: number } | { key: string; code: DbErrorCode };

const MODE_LABEL = { single: "단일 문서 분석", diff: "회의 변경 비교" } as const;
const FILTERS: { value: Mode; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "single", label: "단일 문서 분석" },
  { value: "diff", label: "회의 변경 비교" },
];

const when = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
};

// 저장된 분석 기록 목록. 조회·삭제는 로그인한 사용자의 세션으로 하며, 본인 기록만 보이는 것은 DB의 RLS가 보장한다.
export function HistoryWorkspace() {
  const configured = isSupabaseConfigured();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [page, setPage] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const key = JSON.stringify([q, mode, page, reloadTick]);

  // 검색어 입력이 멈춘 뒤에 조회한다.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const db = createClient();
    if (!db) return;
    let alive = true;
    void listReports(db, { q, mode, page }).then((r) => {
      if (!alive) return;
      setLoaded(r.ok ? { key, rows: r.rows, total: r.total } : { key, code: r.code });
    });
    return () => {
      alive = false;
    };
  }, [key, q, mode, page]);

  async function remove(id: string) {
    const db = createClient();
    if (!db) return;
    setDeleting(id);
    const r = await deleteReport(db, id);
    setDeleting(null);
    setConfirmId(null);
    if (r.ok) {
      setNotice({ tone: "ok", text: "기록을 삭제했습니다." });
      // 마지막 남은 항목을 지웠다면 이전 쪽으로 돌아간다.
      if (loaded && "rows" in loaded && loaded.rows.length === 1 && page > 0) setPage(page - 1);
      setReloadTick((n) => n + 1);
    } else {
      setNotice({ tone: "bad", text: DB_MESSAGES[r.code] });
    }
  }

  if (!configured) {
    return (
      <p className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
        분석 기록 저장 기능이 설정되지 않았습니다. 로그인 없이도 분석과 리포트 보기는 그대로 사용할 수 있습니다.
      </p>
    );
  }

  const current = loaded && loaded.key === key ? loaded : null;
  const ok = current && "rows" in current ? current : null;
  const err = current && "code" in current ? current.code : null;
  const pages = ok ? Math.max(1, Math.ceil(ok.total / PAGE_SIZE)) : 1;
  const filtering = q !== "" || mode !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="history-q" className="mb-1.5 block text-sm font-medium">
            프로젝트 이름 검색
          </label>
          <input
            id="history-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="프로젝트 이름"
            autoComplete="off"
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-faint sm:text-sm"
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">분석 유형</legend>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <label
                key={f.value}
                className="cursor-pointer rounded-md border border-line-strong bg-surface px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="history-mode"
                  value={f.value}
                  checked={mode === f.value}
                  onChange={() => {
                    setMode(f.value);
                    setPage(0);
                  }}
                  className="sr-only"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div aria-live="polite">
        {notice && (
          <p role="status" className={`flex items-start gap-2 text-sm ${notice.tone === "ok" ? "text-ok" : "text-bad"}`}>
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {notice.text}
          </p>
        )}
      </div>

      {!current && <p className="text-sm text-muted">기록을 불러오는 중…</p>}

      {err && (
        <div role="alert" className="space-y-3 rounded-lg border border-line bg-surface p-5">
          <p className="flex items-start gap-2 text-sm text-bad">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {DB_MESSAGES[err]}
          </p>
          {err === "UNAUTHENTICATED" ? (
            <Link href={loginUrl("/history")} className={btnPrimary}>
              로그인
            </Link>
          ) : (
            <button type="button" onClick={() => setReloadTick((n) => n + 1)} className={btnSecondary}>
              다시 시도
            </button>
          )}
        </div>
      )}

      {ok && ok.rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
          <p className="font-medium">{filtering ? "조건에 맞는 기록이 없습니다." : "저장된 분석 기록이 없습니다."}</p>
          <p className="mt-1 text-sm text-muted">
            {filtering ? "검색어나 분석 유형을 바꿔 보세요." : "분석을 마친 뒤 리포트 화면에서 ‘클라우드에 저장’을 누르면 여기에 나타납니다."}
          </p>
          {!filtering && (
            <NewAnalysisLink className={`${btnPrimary} mt-4`}>새 분석 시작</NewAnalysisLink>
          )}
        </div>
      )}

      {ok && ok.rows.length > 0 && (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {ok.rows.map((r) => (
              <li key={r.id} className="space-y-2 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <Link href={`/history/${r.id}`} className="break-words font-medium text-fg underline-offset-2 hover:underline">
                      {r.project_name}
                    </Link>
                    <p className="mt-0.5 break-all font-mono text-xs text-faint">{r.repo_url.replace("https://github.com/", "")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={`/history/${r.id}`} className={btnSecondary}>
                      리포트 보기
                    </Link>
                    {confirmId !== r.id && (
                      <button type="button" onClick={() => setConfirmId(r.id)} disabled={deleting !== null} className="px-2 text-sm text-muted hover:text-bad disabled:opacity-50">
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-fg">{MODE_LABEL[r.mode]}</span>
                  <span>{when(r.created_at)}</span>
                  <span>요구사항 {r.requirement_count}건</span>
                </p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {STATUSES.filter((s) => (r.status_counts?.[s] ?? 0) > 0).map((s) => (
                    <span key={s}>
                      {STATUS_META[s].label} <strong className="tabular-nums text-fg">{r.status_counts[s]}</strong>
                    </span>
                  ))}
                </p>
                {confirmId === r.id && (
                  <div role="alertdialog" aria-label="기록 삭제 확인" className="flex flex-wrap items-center gap-3 rounded-md bg-bad-soft px-3 py-2 text-sm">
                    <p className="text-bad">이 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void remove(r.id)} disabled={deleting === r.id} className="rounded-md bg-bad px-3 py-1 text-sm font-medium text-canvas disabled:opacity-60">
                        {deleting === r.id ? "삭제 중…" : "삭제"}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} disabled={deleting === r.id} className="px-2 text-sm text-muted underline underline-offset-2">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <nav aria-label="페이지 이동" className="flex items-center justify-between gap-3 text-sm">
            <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} className={`${btnSecondary} disabled:opacity-50`}>
              이전
            </button>
            <p className="tabular-nums text-muted">
              {page + 1} / {pages}쪽 · 전체 {ok.total}건
            </p>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page + 1 >= pages} className={`${btnSecondary} disabled:opacity-50`}>
              다음
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

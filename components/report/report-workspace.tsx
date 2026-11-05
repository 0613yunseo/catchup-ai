"use client";

import Link from "next/link";
import { useState } from "react";
import { btnSecondary } from "@/components/button-styles";
import { CodePanel, CodePanelEmpty } from "@/components/code-panel";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_DOT } from "@/components/report/status-dot";
import type { Report } from "@/lib/report";
import { STATUSES, STATUS_META, type Status } from "@/lib/status";
import { INPUT_TYPES } from "@/lib/validate";

const sourceLabel = (s: string) => INPUT_TYPES.find((t) => t.value === s)?.label ?? s;

const PARTS = [
  "요구사항 원문과 출처 문서",
  "판정 상태와 판정 이유",
  "근거 코드의 파일 경로와 라인 범위",
  "코드 스니펫",
  "개선 권고",
];

function Summary({
  report,
  filter,
  onFilter,
}: {
  report: Report | null;
  filter: Status | null;
  onFilter: (s: Status | null) => void;
}) {
  const reqs = report?.requirements;
  const count = (s: Status) => reqs?.filter((r) => r.status === s).length;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
      <div className="bg-surface p-4">
        <dt className="text-sm text-muted">전체 요구사항</dt>
        <dd className="mt-1 text-3xl font-semibold tabular-nums">
          {reqs?.length ?? <span aria-label="데이터 없음">—</span>}
        </dd>
      </div>
      {STATUSES.map((s) => {
        const n = count(s);
        const active = filter === s;
        const inner = (
          <>
            <dt className="flex items-center gap-2 text-sm text-muted">
              <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
              {STATUS_META[s].label}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">
              {n ?? <span aria-label="데이터 없음">—</span>}
            </dd>
          </>
        );
        return reqs ? (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onFilter(active ? null : s)}
            className={`p-4 text-left transition-colors hover:bg-sunken max-sm:last:col-span-2 ${active ? "bg-accent-soft" : "bg-surface"}`}
          >
            {inner}
          </button>
        ) : (
          <div key={s} className="bg-surface p-4 max-sm:last:col-span-2">
            {inner}
          </div>
        );
      })}
    </dl>
  );
}

function EmptyWorkspace() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="rounded-lg border border-dashed border-line-strong p-6">
        <h2 className="text-base font-semibold">아직 분석 결과가 없습니다</h2>
        <p className="mt-2 text-sm text-muted">
          분석 엔진이 연결되지 않아 리포트를 만들 수 없습니다. 위의 — 는 실제 값이 아니라 비어 있는 상태입니다.
        </p>
        <p className="mt-5 text-sm font-medium">결과가 생기면 요구사항마다 표시되는 것</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {PARTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Link href="/analyze" className={`${btnSecondary} mt-6`}>
          분석 입력 화면으로
        </Link>
      </section>
      <section aria-label="코드 근거 영역" className="space-y-3">
        <h2 className="text-sm font-semibold">코드 근거</h2>
        <CodePanelEmpty />
      </section>
    </div>
  );
}

export function ReportWorkspace({ report }: { report: Report | null }) {
  const [filter, setFilter] = useState<Status | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ id: string; idx: number } | null>(null);
  const [tab, setTab] = useState<"list" | "detail">("list");

  const reqs = report?.requirements ?? [];
  const visible = filter ? reqs.filter((r) => r.status === filter) : reqs;
  const current = visible.find((r) => r.id === selected) ?? visible[0];
  const evIdx = evidence && current && evidence.id === current.id ? evidence.idx : 0;
  const ev = current?.evidence[evIdx];
  const recs = reqs.filter((r) => r.status !== "VERIFIED" && r.recommendation);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">분석 리포트</h1>
          <p className="mt-1.5 break-all text-muted">
            {report ? `${report.projectName} · ${report.repoUrl}` : "분석 결과가 없는 상태입니다."}
          </p>
        </div>
        <div className="flex gap-2">
          {report && (
            <Link href="/analyze" className={btnSecondary}>
              재분석
            </Link>
          )}
          <Link href="/analyze" className={btnSecondary}>
            새 분석
          </Link>
        </div>
      </header>

      <Summary report={report} filter={filter} onFilter={setFilter} />

      <div className="mt-6">
        {!report || !current ? (
          report ? (
            <p className="rounded-lg border border-dashed border-line-strong p-6 text-sm text-muted">
              이 상태에 해당하는 요구사항이 없습니다.
            </p>
          ) : (
            <EmptyWorkspace />
          )
        ) : (
          <>
            <div role="tablist" aria-label="보기 전환" className="mb-3 flex gap-1 lg:hidden">
              {(["list", "detail"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    tab === t ? "bg-accent-soft font-medium text-accent-text" : "text-muted"
                  }`}
                >
                  {t === "list" ? "요구사항 목록" : "상세·코드 근거"}
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
              <section
                aria-label="요구사항 목록"
                className={`${tab === "list" ? "" : "hidden"} lg:block`}
              >
                <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                  {visible.map((r) => {
                    const on = r.id === current.id;
                    return (
                      <li key={r.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          aria-current={on ? "true" : undefined}
                          onClick={() => {
                            setSelected(r.id);
                            setTab("detail");
                          }}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken ${
                            on ? "bg-accent-soft hover:bg-accent-soft" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STATUS_DOT[r.status]}`}
                            title={STATUS_META[r.status].label}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.text}</span>
                            <span className="mt-0.5 block text-xs text-faint">
                              {r.id} · {sourceLabel(r.source)} · {STATUS_META[r.status].label}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section
                aria-label="요구사항 상세"
                className={`${tab === "detail" ? "" : "hidden"} min-w-0 space-y-6 lg:block`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-faint">
                      {current.id} · {sourceLabel(current.source)}
                    </p>
                    <StatusBadge status={current.status} />
                  </div>
                  <h2 className="mt-2 text-xl font-semibold leading-snug">{current.text}</h2>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold">판정 이유</h3>
                    <p className="mt-1.5 text-sm text-muted">{current.reason}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">근거 문서</h3>
                    <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-sm text-muted">
                      <span className="text-faint">{sourceLabel(current.source)} · </span>
                      {current.text}
                    </blockquote>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">코드 근거</h3>
                  {current.evidence.length === 0 || !ev ? (
                    <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-faint">
                      연결된 코드 근거가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {current.evidence.length > 1 && (
                        <div role="tablist" aria-label="근거 파일" className="flex flex-wrap gap-1">
                          {current.evidence.map((e, i) => (
                            <button
                              key={`${e.path}:${e.startLine}`}
                              role="tab"
                              type="button"
                              aria-selected={i === evIdx}
                              onClick={() => setEvidence({ id: current.id, idx: i })}
                              className={`max-w-full truncate rounded-md px-2.5 py-1 font-mono text-xs ${
                                i === evIdx ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-sunken"
                              }`}
                            >
                              {e.path.split("/").pop()}
                            </button>
                          ))}
                        </div>
                      )}
                      <CodePanel {...ev} />
                      {ev.note && <p className="text-sm text-muted">{ev.note}</p>}
                    </div>
                  )}
                </div>

                {current.recommendation && (
                  <div className="rounded-lg bg-accent-soft p-4 text-sm">
                    <h3 className="font-semibold text-accent-text">개선 권고</h3>
                    <p className="mt-1">{current.recommendation}</p>
                  </div>
                )}
              </section>
            </div>

            {recs.length > 0 && (
              <section className="mt-10">
                <h2 className="text-base font-semibold">개선 권고 모음</h2>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {recs.map((r) => (
                    <li key={r.id} className="py-3 text-sm">
                      <span className="text-faint">{r.id}</span> {r.recommendation}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

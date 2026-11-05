"use client";

import { useState } from "react";
import { CoverageNotice } from "@/components/report/coverage-notice";
import { EmptyWorkspace, type EmptyReason } from "@/components/report/empty-workspace";
import { ReportHeader } from "@/components/report/report-header";
import { RequirementDetail } from "@/components/report/requirement-detail";
import { RequirementList } from "@/components/report/requirement-list";
import { SummaryStrip } from "@/components/report/summary-strip";
import type { Report } from "@/lib/report";
import type { Status } from "@/lib/status";
import { summarize } from "@/lib/summarize";

// 선택·필터·탭 상태만 가진다. 내용은 각 하위 컴포넌트가 Report 타입에서 읽는다.
type Props = {
  report: Report | null;
  /** report가 없을 때 이유. 기본은 저장된 결과 없음 */
  emptyReason?: EmptyReason;
  onClear?: () => void;
};

export function ReportWorkspace({ report, emptyReason = "none", onClear }: Props) {
  const [filter, setFilter] = useState<Status | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ id: string; idx: number } | null>(null);
  const [tab, setTab] = useState<"list" | "detail">("list");

  const reqs = report?.requirements ?? [];
  const visible = filter ? reqs.filter((r) => r.status === filter) : reqs;
  const current = visible.find((r) => r.id === selected) ?? visible[0];
  const evIdx = evidence && current && evidence.id === current.id ? evidence.idx : 0;
  const recs = reqs.filter((r) => r.status !== "VERIFIED" && r.recommendation);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <ReportHeader report={report} />
      <SummaryStrip summary={report ? summarize(reqs) : null} filter={filter} onFilter={setFilter} />
      {report && <CoverageNotice report={report} />}

      <div className="mt-6">
        {!report ? (
          <EmptyWorkspace reason={emptyReason} onClear={onClear} />
        ) : !current ? (
          <p className="rounded-lg border border-dashed border-line-strong p-6 text-sm text-muted">
            이 상태에 해당하는 요구사항이 없습니다.
          </p>
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

            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
              <section aria-label="요구사항 목록" className={`${tab === "list" ? "" : "hidden"} lg:block`}>
                <RequirementList
                  items={visible}
                  selectedId={current.id}
                  onSelect={(id) => {
                    setSelected(id);
                    setTab("detail");
                  }}
                />
              </section>
              <section aria-label="요구사항 상세" className={`${tab === "detail" ? "" : "hidden"} lg:block`}>
                <RequirementDetail
                  req={current}
                  evidenceIdx={evIdx}
                  onEvidence={(idx) => setEvidence({ id: current.id, idx })}
                />
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

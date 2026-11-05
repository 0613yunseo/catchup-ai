import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { RequirementCard } from "@/components/report/requirement-card";
import { StatusBadge } from "@/components/status-badge";
import type { Report } from "@/lib/report";
import { STATUSES, STATUS_META } from "@/lib/status";

const CARD_PARTS = [
  "요구사항 원문과 출처(회의록 · 교수 피드백 · 요구사항)",
  "상태: VERIFIED / PARTIAL / MISMATCH / UNKNOWN",
  "판단 이유",
  "코드 근거: 파일 경로와 라인 범위, 해당 코드 일부",
  "개선 권고",
];

function Summary({ report }: { report: Report | null }) {
  const reqs = report?.requirements;
  const cells = [
    { key: "total", label: "전체 요구사항", value: reqs?.length, badge: null },
    ...STATUSES.map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      value: reqs?.filter((r) => r.status === s).length,
      badge: s,
    })),
  ];
  return (
    <dl className="grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-surface sm:grid-cols-5 sm:divide-x [&>div]:border-line max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(even)]:border-l">
      {cells.map((c) => (
        <div key={c.key} className="p-4">
          <dt className="text-sm text-muted">{c.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {c.value ?? <span aria-label="데이터 없음">—</span>}
          </dd>
          {c.badge && <p className="mt-1 font-mono text-xs text-faint">{c.badge}</p>}
        </div>
      ))}
    </dl>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-line-strong p-6 sm:p-8">
      <h2 className="text-lg font-semibold">아직 분석 결과가 없습니다</h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        분석 엔진이 연결되지 않아 리포트를 만들 수 없습니다. 위의 숫자는 실제 결과가 아니라 비어
        있는 상태이며, 분석 결과가 생기면 요구사항마다 아래 항목이 표시됩니다.
      </p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
        {CARD_PARTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <Link href="/analyze" className={`${btnPrimary} mt-6`}>
        분석 입력 화면으로
      </Link>
    </section>
  );
}

export function ReportView({ report }: { report: Report | null }) {
  const recommendations =
    report?.requirements.filter((r) => r.status !== "VERIFIED" && r.recommendation) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">분석 리포트</h1>
          <p className="mt-2 break-all text-muted">
            {report
              ? `${report.projectName} · ${report.repoUrl}`
              : "분석 결과가 없는 상태입니다."}
          </p>
        </div>
        <div className="flex gap-2">
          {report && (
            <Link href="/analyze" className={btnSecondary}>
              재분석
            </Link>
          )}
          <Link href="/analyze" className={report ? btnPrimary : btnSecondary}>
            새 분석
          </Link>
        </div>
      </header>

      <Summary report={report} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-10">
          {report ? (
            <section aria-label="요구사항별 결과" className="space-y-4">
              {report.requirements.map((r) => (
                <RequirementCard key={r.id} req={r} />
              ))}
            </section>
          ) : (
            <EmptyState />
          )}

          {recommendations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">개선 권고</h2>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {recommendations.map((r) => (
                  <li key={r.id} className="py-3 text-sm">
                    <span className="font-mono text-faint">{r.id}</span> {r.recommendation}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-label="상태 기준">
          <h2 className="text-sm font-semibold">상태 기준</h2>
          <ul className="mt-3 space-y-4 border-t border-line pt-4">
            {STATUSES.map((s) => (
              <li key={s}>
                <StatusBadge status={s} />
                <p className="mt-1.5 text-sm text-muted">{STATUS_META[s].description}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

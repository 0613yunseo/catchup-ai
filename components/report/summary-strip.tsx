import { STATUS_DOT } from "@/components/report/status-dot";
import type { ReportSummary } from "@/lib/summarize";
import { STATUSES, STATUS_META, type Status } from "@/lib/status";

type Props = {
  /** null이면 결과 없음: 값은 —로 표시하고 필터를 켜지 않는다. */
  summary: ReportSummary | null;
  filter: Status | null;
  onFilter: (s: Status | null) => void;
};

export function SummaryStrip({ summary, filter, onFilter }: Props) {
  const dash = <span aria-label="데이터 없음">—</span>;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
      <div className="bg-surface p-4">
        <dt className="text-sm text-muted">전체 요구사항</dt>
        <dd className="mt-1 text-3xl font-semibold tabular-nums">{summary?.total ?? dash}</dd>
      </div>
      {STATUSES.map((s) => {
        const active = filter === s;
        const inner = (
          <>
            <dt className="flex items-center gap-2 text-sm text-muted">
              <span className={`size-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
              {STATUS_META[s].label}
            </dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">
              {summary ? summary.byStatus[s] : dash}
            </dd>
          </>
        );
        return summary ? (
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

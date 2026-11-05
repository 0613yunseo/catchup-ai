import { CHANGE_KINDS, CHANGE_LABEL, type ChangeKind } from "@/lib/diff/types";
import type { Requirement } from "@/lib/report";

type Props = {
  items: Requirement[];
  filter: ChangeKind | null;
  onFilter: (k: ChangeKind | null) => void;
};

// 회의 변경 유형별 개수와 필터. 구현 상태(SummaryStrip)와는 별개의 분류이다.
export function ChangeStrip({ items, filter, onFilter }: Props) {
  const count = (k: ChangeKind) => items.filter((r) => r.change?.kind === k).length;
  const review = items.filter((r) => r.change?.needsReview).length;
  return (
    <section aria-label="회의 변경 유형" className="mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold">회의 변경 유형</h2>
        <div className="flex flex-wrap gap-1.5">
          {CHANGE_KINDS.map((k) => {
            const n = count(k);
            const on = filter === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                disabled={n === 0}
                onClick={() => onFilter(on ? null : k)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                  on ? "border-accent bg-accent-soft font-semibold text-accent-text" : "border-line-strong bg-surface hover:bg-sunken"
                }`}
              >
                {CHANGE_LABEL[k]} <span className="tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
        {review > 0 && <p className="text-xs text-warn">추가 확인이 필요한 항목 {review}건</p>}
      </div>
    </section>
  );
}

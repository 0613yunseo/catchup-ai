import { ChangeBadge } from "@/components/change-badge";
import { STATUS_DOT } from "@/components/report/status-dot";
import type { Requirement } from "@/lib/report";
import { sourceLabel } from "@/lib/source-label";
import { STATUS_META } from "@/lib/status";

type Props = {
  items: Requirement[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function RequirementList({ items, selectedId, onSelect }: Props) {
  return (
    <ul className="overflow-hidden rounded-lg border border-line bg-surface">
      {items.map((r) => {
        const on = r.id === selectedId;
        return (
          <li key={r.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => onSelect(r.id)}
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
                {r.change && (
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ChangeBadge kind={r.change.kind} />
                    {r.change.needsReview && <span className="text-xs text-warn">확인 필요</span>}
                  </span>
                )}
                <span className="mt-0.5 block text-xs text-faint">
                  {r.id} · {sourceLabel(r.source)} · {STATUS_META[r.status].label}
                  {r.decisionType === "suggestion" ? " · 제안" : r.decisionType === "undecided" ? " · 미확정" : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

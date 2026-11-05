import { CHANGE_LABEL, type ChangeKind } from "@/lib/diff/types";

// 변경 유형 표시. 구현 상태(StatusBadge, 둥근 알약)와 모양을 달리해 서로 다른 정보임을 보여 준다.
// 충돌·불확실은 사람이 확인해야 하는 항목이라 경고색을 쓰고, 색에만 의존하지 않도록 글자를 함께 쓴다.
const WARN = new Set<ChangeKind>(["CONFLICT", "UNCERTAIN"]);

export function ChangeBadge({ kind }: { kind: ChangeKind }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
        WARN.has(kind) ? "border-warn/50 bg-warn-soft text-warn" : "border-line-strong bg-surface text-fg"
      }`}
    >
      <span className="font-mono">{kind}</span>
      <span aria-hidden="true">·</span>
      {CHANGE_LABEL[kind]}
    </span>
  );
}

import {
  CheckCircleIcon,
  HelpCircleIcon,
  MinusCircleIcon,
  XCircleIcon,
} from "@/components/icons";
import { STATUS_META, type Status } from "@/lib/status";

const ICONS = {
  VERIFIED: CheckCircleIcon,
  PARTIAL: MinusCircleIcon,
  MISMATCH: XCircleIcon,
  UNKNOWN: HelpCircleIcon,
} satisfies Record<Status, typeof CheckCircleIcon>;

// 색에만 의존하지 않도록 아이콘과 텍스트를 함께 표시한다.
export function StatusBadge({ status }: { status: Status }) {
  const { label, tone } = STATUS_META[status];
  const Icon = ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <Icon className="size-3.5" />
      <span className="font-mono">{status}</span>
      <span aria-hidden="true">·</span>
      {label}
    </span>
  );
}

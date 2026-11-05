import type { Requirement } from "@/lib/report";
import type { Status } from "@/lib/status";

export type ReportSummary = { total: number; byStatus: Record<Status, number> };

// 요약 집계는 UI와 분리한다. 이전 결과와의 비교 등 다른 곳에서도 같은 함수를 쓴다.
export function summarize(requirements: Requirement[]): ReportSummary {
  const byStatus: Record<Status, number> = { VERIFIED: 0, PARTIAL: 0, MISMATCH: 0, UNKNOWN: 0 };
  for (const r of requirements) byStatus[r.status]++;
  return { total: requirements.length, byStatus };
}

// 코드 비교 결과(Report)에 변경 정보를 붙인다. 구현 상태(status)와 변경 유형(change.kind)은 서로 다른 필드이다.
import type { Report, RequirementChange } from "../report.ts";
import type { ChangeItem } from "./types.ts";

export function toRequirementChange(it: ChangeItem): RequirementChange {
  return {
    kind: it.kind,
    summary: it.summary,
    needsReview: it.needsReview,
    ...(it.reviewReason ? { reviewReason: it.reviewReason } : {}),
    ...(it.serverNote ? { serverNote: it.serverNote } : {}),
    ...(it.previous ? { previous: { text: it.previous.title, quote: it.previous.quote } } : {}),
    ...(it.latest ? { latest: { text: it.latest.title, quote: it.latest.quote } } : {}),
  };
}

/** 같은 id의 요구사항에 change를 붙이고 mode를 "diff"로 바꾼다. 원본 report는 바꾸지 않는다. */
export function attachChanges(report: Report, items: ChangeItem[]): Report {
  const byId = new Map(items.map((it) => [it.id, it]));
  return {
    ...report,
    mode: "diff",
    requirements: report.requirements.map((r) => {
      const it = byId.get(r.id);
      return it ? { ...r, change: toRequirementChange(it) } : r;
    }),
  };
}

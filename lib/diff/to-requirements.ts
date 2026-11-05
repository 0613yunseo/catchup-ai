// 변경 항목을 기존 코드 비교 엔진이 받는 요구사항(ExtractedRequirement)으로 바꾼다.
// 코드 비교는 이 요구사항만 보고 판정하며, 변경 유형은 구현 상태와 별개로 리포트에 따로 붙는다.
import type { ChangeType, ExtractedRequirement } from "../extract/types.ts";
import type { ChangeItem, ChangeKind } from "./types.ts";

const CHANGE_TYPE: Record<ChangeKind, ChangeType> = {
  ADDED: "new",
  MODIFIED: "changed",
  REMOVED: "removed",
  UNCHANGED: "unspecified",
  CONFLICT: "unspecified",
  UNCERTAIN: "unspecified",
};

export function toRequirement(it: ChangeItem): ExtractedRequirement {
  // 삭제는 "없어져야 할 기능"을 설명하는 이전 쪽 내용을 쓰고, 근거는 최신 회의록의 삭제 결정 문장이다.
  // 그 밖에는 최신 회의록 내용을 쓰고, 최신 쪽이 없으면(불확실) 이전 쪽 내용을 쓴다.
  const content = it.kind === "REMOVED" ? it.previous ?? it.latest : it.latest ?? it.previous;
  const quote = it.kind === "REMOVED" ? (it.latest ?? it.previous) : content;
  const c = content!;
  return {
    id: it.id,
    title: c.title,
    description: c.description,
    sourceType: "meeting",
    sourceQuote: quote!.quote,
    // 확정되지 않았거나 충돌하는 항목은 undecided라서 코드 비교가 모델 호출 없이 UNKNOWN으로 둔다.
    decisionType: it.latestDecision ?? "undecided",
    changeType: CHANGE_TYPE[it.kind],
    ambiguity: it.reviewReason,
  };
}

export const toRequirements = (items: ChangeItem[]): ExtractedRequirement[] => items.map(toRequirement);

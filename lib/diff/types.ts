// 회의 변경 비교 타입. 서버 모듈, API 응답, 화면, 리포트가 함께 쓴다. (런타임 코드는 상수뿐)
import type { DecisionType, ExtractedRequirement, ExtractErrorInfo, ExtractUsage } from "../extract/types.ts";

export const CHANGE_KINDS = ["ADDED", "MODIFIED", "REMOVED", "UNCHANGED", "CONFLICT", "UNCERTAIN"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  ADDED: "추가",
  MODIFIED: "변경",
  REMOVED: "삭제",
  UNCHANGED: "유지",
  CONFLICT: "충돌 가능",
  UNCERTAIN: "불확실",
};

/** 한 회의록에서 가져온 요구사항. quote는 그 회의록에 실제로 있다고 서버가 확인했다. */
export type ChangeSide = { title: string; description: string; quote: string };

export type ChangeItem = {
  /** 이 변경 항목에서 만든 요구사항의 id (R-1, R-2 ...). 코드 비교 결과와 같은 id를 쓴다. */
  id: string;
  kind: ChangeKind;
  summary: string;
  previous: ChangeSide | null;
  latest: ChangeSide | null;
  /** 최신 회의록 쪽 결정 상태. 최신 쪽 근거가 없으면 null */
  latestDecision: DecisionType | null;
  /** 사람이 추가로 확인해야 하는지 */
  needsReview: boolean;
  reviewReason: string | null;
  /** 서버가 AI의 분류를 바꾸거나 보정한 이유. 바꾸지 않았으면 null */
  serverNote: string | null;
};

export type DiffRequest = {
  projectName: string;
  previousText: string;
  latestText: string;
};

export type DiffResponse = {
  projectName: string;
  items: ChangeItem[];
  /** 코드 비교에 그대로 보낼 요구사항. items와 같은 id·같은 순서이다. */
  requirements: ExtractedRequirement[];
  counts: Record<ChangeKind, number>;
  /** ISO 8601 */
  diffedAt: string;
  model: string;
  usage: ExtractUsage;
};

export type DiffOutcome =
  | { ok: true; data: DiffResponse }
  | { ok: false; error: ExtractErrorInfo };

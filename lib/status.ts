export const STATUSES = ["VERIFIED", "PARTIAL", "MISMATCH", "UNKNOWN"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<
  Status,
  { label: string; description: string; tone: string }
> = {
  VERIFIED: {
    label: "구현 확인",
    description: "요구사항과 일치하는 코드를 찾았고 근거 위치를 제시할 수 있음",
    tone: "bg-ok-soft text-ok",
  },
  PARTIAL: {
    label: "부분 구현",
    description: "관련 코드는 있으나 요구사항의 일부만 충족함",
    tone: "bg-warn-soft text-warn",
  },
  MISMATCH: {
    label: "불일치",
    description: "코드가 요구사항과 다르게 동작하거나 반대되는 근거가 있음",
    tone: "bg-bad-soft text-bad",
  },
  UNKNOWN: {
    label: "판단 불가",
    description: "코드에서 근거를 찾지 못했거나 정보가 부족해 판단할 수 없음",
    tone: "bg-unk-soft text-unk",
  },
};

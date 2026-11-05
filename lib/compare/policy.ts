// 판정 정책을 서버에서 한 번 더 적용한다. AI가 정책을 어겨도 결과가 과장되지 않도록 하는 안전장치다.
import type { ExtractedRequirement } from "../extract/types.ts";
import type { Status } from "../status.ts";
import type { CodeEvidence } from "./types.ts";

const DOC_LIKE_LANGUAGES = new Set(["Markdown", "JSON"]);

const isDocLike = (e: CodeEvidence) => DOC_LIKE_LANGUAGES.has(e.language) || /(^|\/)readme(\.|$)/i.test(e.path);

export type PolicyInput = {
  requirement: ExtractedRequirement;
  status: Status;
  evidence: CodeEvidence[];
  /** 모델이 제시했지만 검증에 실패한 근거 수 */
  rejected: number;
  coverageComplete: boolean;
};

export type PolicyResult = { status: Status; note: string | null };

export function applyPolicy(i: PolicyInput): PolicyResult {
  const { requirement: r, evidence, rejected } = i;
  let status = i.status;
  let note: string | null = null;
  const lower = (to: Status, why: string) => {
    status = to;
    note = note ? `${note} ${why}` : why;
  };

  // 근거 없는 구현·충돌 판정은 인정하지 않는다. 근거를 찾지 못한 것만으로 MISMATCH가 되지 않는다.
  if (status !== "UNKNOWN" && evidence.length === 0) {
    lower(
      "UNKNOWN",
      rejected > 0
        ? "AI가 제시한 코드 근거를 서버가 실제 코드와 대조해 확인하지 못해 판정을 UNKNOWN으로 낮췄습니다."
        : "코드 근거가 제시되지 않아 판정을 UNKNOWN으로 낮췄습니다.",
    );
  }

  // README·설정 파일만으로는 구현을 확인할 수 없다.
  if (status === "VERIFIED" && evidence.every(isDocLike)) {
    lower("UNKNOWN", "README나 설정 파일만으로는 실제 구현을 확인할 수 없어 UNKNOWN으로 낮췄습니다.");
  }
  if (status === "PARTIAL" && evidence.every(isDocLike)) {
    lower("UNKNOWN", "README나 설정 파일만으로는 부분 구현도 확인할 수 없어 UNKNOWN으로 낮췄습니다.");
  }

  // 제안은 미준수로 판정하지 않는다.
  if (status === "MISMATCH" && r.decisionType === "suggestion") {
    lower("UNKNOWN", "확정되지 않은 제안은 코드와 다르더라도 미준수로 판정하지 않아 UNKNOWN으로 처리했습니다.");
  }

  // 삭제 요구사항은 "없음"을 확인해야 하므로 전체 코드를 보지 못했다면 VERIFIED로 하지 않는다.
  if (status === "VERIFIED" && r.changeType === "removed" && !i.coverageComplete) {
    lower("UNKNOWN", "삭제된 기능은 전체 코드를 확인해야 하는데 일부 파일을 수집하지 못해 UNKNOWN으로 처리했습니다.");
  }

  return { status, note };
}

export const UNDECIDED_NOTE = "아직 확정되지 않은 요구사항이어서 구현 여부를 판정하지 않았습니다.";

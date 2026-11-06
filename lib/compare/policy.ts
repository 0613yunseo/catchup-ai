// 판정 정책을 서버에서 한 번 더 적용한다. AI가 정책을 어겨도 결과가 과장되지 않도록 하는 안전장치다.
import type { ExtractedRequirement } from "../extract/types.ts";
import type { Status } from "../status.ts";
import type { CodeEvidence } from "./types.ts";

const DOC_LIKE_LANGUAGES = new Set(["Markdown", "JSON"]);

const isDocLike = (e: CodeEvidence) => DOC_LIKE_LANGUAGES.has(e.language) || /(^|\/)readme(\.|$)/i.test(e.path);

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#|<!--|--\s)/;
const IMPORT_LINE = /^\s*(import\b|export\s+(\*|\{[^}]*\})\s+from\b|from\s+\S+\s+import\b|#include\b|using\s+[\w.]+;|package\s+[\w.]+;?)/;
const PUNCT_ONLY = /^[\s{}()[\];,]*$/;

/**
 * 근거 코드에 구현이라고 볼 수 있는 줄이 하나라도 있는지 본다.
 * 빈 줄, 주석, import·export-from, 괄호만 있는 줄은 구현 근거로 세지 않는다.
 * (주석에는 "저장하지 않는다"처럼 요구사항과 같은 문장이 있어도 동작을 보여 주지 못한다.)
 */
export function hasSubstantiveCode(e: Pick<CodeEvidence, "snippet">): boolean {
  let inImport = false;
  for (const line of e.snippet.split("\n")) {
    if (inImport) {
      if (/\bfrom\b|;\s*$/.test(line)) inImport = false;
      continue;
    }
    if (PUNCT_ONLY.test(line) || COMMENT_LINE.test(line)) continue;
    if (IMPORT_LINE.test(line)) {
      // 여러 줄에 걸친 import { ... } from "x"
      inImport = /^\s*import\s*\{[^}]*$/.test(line);
      continue;
    }
    return true;
  }
  return false;
}

export type PolicyInput = {
  requirement: ExtractedRequirement;
  status: Status;
  evidence: CodeEvidence[];
  /** AI가 밝힌, 확인하지 못했거나 빠진 조건 */
  missingConditions?: string[];
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

  // 근거 코드의 성격을 확인한다. 주석·import만 있는 근거는 구현을 보여 주지 못한다.
  // role은 AI가 스스로 밝힌 값이다. 서버는 AI가 "직접 근거가 아니다"라고 한 코드를 구현 확인에 쓰지 않는다.
  // (role이 없으면 직접 근거로 본다. 이전 형식의 응답과의 호환이다.)
  const code = evidence.filter(hasSubstantiveCode);
  const direct = code.filter((e) => (e.role ?? "direct") === "direct");
  const partial = code.filter((e) => e.role === "partial");
  if (status === "VERIFIED") {
    if (code.length === 0) {
      lower("UNKNOWN", "제시된 근거가 주석·import뿐이라 실제 구현을 확인할 수 없어 UNKNOWN으로 낮췄습니다.");
    } else if (direct.length === 0) {
      if (partial.length > 0) lower("PARTIAL", "AI도 핵심 동작을 직접 보여 주는 코드가 아니라고 밝힌 근거뿐이라 PARTIAL로 낮췄습니다.");
      else lower("UNKNOWN", "AI가 배경·참고용이라고 밝힌 코드뿐이라 구현을 확인할 수 없어 UNKNOWN으로 낮췄습니다.");
    } else if ((i.missingConditions ?? []).length > 0) {
      lower("PARTIAL", "AI가 확인하지 못한 조건이 있다고 밝혀 VERIFIED를 인정하지 않고 PARTIAL로 낮췄습니다.");
    }
  }
  if (status === "PARTIAL" && direct.length + partial.length === 0) {
    lower("UNKNOWN", code.length === 0 ? "제시된 근거가 주석·import뿐이라 UNKNOWN으로 낮췄습니다." : "AI가 배경·참고용이라고 밝힌 코드뿐이라 UNKNOWN으로 낮췄습니다.");
  }
  if (status === "MISMATCH" && direct.length === 0) {
    lower("UNKNOWN", "충돌을 직접 보여 주는 코드 근거가 없어 MISMATCH를 인정하지 않고 UNKNOWN으로 낮췄습니다.");
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

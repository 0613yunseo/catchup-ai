// 코드 비교 결과(Report)를 /analyze에서 /report로 넘기기 위한 브라우저 세션 저장소.
// 서버에는 저장하지 않는다. 같은 탭에서만 유지되고(새로고침은 유지), 탭을 닫으면 사라진다.
import { CHANGE_KINDS } from "./diff/types.ts";
import type { Report } from "./report.ts";

export const REPORT_STORAGE_KEY = "catchup:report:v1";

const STATUSES = ["VERIFIED", "PARTIAL", "MISMATCH", "UNKNOWN"];
const SOURCES = ["meeting", "feedback", "requirements"];
const DECISIONS = ["confirmed", "suggestion", "undecided"];
const CHANGES = ["new", "changed", "removed", "unspecified"];

const isStr = (v: unknown): v is string => typeof v === "string";
const isInt = (v: unknown): v is number => Number.isInteger(v);
const optStr = (v: unknown) => v === undefined || isStr(v);
const strArray = (v: unknown) => Array.isArray(v) && v.every(isStr);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSide = (v: unknown) => isObj(v) && isStr(v.text) && isStr(v.quote);

// 변경 정보(change)는 화면이 그대로 렌더링하므로 타입까지 확인한다.
function isChange(c: unknown): boolean {
  if (!isObj(c)) return false;
  if (!CHANGE_KINDS.includes(c.kind as (typeof CHANGE_KINDS)[number]) || !isStr(c.summary) || typeof c.needsReview !== "boolean") return false;
  if (!optStr(c.reviewReason) || !optStr(c.serverNote)) return false;
  return (c.previous === undefined || isSide(c.previous)) && (c.latest === undefined || isSide(c.latest));
}

/**
 * 저장소에서 읽은 값을 그대로 믿지 않고 Report 형태인지 확인한다.
 * 화면이 그대로 렌더링하는 필드는 타입까지 확인해서, 훼손된 값이 화면을 깨뜨리지 못하게 한다.
 */
export function isReport(x: unknown): x is Report {
  if (!isObj(x)) return false;
  if (!isStr(x.projectName) || !isStr(x.repoUrl) || !isStr(x.analyzedAt) || !Array.isArray(x.requirements)) return false;
  if (!optStr(x.commitSha) || !optStr(x.model)) return false;
  if (x.mode !== undefined && x.mode !== "single" && x.mode !== "diff") return false;
  if (x.coverage !== undefined) {
    const c = x.coverage;
    if (
      !isObj(c) ||
      typeof c.complete !== "boolean" ||
      !isInt(c.totalFiles) ||
      !isInt(c.candidates) ||
      !isInt(c.collected) ||
      !isInt(c.limited) ||
      !optStr(c.selection) ||
      !strArray(c.warnings)
    ) {
      return false;
    }
  }
  return x.requirements.every((q) => {
    if (!isObj(q)) return false;
    if (!isStr(q.id) || !isStr(q.text) || !SOURCES.includes(q.source as string) || !STATUSES.includes(q.status as string)) return false;
    if (!isStr(q.reason) || !Array.isArray(q.evidence)) return false;
    if (!optStr(q.recommendation) || !optStr(q.description) || !optStr(q.sourceQuote) || !optStr(q.policyNote)) return false;
    if (q.decisionType !== undefined && !DECISIONS.includes(q.decisionType as string)) return false;
    if (q.changeType !== undefined && !CHANGES.includes(q.changeType as string)) return false;
    if (q.missingConditions !== undefined && !strArray(q.missingConditions)) return false;
    if (q.consideredFiles !== undefined && !strArray(q.consideredFiles)) return false;
    if (q.coverageLimited !== undefined && typeof q.coverageLimited !== "boolean") return false;
    if (q.change !== undefined && !isChange(q.change)) return false;
    return q.evidence.every(
      (e) => isObj(e) && isStr(e.path) && isInt(e.startLine) && isInt(e.endLine) && optStr(e.snippet) && optStr(e.note),
    );
  });
}

export type StoredReport =
  | { status: "empty" }
  /** 저장된 값이 있지만 JSON이 아니거나 Report 형태가 아니다. 화면에는 표시하지 않는다. */
  | { status: "invalid" }
  | { status: "ok"; report: Report };

/** 저장소에서 읽은 문자열을 해석한다. 순수 함수라 테스트할 수 있다. */
export function parseStoredReport(raw: string | null): StoredReport {
  if (raw === null) return { status: "empty" };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isReport(parsed) ? { status: "ok", report: parsed } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

/** 저장된 원본 문자열. 접근이 막혔으면 null(저장된 것이 없는 것으로 본다). */
export function readRawReport(): string | null {
  try {
    return sessionStorage.getItem(REPORT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveReport(report: Report): boolean {
  try {
    sessionStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
    return true;
  } catch {
    return false; // 저장소 접근이 막혔거나 용량을 넘은 경우
  }
}

export function loadReport(): Report | null {
  const r = parseStoredReport(readRawReport());
  return r.status === "ok" ? r.report : null;
}

export function clearReport(): void {
  try {
    sessionStorage.removeItem(REPORT_STORAGE_KEY);
  } catch {
    // 무시
  }
}

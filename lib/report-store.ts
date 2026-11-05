// 코드 비교 결과(Report)를 다음 화면(/report)으로 넘기기 위한 브라우저 세션 저장소.
// 서버에는 저장하지 않는다. 같은 탭에서만 유지되고, 탭을 닫으면 사라진다.
import type { Report } from "./report.ts";

export const REPORT_STORAGE_KEY = "catchup:report:v1";

const STATUSES = ["VERIFIED", "PARTIAL", "MISMATCH", "UNKNOWN"];
const SOURCES = ["meeting", "feedback", "requirements"];

const isStr = (v: unknown): v is string => typeof v === "string";
const isInt = (v: unknown): v is number => Number.isInteger(v);

/** 저장소에서 읽은 값을 그대로 믿지 않고 Report 형태인지 확인한다. */
export function isReport(x: unknown): x is Report {
  const r = x as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return false;
  if (!isStr(r.projectName) || !isStr(r.repoUrl) || !isStr(r.analyzedAt) || !Array.isArray(r.requirements)) return false;
  return r.requirements.every((q) => {
    const o = q as Record<string, unknown> | null;
    return (
      !!o &&
      typeof o === "object" &&
      isStr(o.id) &&
      isStr(o.text) &&
      SOURCES.includes(o.source as string) &&
      STATUSES.includes(o.status as string) &&
      isStr(o.reason) &&
      Array.isArray(o.evidence) &&
      o.evidence.every((e) => {
        const ev = e as Record<string, unknown> | null;
        return !!ev && isStr(ev.path) && isInt(ev.startLine) && isInt(ev.endLine);
      })
    );
  });
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
  try {
    const raw = sessionStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearReport(): void {
  try {
    sessionStorage.removeItem(REPORT_STORAGE_KEY);
  } catch {
    // 무시
  }
}

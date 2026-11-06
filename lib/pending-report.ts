// 로그인 전에 저장하려던 리포트를 잠시 보관한다.
// 이메일 링크는 보통 새 탭에서 열리고 sessionStorage는 탭마다 따로라서, 인증 후 리포트를 복구하려면 탭을 넘는 저장소가 필요하다.
// 보관 시간은 짧게(30분) 두고, 복구하거나 저장하거나 로그아웃하면 바로 지운다.
import type { Report } from "./report.ts";
import { isReport } from "./report-store.ts";

export const PENDING_KEY = "catchup:pending-save:v1";
export const PENDING_TTL_MS = 30 * 60 * 1000;

export function savePending(report: Report, now = Date.now()): boolean {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ savedAt: now, report }));
    return true;
  } catch {
    return false;
  }
}

/** 보관 중인 리포트를 돌려준다. 없거나 만료되었거나 형식이 올바르지 않으면 null이며, 그런 값은 지운다. */
export function loadPending(now = Date.now()): Report | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw === null) return null;
    const v = JSON.parse(raw) as { savedAt?: unknown; report?: unknown };
    if (typeof v.savedAt !== "number" || now - v.savedAt > PENDING_TTL_MS || !isReport(v.report)) {
      clearPending();
      return null;
    }
    return v.report;
  } catch {
    clearPending();
    return null;
  }
}

export function clearPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // 무시
  }
}

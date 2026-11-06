// 클라우드 저장 전 서버 검증. 클라이언트가 보낸 값은 믿지 않고 리포트 구조를 다시 확인하며, 저장할 행은 검증된 리포트에서 서버가 직접 만든다.
import { createHash } from "node:crypto";
import type { Report } from "../report.ts";
import { isReport } from "../report-store.ts";
import { parseGithubRepo } from "../validate.ts";
import { REPORT_LIMITS } from "./limits.ts";

export { REPORT_LIMITS };

export type SaveRow = {
  project_name: string;
  mode: "single" | "diff";
  repo_url: string;
  requirement_count: number;
  status_counts: Record<string, number>;
  content_hash: string;
  report_data: Report;
};

export type PrepareResult =
  | { ok: true; row: SaveRow }
  | { ok: false; status: number; code: "INVALID_REQUEST" | "TOO_LARGE" | "INVALID_REPORT"; message: string };

const fail = (status: number, code: "INVALID_REQUEST" | "TOO_LARGE" | "INVALID_REPORT", message: string): PrepareResult => ({ ok: false, status, code, message });

/** 요청 본문({ report })을 검증하고 저장할 행을 만든다. user_id는 넣지 않는다(DB가 auth.uid()로 채우고 RLS가 확인한다). */
export function prepareSave(body: unknown): PrepareResult {
  const report = (body as { report?: unknown } | null)?.report;
  if (report === undefined || report === null || typeof report !== "object") return fail(400, "INVALID_REQUEST", "저장할 리포트가 없습니다.");

  let json: string;
  try {
    json = JSON.stringify(report);
  } catch {
    return fail(400, "INVALID_REQUEST", "리포트를 읽을 수 없습니다.");
  }
  if (Buffer.byteLength(json) > REPORT_LIMITS.maxBytes) return fail(413, "TOO_LARGE", "리포트가 너무 커서 저장할 수 없습니다.");
  if (!isReport(report)) return fail(422, "INVALID_REPORT", "리포트 형식이 올바르지 않아 저장할 수 없습니다.");
  if (report.requirements.length > REPORT_LIMITS.maxRequirements) return fail(422, "INVALID_REPORT", "요구사항이 너무 많아 저장할 수 없습니다.");

  const projectName = report.projectName.trim();
  if (!projectName || projectName.length > REPORT_LIMITS.projectNameMax) return fail(422, "INVALID_REPORT", "프로젝트 이름이 올바르지 않습니다.");
  if (!parseGithubRepo(report.repoUrl)) return fail(422, "INVALID_REPORT", "저장소 주소가 올바르지 않습니다.");

  const counts: Record<string, number> = {};
  for (const q of report.requirements) counts[q.status] = (counts[q.status] ?? 0) + 1;

  return {
    ok: true,
    row: {
      project_name: projectName,
      mode: report.mode === "diff" ? "diff" : "single",
      repo_url: report.repoUrl.trim(),
      requirement_count: report.requirements.length,
      status_counts: counts,
      content_hash: createHash("sha256").update(json).digest("hex"),
      report_data: report,
    },
  };
}

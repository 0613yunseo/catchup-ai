// analysis_reports 테이블 접근. 항상 로그인한 사용자의 세션으로 호출하며, 사용자별 분리는 DB의 RLS가 강제한다.
// (service_role / secret 키는 쓰지 않는다. 아래 코드는 user_id를 직접 지정하거나 필터링하지 않는다.)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "../report.ts";
import { isReport } from "../report-store.ts";
import { REPORT_LIMITS } from "./limits.ts";
import type { SaveRow } from "./save.ts";

export const TABLE = "analysis_reports";
export const PAGE_SIZE = 10;
const LIST_COLUMNS = "id,project_name,mode,repo_url,requirement_count,status_counts,created_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DbErrorCode = "UNAUTHENTICATED" | "TABLE_MISSING" | "QUOTA_REACHED" | "NOT_FOUND" | "DB_ERROR";

type PgError = { code?: string; message?: string; status?: number } | null | undefined;

/** Supabase/PostgREST 오류를 화면에서 구분할 수 있는 코드로 바꾼다. 원본 메시지는 사용자에게 보이지 않는다. */
export function classifyDbError(e: PgError): DbErrorCode {
  if (!e) return "DB_ERROR";
  const msg = (e.message ?? "").toLowerCase();
  if (e.status === 401 || e.code === "PGRST301" || e.code === "PGRST303" || msg.includes("jwt")) return "UNAUTHENTICATED";
  if (e.code === "42P01" || e.code === "PGRST205" || msg.includes("schema cache") || msg.includes("does not exist")) return "TABLE_MISSING";
  return "DB_ERROR";
}

export type InsertResult = { ok: true; id: string; alreadySaved: boolean } | { ok: false; code: DbErrorCode };

/**
 * 리포트를 저장한다. 같은 내용(content_hash)이 이미 있으면 새로 만들지 않고 기존 기록을 돌려준다.
 * 사용자당 저장 한도를 넘으면 저장하지 않는다.
 */
export async function insertReport(db: SupabaseClient, row: SaveRow): Promise<InsertResult> {
  const existing = async (): Promise<{ id?: string; error?: DbErrorCode }> => {
    const r = await db.from(TABLE).select("id").eq("content_hash", row.content_hash).maybeSingle();
    if (r.error) return { error: classifyDbError(r.error) };
    return { id: (r.data as { id: string } | null)?.id };
  };

  const dup = await existing();
  if (dup.error) return { ok: false, code: dup.error };
  if (dup.id) return { ok: true, id: dup.id, alreadySaved: true };

  const counted = await db.from(TABLE).select("id", { count: "exact", head: true });
  if (counted.error) return { ok: false, code: classifyDbError(counted.error) };
  if ((counted.count ?? 0) >= REPORT_LIMITS.maxPerUser) return { ok: false, code: "QUOTA_REACHED" };

  const ins = await db.from(TABLE).insert(row).select("id").single();
  if (ins.error) {
    // 거의 동시에 같은 리포트가 저장된 경우(유일 제약 위반): 이미 저장된 것으로 처리한다.
    if (ins.error.code === "23505") {
      const again = await existing();
      if (again.id) return { ok: true, id: again.id, alreadySaved: true };
    }
    return { ok: false, code: classifyDbError(ins.error) };
  }
  return { ok: true, id: (ins.data as { id: string }).id, alreadySaved: false };
}

export type HistoryRow = {
  id: string;
  project_name: string;
  mode: "single" | "diff";
  repo_url: string;
  requirement_count: number;
  status_counts: Record<string, number>;
  created_at: string;
};

export type ListQuery = { q: string; mode: "all" | "single" | "diff"; page: number };
export type ListResult = { ok: true; rows: HistoryRow[]; total: number } | { ok: false; code: DbErrorCode };

/** LIKE 패턴의 와일드카드를 글자 그대로 검색하도록 이스케이프한다. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function listReports(db: SupabaseClient, { q, mode, page }: ListQuery): Promise<ListResult> {
  const p = Math.max(0, Math.floor(page));
  let query = db
    .from(TABLE)
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);
  if (mode !== "all") query = query.eq("mode", mode);
  const term = q.trim().slice(0, 100);
  if (term) query = query.ilike("project_name", `%${escapeLike(term)}%`);
  const r = await query;
  if (r.error) return { ok: false, code: classifyDbError(r.error) };
  return { ok: true, rows: (r.data ?? []) as HistoryRow[], total: r.count ?? 0 };
}

export type FetchResult = { ok: true; report: Report; createdAt: string } | { ok: false; code: DbErrorCode };

/** 기록 한 건의 리포트 JSON을 가져온다. 다른 사용자의 기록은 RLS 때문에 보이지 않으므로 NOT_FOUND가 된다. */
export async function fetchReport(db: SupabaseClient, id: string): Promise<FetchResult> {
  if (!UUID_RE.test(id)) return { ok: false, code: "NOT_FOUND" };
  const r = await db.from(TABLE).select("report_data,created_at").eq("id", id).maybeSingle();
  if (r.error) return { ok: false, code: classifyDbError(r.error) };
  const row = r.data as { report_data: unknown; created_at: string } | null;
  if (!row) return { ok: false, code: "NOT_FOUND" };
  // 저장된 JSON도 그대로 믿지 않고 화면이 쓰는 형태인지 다시 확인한다.
  if (!isReport(row.report_data)) return { ok: false, code: "DB_ERROR" };
  return { ok: true, report: row.report_data, createdAt: row.created_at };
}

export type DeleteResult = { ok: true } | { ok: false; code: DbErrorCode };

/** 기록을 삭제한다. 남의 기록이거나 이미 없으면 삭제된 행이 없으므로 NOT_FOUND이다. */
export async function deleteReport(db: SupabaseClient, id: string): Promise<DeleteResult> {
  if (!UUID_RE.test(id)) return { ok: false, code: "NOT_FOUND" };
  const r = await db.from(TABLE).delete().eq("id", id).select("id");
  if (r.error) return { ok: false, code: classifyDbError(r.error) };
  return (r.data ?? []).length === 1 ? { ok: true } : { ok: false, code: "NOT_FOUND" };
}

export const DB_MESSAGES: Record<DbErrorCode, string> = {
  UNAUTHENTICATED: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  TABLE_MISSING: "기록 저장소가 아직 준비되지 않았습니다. 관리자에게 문의해 주세요.",
  QUOTA_REACHED: `저장할 수 있는 기록은 최대 ${REPORT_LIMITS.maxPerUser}개입니다. 기록을 삭제한 뒤 다시 저장해 주세요.`,
  NOT_FOUND: "기록을 찾을 수 없습니다. 이미 삭제되었거나 접근할 수 없는 기록입니다.",
  DB_ERROR: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

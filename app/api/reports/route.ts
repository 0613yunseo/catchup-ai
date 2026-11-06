import { DB_MESSAGES, insertReport } from "@/lib/reports/cloud";
import { REPORT_LIMITS } from "@/lib/reports/limits";
import { prepareSave } from "@/lib/reports/save";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function respond(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE });
}

// POST /api/reports  { report }  — 로그인한 사용자의 분석 리포트를 저장한다.
// - 사용자는 쿠키의 세션에서 getUser()로 검증한다. (getSession()의 값은 서버 판단에 쓰지 않는다)
// - 저장은 그 사용자의 세션으로 수행하므로 RLS가 적용된다. user_id는 DB가 auth.uid()로 채우며, 요청에서 받지 않는다.
// - 리포트 구조와 크기는 서버가 다시 검증한다. 원본 문서 파일은 받지도 저장하지도 않는다.
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return respond(400, { ok: false, code: "INVALID_REQUEST", message: "요청 형식이 올바르지 않습니다." });
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > REPORT_LIMITS.maxBytes * 2) return respond(413, { ok: false, code: "TOO_LARGE", message: "리포트가 너무 커서 저장할 수 없습니다." });
    body = JSON.parse(text);
  } catch {
    return respond(400, { ok: false, code: "INVALID_REQUEST", message: "요청 형식이 올바르지 않습니다." });
  }

  const db = await createClient();
  if (!db) return respond(503, { ok: false, code: "NOT_CONFIGURED", message: "클라우드 저장 기능이 설정되지 않았습니다." });

  // 인증이 먼저다. 로그인하지 않은 요청은 리포트 내용을 검사하기 전에 거부한다.
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return respond(401, { ok: false, code: "UNAUTHENTICATED", message: DB_MESSAGES.UNAUTHENTICATED });

  const prepared = prepareSave(body);
  if (!prepared.ok) return respond(prepared.status, { ok: false, code: prepared.code, message: prepared.message });

  const result = await insertReport(db, prepared.row);
  if (!result.ok) {
    // 내용은 기록하지 않는다. 오류 종류만 남긴다.
    console.warn("reports.save.fail", JSON.stringify({ code: result.code }));
    const status = result.code === "UNAUTHENTICATED" ? 401 : result.code === "TABLE_MISSING" ? 503 : result.code === "QUOTA_REACHED" ? 409 : 500;
    return respond(status, { ok: false, code: result.code, message: DB_MESSAGES[result.code] });
  }
  console.info("reports.save.ok", JSON.stringify({ requirements: prepared.row.requirement_count, mode: prepared.row.mode, already: result.alreadySaved }));
  return respond(200, { ok: true, id: result.id, alreadySaved: result.alreadySaved });
}

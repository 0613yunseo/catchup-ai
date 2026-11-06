import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareSave } from "./save.ts";
import { REPORT_LIMITS } from "./limits.ts";
import { classifyDbError, deleteReport, escapeLike, fetchReport, insertReport, listReports } from "./cloud.ts";
import { PENDING_KEY, PENDING_TTL_MS, clearPending, loadPending, savePending } from "../pending-report.ts";

const req = (status, id = "R-1") => ({ id, text: "t", source: "meeting", status, reason: "r", evidence: [{ path: "a.ts", startLine: 1, endLine: 2, snippet: "x" }] });
const good = {
  projectName: "내 프로젝트",
  repoUrl: "https://github.com/o/r",
  analyzedAt: "2026-11-06T00:00:00.000Z",
  requirements: [req("VERIFIED"), req("UNKNOWN", "R-2"), req("UNKNOWN", "R-3")],
};

// ---- prepareSave ----
test("prepareSave: 정상 리포트는 서버가 행을 만든다(user_id 없음)", () => {
  const r = prepareSave({ report: good });
  assert.equal(r.ok, true);
  assert.equal(r.row.project_name, "내 프로젝트");
  assert.equal(r.row.mode, "single");
  assert.equal(r.row.requirement_count, 3);
  assert.deepEqual(r.row.status_counts, { VERIFIED: 1, UNKNOWN: 2 });
  assert.match(r.row.content_hash, /^[0-9a-f]{64}$/);
  assert.equal("user_id" in r.row, false);
});

test("prepareSave: 같은 내용은 같은 해시, 다른 내용은 다른 해시", () => {
  const a = prepareSave({ report: good }).row.content_hash;
  assert.equal(prepareSave({ report: structuredClone(good) }).row.content_hash, a);
  assert.notEqual(prepareSave({ report: { ...good, projectName: "다름" } }).row.content_hash, a);
});

test("prepareSave: diff 모드 유지, 잘못된 mode는 single", () => {
  assert.equal(prepareSave({ report: { ...good, mode: "diff" } }).row.mode, "diff");
  assert.equal(prepareSave({ report: { ...good, mode: "x" } }).ok, false); // isReport가 거부
});

test("prepareSave: 잘못된 입력 거부", () => {
  for (const body of [null, {}, { report: null }, { report: "x" }, { report: 1 }]) assert.equal(prepareSave(body).ok, false);
  const bad = prepareSave({ report: { ...good, requirements: [{ ...req("VERIFIED"), status: "DONE" }] } });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 422);
});

test("prepareSave: 크기·개수·이름·저장소 한도", () => {
  const big = { ...good, requirements: [{ ...req("VERIFIED"), reason: "가".repeat(REPORT_LIMITS.maxBytes) }] };
  const r = prepareSave({ report: big });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  const many = { ...good, requirements: Array.from({ length: REPORT_LIMITS.maxRequirements + 1 }, (_, i) => req("VERIFIED", `R-${i}`)) };
  assert.equal(prepareSave({ report: many }).ok, false);
  assert.equal(prepareSave({ report: { ...good, projectName: "  " } }).ok, false);
  assert.equal(prepareSave({ report: { ...good, projectName: "a".repeat(201) } }).ok, false);
  assert.equal(prepareSave({ report: { ...good, repoUrl: "https://evil.com/o/r" } }).ok, false);
});

test("prepareSave: 클라이언트가 보낸 user_id 등 추가 필드는 행에 들어가지 않는다", () => {
  const r = prepareSave({ report: good, user_id: "11111111-1111-1111-1111-111111111111", content_hash: "x" });
  assert.equal("user_id" in r.row, false);
  assert.notEqual(r.row.content_hash, "x");
});

// ---- classifyDbError / escapeLike ----
test("classifyDbError", () => {
  assert.equal(classifyDbError({ code: "42P01", message: 'relation "x" does not exist' }), "TABLE_MISSING");
  assert.equal(classifyDbError({ code: "PGRST205", message: "Could not find the table in the schema cache" }), "TABLE_MISSING");
  assert.equal(classifyDbError({ code: "PGRST301", message: "JWT expired" }), "UNAUTHENTICATED");
  assert.equal(classifyDbError({ status: 401, message: "x" }), "UNAUTHENTICATED");
  assert.equal(classifyDbError({ code: "XX000", message: "boom" }), "DB_ERROR");
  assert.equal(classifyDbError(null), "DB_ERROR");
});

test("escapeLike: 와일드카드를 글자로 취급", () => {
  assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b");
});

// ---- fake supabase client ----
function chain(result, log) {
  const q = {
    _ops: [],
    select(...a) { this._ops.push(["select", ...a]); return this; },
    insert(v) { this._ops.push(["insert", v]); return this; },
    delete() { this._ops.push(["delete"]); return this; },
    eq(c, v) { this._ops.push(["eq", c, v]); return this; },
    ilike(c, v) { this._ops.push(["ilike", c, v]); return this; },
    order(...a) { this._ops.push(["order", ...a]); return this; },
    range(...a) { this._ops.push(["range", ...a]); return this; },
    maybeSingle() { return Promise.resolve(result(this._ops)); },
    single() { return Promise.resolve(result(this._ops)); },
    then(res, rej) { return Promise.resolve(result(this._ops)).then(res, rej); },
  };
  log.push(q);
  return q;
}
const fakeDb = (result, log = []) => ({ from: (t) => { assert.equal(t, "analysis_reports"); return chain(result, log); }, log });
const hasOp = (ops, name) => ops.some((o) => o[0] === name);
const row = prepareSave({ report: good }).row;
const ID = "11111111-1111-4111-8111-111111111111";

test("insertReport: 새 리포트는 저장하고 user_id를 보내지 않는다", async () => {
  let inserted;
  const db = fakeDb((ops) => {
    if (hasOp(ops, "insert")) { inserted = ops.find((o) => o[0] === "insert")[1]; return { data: { id: ID }, error: null }; }
    if (ops.some((o) => o[0] === "select" && o[2]?.head)) return { count: 0, error: null };
    return { data: null, error: null }; // 중복 없음
  });
  const r = await insertReport(db, row);
  assert.deepEqual(r, { ok: true, id: ID, alreadySaved: false });
  assert.equal("user_id" in inserted, false);
});

test("insertReport: 중복이면 insert하지 않고 기존 id 반환", async () => {
  let inserts = 0;
  const db = fakeDb((ops) => {
    if (hasOp(ops, "insert")) inserts++;
    return { data: { id: ID }, error: null };
  });
  assert.deepEqual(await insertReport(db, row), { ok: true, id: ID, alreadySaved: true });
  assert.equal(inserts, 0);
});

test("insertReport: 동시 저장으로 23505면 이미 저장됨 처리", async () => {
  let dupChecks = 0;
  const db = fakeDb((ops) => {
    if (hasOp(ops, "insert")) return { data: null, error: { code: "23505", message: "dup" } };
    if (ops.some((o) => o[0] === "select" && o[2]?.head)) return { count: 0, error: null };
    dupChecks++;
    return { data: dupChecks === 1 ? null : { id: ID }, error: null };
  });
  assert.deepEqual(await insertReport(db, row), { ok: true, id: ID, alreadySaved: true });
});

test("insertReport: 한도 도달·테이블 없음·만료", async () => {
  const quota = fakeDb((ops) => (ops.some((o) => o[0] === "select" && o[2]?.head) ? { count: REPORT_LIMITS.maxPerUser, error: null } : { data: null, error: null }));
  assert.deepEqual(await insertReport(quota, row), { ok: false, code: "QUOTA_REACHED" });
  const missing = fakeDb(() => ({ data: null, error: { code: "42P01", message: "does not exist" } }));
  assert.deepEqual(await insertReport(missing, row), { ok: false, code: "TABLE_MISSING" });
  const expired = fakeDb(() => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } }));
  assert.deepEqual(await insertReport(expired, row), { ok: false, code: "UNAUTHENTICATED" });
});

test("listReports: 최신순·페이지·필터·검색 이스케이프", async () => {
  const log = [];
  const db = fakeDb(() => ({ data: [], count: 0, error: null }), log);
  await listReports(db, { q: "50%_", mode: "diff", page: 2 });
  const ops = log[0]._ops;
  assert.deepEqual(ops.find((o) => o[0] === "order"), ["order", "created_at", { ascending: false }]);
  assert.deepEqual(ops.find((o) => o[0] === "range"), ["range", 20, 29]);
  assert.deepEqual(ops.find((o) => o[0] === "eq"), ["eq", "mode", "diff"]);
  assert.deepEqual(ops.find((o) => o[0] === "ilike"), ["ilike", "project_name", "%50\\%\\_%"]);
  assert.equal(ops.some((o) => o[0] === "eq" && o[1] === "user_id"), false); // 분리는 RLS가 담당
  const log2 = [];
  await listReports(fakeDb(() => ({ data: [], count: 0, error: null }), log2), { q: "", mode: "all", page: -5 });
  assert.equal(log2[0]._ops.some((o) => o[0] === "eq" || o[0] === "ilike"), false);
  assert.deepEqual(log2[0]._ops.find((o) => o[0] === "range"), ["range", 0, 9]);
});

test("fetchReport: UUID가 아니면 DB를 부르지 않고 NOT_FOUND", async () => {
  const log = [];
  const db = fakeDb(() => ({ data: null, error: null }), log);
  assert.deepEqual(await fetchReport(db, "1 or 1=1"), { ok: false, code: "NOT_FOUND" });
  assert.equal(log.length, 0);
});

test("fetchReport: 남의 기록(RLS로 안 보임)=NOT_FOUND, 깨진 JSON=DB_ERROR, 정상=리포트", async () => {
  assert.deepEqual(await fetchReport(fakeDb(() => ({ data: null, error: null })), ID), { ok: false, code: "NOT_FOUND" });
  assert.deepEqual(await fetchReport(fakeDb(() => ({ data: { report_data: { x: 1 }, created_at: "t" }, error: null })), ID), { ok: false, code: "DB_ERROR" });
  const ok = await fetchReport(fakeDb(() => ({ data: { report_data: good, created_at: "2026-11-06T00:00:00Z" }, error: null })), ID);
  assert.equal(ok.ok, true);
  assert.equal(ok.report.projectName, "내 프로젝트");
});

test("deleteReport: 지워진 행이 1개일 때만 성공(남의 기록·없는 기록은 NOT_FOUND)", async () => {
  assert.deepEqual(await deleteReport(fakeDb(() => ({ data: [{ id: ID }], error: null })), ID), { ok: true });
  assert.deepEqual(await deleteReport(fakeDb(() => ({ data: [], error: null })), ID), { ok: false, code: "NOT_FOUND" });
  assert.deepEqual(await deleteReport(fakeDb(() => ({ data: [], error: null })), "../x"), { ok: false, code: "NOT_FOUND" });
});

// ---- pending report ----
function installStorage() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  return m;
}

test("pending: 저장·복구·삭제", () => {
  const m = installStorage();
  assert.equal(savePending(good, 1000), true);
  assert.equal(loadPending(1000 + 5).projectName, "내 프로젝트");
  clearPending();
  assert.equal(m.has(PENDING_KEY), false);
  assert.equal(loadPending(), null);
});

test("pending: 30분이 지나면 폐기하고 지운다", () => {
  const m = installStorage();
  savePending(good, 0);
  assert.equal(loadPending(PENDING_TTL_MS + 1), null);
  assert.equal(m.has(PENDING_KEY), false);
});

test("pending: 깨진 값·형식 위반은 null이며 지운다", () => {
  const m = installStorage();
  m.set(PENDING_KEY, "{not json");
  assert.equal(loadPending(), null);
  assert.equal(m.has(PENDING_KEY), false);
  m.set(PENDING_KEY, JSON.stringify({ savedAt: Date.now(), report: { x: 1 } }));
  assert.equal(loadPending(), null);
  assert.equal(m.has(PENDING_KEY), false);
});

// ---- migration SQL(정적 점검: 실제 DB에서 실행한 결과가 아니다) ----
const sql = readFileSync(new URL("../../supabase/migrations/20261106000000_create_analysis_reports.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");

test("SQL(정적): RLS 활성화 + select/insert/delete 정책만, authenticated 한정", () => {
  assert.match(sql, /alter table public\.analysis_reports enable row level security/i);
  const policies = [...sql.matchAll(/create policy "([^"]+)"\s+on public\.analysis_reports\s+for (\w+)\s+to (\w+)/gi)];
  assert.deepEqual(policies.map((p) => p[2].toLowerCase()).sort(), ["delete", "insert", "select"]);
  assert.ok(policies.every((p) => p[3].toLowerCase() === "authenticated"));
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/i);
});

test("SQL(정적): anon 권한 회수, authenticated에는 select/insert/delete만 부여", () => {
  assert.match(sql, /revoke all on table public\.analysis_reports from anon/i);
  const grants = [...sql.matchAll(/grant ([^;]+?) on table public\.analysis_reports to (\w+)/gi)];
  assert.equal(grants.length, 1);
  assert.equal(grants[0][2], "authenticated");
  assert.deepEqual(grants[0][1].split(",").map((s) => s.trim().toLowerCase()).sort(), ["delete", "insert", "select"]);
  assert.doesNotMatch(sql, /to anon|to public|service_role/i);
});

test("SQL(정적): user_id→auth.users 연결, 필수 컬럼, 인덱스, 중복 방지", () => {
  assert.match(sql, /user_id\s+uuid not null default auth\.uid\(\) references auth\.users \(id\) on delete cascade/i);
  for (const c of ["id", "user_id", "project_name", "mode", "repo_url", "report_data", "created_at"]) assert.match(sql, new RegExp(`\\b${c}\\b`));
  assert.match(sql, /report_data\s+jsonb not null/i);
  assert.match(sql, /create index [\w]+\s+on public\.analysis_reports \(user_id, created_at desc\)/i);
  assert.match(sql, /unique \(user_id, content_hash\)/i);
});

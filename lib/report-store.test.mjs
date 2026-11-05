import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_STORAGE_KEY, clearReport, isReport, loadReport, parseStoredReport, readRawReport, saveReport } from "./report-store.ts";
import { toReport } from "./compare/to-report.ts";

const good = {
  projectName: "p",
  repoUrl: "https://github.com/o/r",
  analyzedAt: "2026-11-06T00:00:00.000Z",
  commitSha: "a".repeat(40),
  requirements: [
    {
      id: "R-1",
      text: "t",
      source: "meeting",
      status: "VERIFIED",
      reason: "r",
      evidence: [{ path: "a.ts", startLine: 1, endLine: 2, snippet: "x" }],
    },
  ],
};

function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), m };
}

test("isReport: 올바른 Report만 통과", () => {
  assert.equal(isReport(good), true);
  assert.equal(isReport({ ...good, requirements: [] }), true);
  for (const bad of [
    null,
    "x",
    {},
    { ...good, projectName: 1 },
    { ...good, requirements: "no" },
    { ...good, requirements: [{ ...good.requirements[0], status: "DONE" }] },
    { ...good, requirements: [{ ...good.requirements[0], source: "memo" }] },
    { ...good, requirements: [{ ...good.requirements[0], evidence: [{ path: "a.ts", startLine: "1", endLine: 2 }] }] },
    { ...good, requirements: [{ ...good.requirements[0], evidence: [{ path: 5, startLine: 1, endLine: 2 }] }] },
    { ...good, requirements: [null] },
  ]) {
    assert.equal(isReport(bad), false, JSON.stringify(bad)?.slice(0, 60));
  }
});

test("저장 → 불러오기 → 삭제, 깨진 값과 저장소 오류에도 안전", () => {
  globalThis.sessionStorage = fakeStorage();
  assert.equal(loadReport(), null);
  assert.equal(saveReport(good), true);
  assert.deepEqual(loadReport(), good);
  clearReport();
  assert.equal(loadReport(), null);

  globalThis.sessionStorage = fakeStorage({ [REPORT_STORAGE_KEY]: "{not json" });
  assert.equal(loadReport(), null);
  globalThis.sessionStorage = fakeStorage({ [REPORT_STORAGE_KEY]: JSON.stringify({ projectName: "x" }) });
  assert.equal(loadReport(), null);

  globalThis.sessionStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(saveReport(good), false);
  assert.equal(loadReport(), null);
  clearReport();
  delete globalThis.sessionStorage;
});

test("parseStoredReport: 없음 / 손상 / 정상을 구분하고, 손상된 값은 일부도 표시하지 않는다", () => {
  assert.deepEqual(parseStoredReport(null), { status: "empty" });
  assert.deepEqual(parseStoredReport("{not json"), { status: "invalid" });
  assert.deepEqual(parseStoredReport("[]"), { status: "invalid" });
  assert.deepEqual(parseStoredReport("null"), { status: "invalid" });
  assert.deepEqual(parseStoredReport('"text"'), { status: "invalid" });
  assert.deepEqual(parseStoredReport(JSON.stringify({ projectName: "x" })), { status: "invalid" });
  const ok = parseStoredReport(JSON.stringify(good));
  assert.equal(ok.status, "ok");
  assert.deepEqual(ok.report, good);
  // 요구사항 하나만 깨져도 전체를 쓰지 않는다 (일부만 보여 주지 않음)
  const mixed = { ...good, requirements: [good.requirements[0], { ...good.requirements[0], id: "R-2", status: "DONE" }] };
  assert.deepEqual(parseStoredReport(JSON.stringify(mixed)), { status: "invalid" });
});

test("isReport: 화면이 그대로 렌더링하는 선택 필드의 타입까지 확인", () => {
  const q = good.requirements[0];
  const withQ = (o) => ({ ...good, requirements: [{ ...q, ...o }] });
  assert.equal(isReport(withQ({ decisionType: "suggestion", changeType: "removed", missingConditions: ["a"], consideredFiles: ["a.ts"], coverageLimited: true, policyNote: "n", sourceQuote: "q", description: "d", recommendation: "r", decidedBy: "model" })), true);
  for (const bad of [
    { decisionType: "maybe" },
    { changeType: "gone" },
    { missingConditions: "x" },
    { missingConditions: [1] },
    { consideredFiles: [{}] },
    { coverageLimited: "yes" },
    { policyNote: 5 },
    { sourceQuote: {} },
    { recommendation: 1 },
    { evidence: [{ path: "a", startLine: 1, endLine: 2, snippet: 9 }] },
    { evidence: [{ path: "a", startLine: 1, endLine: 2, note: [] }] },
  ]) {
    assert.equal(isReport(withQ(bad)), false, JSON.stringify(bad));
  }
  const cov = { complete: false, totalFiles: 10, candidates: 8, collected: 6, limited: 2, selection: "s", warnings: ["w"] };
  assert.equal(isReport({ ...good, coverage: cov }), true);
  for (const bad of [{ ...cov, complete: "no" }, { ...cov, warnings: "w" }, { ...cov, warnings: [1] }, { ...cov, limited: 1.5 }, "x"]) {
    assert.equal(isReport({ ...good, coverage: bad }), false);
  }
  assert.equal(isReport({ ...good, model: 5 }), false);
  assert.equal(isReport({ ...good, commitSha: 5 }), false);
});

test("비교 엔진이 만든 Report(toReport)는 저장소 검증을 통과하고 왕복해도 같다", () => {
  const reqs = [
    { id: "R-1", title: "t1", description: "d1", sourceType: "meeting", sourceQuote: "q1 원문 문장", decisionType: "confirmed", changeType: "changed", ambiguity: null },
    { id: "R-2", title: "t2", description: "d2", sourceType: "meeting", sourceQuote: "q2 원문 문장", decisionType: "undecided", changeType: "new", ambiguity: "미정" },
  ];
  const verdict = (id, status, extra = {}) => ({ requirementId: id, status, reason: "r", evidence: [], missingConditions: [], recommendation: null, decisionType: "confirmed", changeType: "new", decidedBy: "model", policyNote: null, evidenceRejected: 0, evidenceRejections: [], consideredFiles: [], selectionNotes: [], coverageLimited: false, ...extra });
  const report = toReport({
    projectName: "p",
    repoUrl: "https://github.com/o/r",
    commitSha: "a".repeat(40),
    comparedAt: "2026-11-06T00:00:00.000Z",
    model: "gpt-5.4-mini",
    requirements: reqs,
    verdicts: [
      verdict("R-1", "VERIFIED", { evidence: [{ path: "a.ts", startLine: 1, endLine: 2, snippet: "x\ny", language: "TypeScript", adjusted: true }], consideredFiles: ["a.ts"], recommendation: "권고" }),
      verdict("R-2", "UNKNOWN", { decidedBy: "policy", policyNote: "미확정", coverageLimited: true, missingConditions: ["m"] }),
    ],
    coverage: { complete: false, totalFiles: 10, candidates: 8, collected: 6, limited: 2, warnings: [{ code: "FILE_LIMIT", message: "제한" }] },
    selection: { method: "ranked", explanation: "설명" },
  });
  assert.equal(isReport(report), true);
  const round = parseStoredReport(JSON.stringify(report));
  assert.equal(round.status, "ok");
  assert.deepEqual(round.report, JSON.parse(JSON.stringify(report)));
  assert.equal(report.requirements[0].evidence[0].note.includes("보정"), true);
  assert.equal(report.coverage.limited, 2);

  globalThis.sessionStorage = fakeStorage();
  assert.equal(saveReport(report), true);
  assert.equal(typeof readRawReport(), "string");
  assert.deepEqual(loadReport(), JSON.parse(JSON.stringify(report)));
  delete globalThis.sessionStorage;
  assert.equal(readRawReport(), null); // 저장소를 쓸 수 없으면 없는 것으로 본다
});

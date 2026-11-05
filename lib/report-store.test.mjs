import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_STORAGE_KEY, clearReport, isReport, loadReport, saveReport } from "./report-store.ts";

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

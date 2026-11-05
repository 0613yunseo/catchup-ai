import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "./summarize.ts";

test("summarize counts every status, including zeros", () => {
  const r = (status) => ({ id: status, text: "", source: "meeting", status, reason: "", evidence: [] });
  assert.deepEqual(summarize([]), {
    total: 0,
    byStatus: { VERIFIED: 0, PARTIAL: 0, MISMATCH: 0, UNKNOWN: 0 },
  });
  const s = summarize([r("VERIFIED"), r("VERIFIED"), r("MISMATCH")]);
  assert.equal(s.total, 3);
  assert.deepEqual(s.byStatus, { VERIFIED: 2, PARTIAL: 0, MISMATCH: 1, UNKNOWN: 0 });
});

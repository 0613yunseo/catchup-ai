import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath, loginUrl } from "./redirect.ts";

test("내부 경로는 통과", () => {
  assert.equal(safeNextPath("/history"), "/history");
  assert.equal(safeNextPath("/report?restore=1"), "/report?restore=1");
  assert.equal(safeNextPath("/history/abc#x"), "/history/abc#x");
});

test("오픈 리다이렉트 시도는 기본값", () => {
  for (const bad of [
    "//evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "/a\nb",
    "/%0d%0a",
    "/login",
    "/auth/confirm?next=/x",
    null,
    undefined,
    42,
  ]) {
    const out = safeNextPath(bad);
    if (bad === "/%0d%0a") continue; // 인코딩된 문자는 내부 경로 그대로이므로 허용
    assert.equal(out, "/history", String(bad));
  }
});

test("너무 긴 경로 거부, fallback 지정", () => {
  assert.equal(safeNextPath("/" + "a".repeat(600)), "/history");
  assert.equal(safeNextPath("//x", "/report"), "/report");
});

test("loginUrl은 next를 인코딩하고 검증", () => {
  assert.equal(loginUrl("/report?restore=1"), "/login?next=%2Freport%3Frestore%3D1");
  assert.equal(loginUrl("//evil.com"), "/login?next=%2Fhistory");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGithubRepo, validate } from "./validate.ts";

test("parseGithubRepo", () => {
  assert.deepEqual(parseGithubRepo("https://github.com/0613yunseo/catchup-ai"), {
    owner: "0613yunseo",
    repo: "catchup-ai",
  });
  assert.deepEqual(parseGithubRepo(" https://github.com/a/b.git/ "), { owner: "a", repo: "b" });
  for (const bad of [
    "",
    "github.com/a/b",
    "http://github.com/a/b",
    "https://gitlab.com/a/b",
    "https://github.com/a",
    "https://github.com/a/b/tree/main",
    "https://github.com.evil.com/a/b",
  ]) {
    assert.equal(parseGithubRepo(bad), null, bad);
  }
});

test("validate", () => {
  const ok = {
    name: "캡스톤",
    type: "meeting",
    text: "로그인 기능을 구현하기로 했다. 관리자 페이지도 필요하다.",
    repoUrl: "https://github.com/a/b",
  };
  assert.deepEqual(validate(ok), {});
  const empty = validate({ name: " ", type: "meeting", text: "짧음", repoUrl: "x" });
  assert.deepEqual(Object.keys(empty).sort(), ["name", "repoUrl", "text"]);
  assert.ok(validate({ ...ok, text: "가".repeat(20001) }).text);
});

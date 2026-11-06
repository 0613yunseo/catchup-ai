import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { classifyPath, countLines, inspectContent } from "./filter.ts";
import { TarReader } from "./tar.ts";
import { collectRepository } from "./collect.ts";
import { toInspectResponse } from "./response.ts";

// 더미 값이다. 보안 스캐너가 소스의 PEM 머리글을 실제 키로 오탐하지 않도록 실행 시점에 조립한다.
const pem = (edge, kind = "") => "-----" + edge + " " + kind + "PRIVATE KEY" + "-----";

const SHA = "a".repeat(40);
const TREE = "b".repeat(40);

// ---- tar 만들기 ----
function entry(name, content, type = "0") {
  const data = Buffer.from(content);
  const h = Buffer.alloc(512);
  h.write(name, 0, "utf8");
  h.write(data.length.toString(8).padStart(11, "0") + "\0", 124);
  h[156] = type.charCodeAt(0);
  h.write("ustar\0", 257);
  const pad = (512 - (data.length % 512)) % 512;
  return Buffer.concat([h, data, Buffer.alloc(pad)]);
}
function archive(files, extra = []) {
  const parts = [entry("pax_global_header", "52 comment=" + SHA + "\n", "g"), ...extra];
  parts.push(entry(`o-r-${SHA}/`, "", "5"));
  for (const [path, content] of Object.entries(files)) parts.push(entry(`o-r-${SHA}/${path}`, content));
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

// ---- 가짜 GitHub ----
function fakeGithub({ files = {}, repo = {}, tree = {}, tarball, commitStatus = 200, repoStatus = 200, headers = {} } = {}) {
  const calls = [];
  const json = (body, status = 200, h = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...h } });
  const f = async (url, init = {}) => {
    const u = new URL(String(url));
    calls.push({ url: u.href, auth: init.headers?.Authorization });
    if (u.hostname === "api.github.com") {
      const p = u.pathname;
      if (p === "/repos/o/r") {
        if (repoStatus !== 200) return json({ message: "x" }, repoStatus, headers);
        return json({ name: "r", full_name: "o/r", owner: { login: "o" }, description: "desc", default_branch: "main", private: false, html_url: "https://github.com/o/r", size: 10, ...repo });
      }
      if (p === "/repos/o/r/commits/main" || p === `/repos/o/r/commits/${SHA}`) {
        if (commitStatus !== 200) return json({ message: "Git Repository is empty." }, commitStatus);
        return json({ sha: SHA, commit: { tree: { sha: TREE }, committer: { date: "2026-01-01T00:00:00Z" } } });
      }
      if (p === `/repos/o/r/git/trees/${TREE}`) {
        const entries = Object.entries(files).map(([path, c]) => ({ path, mode: "100644", type: "blob", sha: "c".repeat(40), size: Buffer.byteLength(c) }));
        return json({ truncated: false, tree: entries, ...tree });
      }
      if (p === `/repositories/1/tarball/${SHA}`) {
        return new Response(null, { status: 302, headers: { location: `https://codeload.github.com/o/r/legacy.tar.gz/${SHA}` } });
      }
      if (p === `/repos/o/r/tarball/${SHA}` && tarball?.viaRepositoryId) {
        return new Response(null, { status: 301, headers: { location: `https://api.github.com/repositories/1/tarball/${SHA}` } });
      }
      if (p === `/repos/o/r/tarball/${SHA}`) {
        return new Response(null, { status: 302, headers: { location: tarball?.location ?? `https://codeload.github.com/o/r/legacy.tar.gz/${SHA}` } });
      }
    }
    if (u.hostname === "codeload.github.com") return new Response(tarball?.body ?? archive(files), { status: 200 });
    throw new Error("unexpected request " + u.href);
  };
  f.calls = calls;
  return f;
}

const ref = { owner: "o", repo: "r" };
const code = async (p) => p.then(() => null, (e) => e.code);

// ---- 순수 규칙 ----
test("classifyPath: 우선순위 — 핵심 코드가 테스트·예제보다 먼저", () => {
  assert.equal(classifyPath("README.md").tier, 0);
  assert.equal(classifyPath("packages/core/src/a.ts").tier, 1);
  assert.equal(classifyPath("tools/a.ts").tier, 2);
  assert.equal(classifyPath("fixtures/app/src/a.ts").tier, 3);
});

test("classifyPath: 제외·허용 규칙", () => {
  for (const ok of ["src/a.ts", "app/page.tsx", "main.py", "package.json", "README.md"]) assert.equal(classifyPath(ok).ok, true, ok);
  for (const bad of [
    "node_modules/x/index.js", ".next/server/a.js", "dist/a.js", "a/.git/config", ".env", ".env.local", "config/.env.production",
    "keys/server.pem", "id_rsa", "secrets.json", "aws/credentials", "a/service-account.json", "img/logo.png", "a.zip",
    "package-lock.json", "yarn.lock", "a.min.js", "docs/guide.md", "../etc/passwd", "/abs.ts", ".npmrc", "x/terraform.tfstate",
  ]) assert.equal(classifyPath(bad).ok, false, bad);
});

test("inspectContent: 바이너리·개인키 제외, CRLF·BOM 정리, 줄 수", () => {
  assert.equal(inspectContent(Buffer.from([0x89, 0x50, 0, 1])).reason, "binary");
  assert.equal(inspectContent(Buffer.from([0xff, 0xfe, 0xfd])).reason, "binary");
  assert.equal(inspectContent(Buffer.from(pem("BEGIN", "RSA ") + "\nabc")).reason, "secret");
  const r = inspectContent(Buffer.from("﻿a\r\nb\r\n"));
  assert.equal(r.text, "a\nb\n");
  assert.equal(countLines(r.text), 2);
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a"), 1);
});

test("TarReader: 작은 조각으로 나눠 읽어도 필요한 파일만 정확히 얻는다", () => {
  const gz = archive({ "src/a.ts": "const a = 1;\n", "big.bin": "x".repeat(5000), "src/b.ts": "b".repeat(700) });
  const raw = require_gunzip(gz);
  const got = new Map();
  const r = new TarReader(new Map([["src/a.ts", 100], ["src/b.ts", 1000]]), (p, d) => got.set(p, d.toString()));
  for (let i = 0; i < raw.length && !r.done; i += 37) r.push(raw.subarray(i, i + 37));
  assert.equal(r.done, true);
  assert.equal(got.get("src/a.ts"), "const a = 1;\n");
  assert.equal(got.get("src/b.ts"), "b".repeat(700));
  assert.equal(got.has("big.bin"), false);
});
import { gunzipSync } from "node:zlib";
function require_gunzip(b) {
  return gunzipSync(b);
}

// ---- 수집 ----
test("collectRepository: 실제 내용·줄 수·커밋 SHA 고정", async () => {
  const files = {
    "src/index.ts": "export const a = 1;\r\nexport const b = 2;\r\n",
    "README.md": "# hi\n",
    "node_modules/x/index.js": "no",
    ".env": "SECRET=1",
    "assets/logo.png": "\u0089PNG",
    "secrets/key.ts": "x",
  };
  const f = fakeGithub({ files });
  const res = await collectRepository(ref, { fetch: f, token: "tok" });
  assert.equal(res.repository.commitSha, SHA);
  assert.equal(res.repository.defaultBranch, "main");
  assert.deepEqual(res.files.map((x) => x.path).sort(), ["README.md", "src/index.ts"]);
  const idx = res.files.find((x) => x.path === "src/index.ts");
  assert.equal(idx.content, "export const a = 1;\nexport const b = 2;\n");
  assert.equal(idx.lineCount, 2);
  assert.equal(idx.language, "TypeScript");
  assert.equal(res.summary.totalFiles, 6);
  assert.equal(res.summary.candidates, 2);
  assert.equal(res.summary.collected, 2);
  assert.equal(res.summary.excluded, 4);
  // 토큰은 api.github.com에만, 아카이브 호스트에는 붙이지 않는다.
  assert.ok(f.calls.filter((c) => c.url.startsWith("https://api.github.com")).every((c) => c.auth === "Bearer tok"));
  assert.ok(f.calls.filter((c) => c.url.includes("codeload")).every((c) => c.auth === undefined));
  // 브라우저용 응답에는 파일 내용이 없다.
  const out = toInspectResponse(res);
  assert.ok(out.files.every((x) => !("content" in x)));
  assert.ok(!JSON.stringify(out).includes("export const"));
});

test("collectRepository: commitSha 고정 조회", async () => {
  const f = fakeGithub({ files: { "a.ts": "1" } });
  const res = await collectRepository(ref, { fetch: f, commitSha: SHA });
  assert.equal(res.repository.commitSha, SHA);
  assert.ok(f.calls.some((c) => c.url.endsWith(`/commits/${SHA}`)));
  assert.equal(await code(collectRepository(ref, { fetch: f, commitSha: "main" })), "INVALID_REQUEST");
});

test("collectRepository: 크기·개수 제한과 경고", async () => {
  const files = { "src/big.ts": "x".repeat(500), "src/a.ts": "a", "src/b.ts": "b", "src/c.ts": "c" };
  const res = await collectRepository(ref, { fetch: fakeGithub({ files }), limits: { maxFileBytes: 100, maxFiles: 2 } });
  assert.equal(res.files.length, 2);
  const codes = res.warnings.map((w) => w.code);
  assert.ok(codes.includes("SIZE_LIMIT") && codes.includes("FILE_LIMIT"));
  assert.equal(res.summary.candidates, 4);
  assert.equal(res.summary.limited, 2);
});

test("collectRepository: 개인키 내용은 경로가 정상이어도 제외", async () => {
  const files = { "src/ok.ts": "ok", "src/leak.ts": pem("BEGIN") + "\nabc\n" + pem("END") };
  const res = await collectRepository(ref, { fetch: fakeGithub({ files }) });
  assert.deepEqual(res.files.map((f) => f.path), ["src/ok.ts"]);
  assert.ok(res.warnings.some((w) => w.code === "SECRET_CONTENT"));
});

test("collectRepository: 아카이브 읽기 상한을 넘으면 중단하고 경고", async () => {
  const files = { "src/a.ts": "a".repeat(5000), "src/z.ts": "z" };
  const res = await collectRepository(ref, { fetch: fakeGithub({ files }), limits: { maxArchiveBytes: 100 } });
  assert.ok(res.warnings.some((w) => w.code === "ARCHIVE_LIMIT"));
  assert.ok(res.files.length < 2);
});

test("collectRepository: 오류를 종류별로 구분", async () => {
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repoStatus: 404 }) })), "NOT_FOUND");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repo: { private: true } }) })), "PRIVATE_REPOSITORY");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ commitStatus: 409 }) })), "EMPTY_REPOSITORY");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repoStatus: 500 }) })), "GITHUB_UNAVAILABLE");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repoStatus: 401 }) })), "AUTH_FAILED");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repoStatus: 451 }) })), "UNAVAILABLE_FOR_LEGAL_REASONS");
  assert.equal(await code(collectRepository(ref, { fetch: fakeGithub({ repoStatus: 403 }) })), "FORBIDDEN");

  const reset = String(Math.floor(Date.now() / 1000) + 600);
  let e = await collectRepository(ref, { fetch: fakeGithub({ repoStatus: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset } }) }).catch((x) => x);
  assert.equal(e.code, "RATE_LIMITED");
  assert.ok(e.retryAfterSec > 500 && e.retryAfterSec <= 600);
  e = await collectRepository(ref, { fetch: fakeGithub({ repoStatus: 429, headers: { "retry-after": "30" } }) }).catch((x) => x);
  assert.equal(e.code, "RATE_LIMITED");
  assert.equal(e.retryAfterSec, 30);

  const down = async () => {
    throw new TypeError("fetch failed");
  };
  assert.equal(await code(collectRepository(ref, { fetch: down })), "NETWORK");

  const slow = (_u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "TimeoutError" }))));
  assert.equal(await code(collectRepository(ref, { fetch: slow, limits: { jsonTimeoutMs: 30 } })), "TIMEOUT");
});

test("collectRepository: 잘못된 소유자/저장소 이름과 외부 호스트 리다이렉트 거부", async () => {
  const never = async () => {
    throw new Error("호출되면 안 됨");
  };
  for (const bad of [{ owner: "..", repo: "r" }, { owner: "o", repo: ".." }, { owner: "o/x", repo: "r" }, { owner: "o", repo: "r?x=1" }]) {
    assert.equal(await code(collectRepository(bad, { fetch: never })), "INVALID_URL");
  }
  const f = fakeGithub({ files: { "a.ts": "1" }, tarball: { location: "https://evil.example/x.tar.gz" } });
  assert.equal(await code(collectRepository(ref, { fetch: f })), "GITHUB_UNAVAILABLE");
  assert.ok(f.calls.every((c) => !c.url.includes("evil.example")));
});

test("collectRepository: 이름이 바뀐 저장소의 api.github.com 리다이렉트를 따라간다", async () => {
  const f = fakeGithub({ files: { "a.ts": "1" }, tarball: { viaRepositoryId: true } });
  const res = await collectRepository(ref, { fetch: f, token: "tok" });
  assert.equal(res.files.length, 1);
  // api.github.com 리다이렉트에는 토큰을 유지하고, codeload에는 붙이지 않는다.
  assert.ok(f.calls.filter((c) => c.url.includes("/repositories/1/")).every((c) => c.auth === "Bearer tok"));
  assert.ok(f.calls.filter((c) => c.url.includes("codeload")).every((c) => c.auth === undefined));
});

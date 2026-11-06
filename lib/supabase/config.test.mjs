import { test } from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig, isSupabaseConfigured, parseSupabaseConfig } from "./config.ts";

const URL_OK = "https://abcd1234.supabase.co";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => `${b64({ alg: "HS256" })}.${b64({ role })}.sig`;

test("설정이 없거나 비어 있으면 null — 앱은 Supabase 없이 동작한다", () => {
  assert.equal(parseSupabaseConfig(undefined, undefined), null);
  assert.equal(parseSupabaseConfig(URL_OK, ""), null); // 키 자리만 있는 상태
  assert.equal(parseSupabaseConfig(URL_OK, "   "), null);
  assert.equal(parseSupabaseConfig("", "sb_publishable_x"), null);
});

test("올바른 URL과 공개 키는 통과하고, URL은 origin으로 정리된다", () => {
  assert.deepEqual(parseSupabaseConfig(` ${URL_OK}/ `, " sb_publishable_abc "), { url: URL_OK, publishableKey: "sb_publishable_abc" });
  assert.deepEqual(parseSupabaseConfig(URL_OK, jwt("anon")), { url: URL_OK, publishableKey: jwt("anon") }); // 이전 형식의 anon 키
  assert.ok(parseSupabaseConfig("http://localhost:54321", "k")); // 로컬 개발
});

test("잘못된 URL은 거부", () => {
  for (const bad of ["not a url", "ftp://x.supabase.co", "http://evil.example.com", "javascript:alert(1)"]) {
    assert.equal(parseSupabaseConfig(bad, "sb_publishable_x"), null, bad);
  }
});

test("비밀 키가 공개 변수에 들어오면 사용하지 않는다", () => {
  assert.equal(parseSupabaseConfig(URL_OK, "sb_secret_abcdef"), null);
  assert.equal(parseSupabaseConfig(URL_OK, jwt("service_role")), null);
});

test("환경 변수에서 읽는다: 설정 전에는 미설정, 설정 후에는 설정됨", () => {
  const saved = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY];
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    assert.equal(getSupabaseConfig(), null);
    assert.equal(isSupabaseConfigured(), false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_OK;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";
    assert.equal(isSupabaseConfigured(), false);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.equal(isSupabaseConfigured(), true);
  } finally {
    if (saved[0] === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved[0];
    if (saved[1] === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = saved[1];
  }
});

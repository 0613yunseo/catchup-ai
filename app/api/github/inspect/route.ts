import { GithubError, httpStatusFor } from "@/lib/github/errors";
import { collectRepository } from "@/lib/github/collect";
import { toInspectResponse } from "@/lib/github/response";
import type { InspectErrorInfo } from "@/lib/github/types";
import { parseGithubRepo } from "@/lib/validate";

// 런타임은 기본값(Node.js)을 쓴다. node:zlib와 node:stream이 필요하다.
export const maxDuration = 30;

const MAX_BODY = 4096;
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: InspectErrorInfo) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (error.retryAfterSec) headers["Retry-After"] = String(error.retryAfterSec);
  return Response.json({ ok: false, error }, { status: httpStatusFor(error.code), headers });
}

// POST /api/github/inspect  { "repoUrl": "https://github.com/owner/repo" }
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(new GithubError("INVALID_REQUEST").toInfo());
  }
  let repoUrl: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return fail(new GithubError("INVALID_REQUEST").toInfo());
    repoUrl = (JSON.parse(text) as { repoUrl?: unknown })?.repoUrl;
  } catch {
    return fail(new GithubError("INVALID_REQUEST").toInfo());
  }
  if (typeof repoUrl !== "string" || repoUrl.length > 300) return fail(new GithubError("INVALID_URL").toInfo());

  const ref = parseGithubRepo(repoUrl);
  if (!ref) return fail(new GithubError("INVALID_URL").toInfo());

  try {
    const result = await collectRepository(ref, { token: process.env.GITHUB_TOKEN });
    return Response.json({ ok: true, data: toInspectResponse(result) }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof GithubError) return fail(e.toInfo());
    // 내부 오류의 상세는 응답에 싣지 않는다.
    console.error("github inspect failed", e instanceof Error ? e.name : "unknown");
    return fail(new GithubError("INTERNAL").toInfo());
  }
}

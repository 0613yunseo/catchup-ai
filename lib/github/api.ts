// GitHub REST API 호출. 요청 주소는 항상 api.github.com이며, 아카이브만 API가 알려 준 codeload.github.com으로 따라간다.
import { GithubError } from "./errors.ts";
import type { Limits } from "./limits.ts";
import type { RateLimitInfo } from "./types.ts";

const API_ORIGIN = "https://api.github.com";
const ARCHIVE_HOST = "codeload.github.com";

export type Ctx = {
  fetch: typeof fetch;
  /** 서버 전용 토큰(선택). api.github.com 요청에만 붙인다. */
  token?: string;
  /** 조회 전체 마감 시각(ms) */
  deadline: number;
  limits: Limits;
  rate: RateLimitInfo | null;
};

export const enc = encodeURIComponent;

function apiHeaders(ctx: Ctx): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "catchup-ai",
    ...(ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}),
  };
}

function timeoutSignal(ctx: Ctx, ms: number): AbortSignal {
  const t = Math.min(ms, ctx.deadline - Date.now());
  if (t <= 0) throw new GithubError("TIMEOUT");
  return AbortSignal.timeout(t);
}

async function send(ctx: Ctx, url: URL, init: RequestInit): Promise<Response> {
  try {
    return await ctx.fetch(url, init);
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") throw new GithubError("TIMEOUT");
    throw new GithubError("NETWORK");
  }
}

function recordRate(ctx: Ctx, res: Response): void {
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining === null) return;
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  ctx.rate = {
    remaining: Number(remaining),
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
  };
}

async function httpError(res: Response): Promise<GithubError> {
  const { status } = res;
  let message = "";
  try {
    message = String(((await res.json()) as { message?: unknown }).message ?? "");
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 본다.
  }
  const remaining = res.headers.get("x-ratelimit-remaining");
  const limited = status === 429 || (status === 403 && (remaining === "0" || /rate limit|abuse/i.test(message)));
  if (limited) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const sec =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.ceil(retryAfter)
        : Number.isFinite(reset) && reset > 0
          ? Math.max(1, Math.ceil(reset - Date.now() / 1000))
          : 60;
    const wait = sec >= 120 ? `약 ${Math.ceil(sec / 60)}분` : `${sec}초`;
    return new GithubError("RATE_LIMITED", sec, `GitHub API 요청 한도에 도달했습니다. ${wait} 후 다시 시도해 주세요.`);
  }
  if (status === 401) return new GithubError("AUTH_FAILED");
  if (status === 403) return new GithubError("FORBIDDEN");
  if (status === 404) return new GithubError("NOT_FOUND");
  if (status === 409) return new GithubError("EMPTY_REPOSITORY");
  if (status === 451) return new GithubError("UNAVAILABLE_FOR_LEGAL_REASONS");
  return new GithubError("GITHUB_UNAVAILABLE");
}

export async function ghJson<T>(ctx: Ctx, path: string): Promise<T> {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new GithubError("INTERNAL");
  const res = await send(ctx, url, {
    headers: apiHeaders(ctx),
    signal: timeoutSignal(ctx, ctx.limits.jsonTimeoutMs),
    cache: "no-store",
  });
  recordRate(ctx, res);
  if (!res.ok) throw await httpError(res);
  try {
    return (await res.json()) as T;
  } catch {
    throw new GithubError("GITHUB_UNAVAILABLE");
  }
}

/** 커밋 SHA 기준 tar.gz를 연다. 반환된 signal은 본문을 읽는 동안에도 마감 시간을 지킨다. */
export async function openArchive(
  ctx: Ctx,
  owner: string,
  repo: string,
  sha: string,
): Promise<{ body: ReadableStream<Uint8Array>; signal: AbortSignal }> {
  let url = new URL(`/repos/${enc(owner)}/${enc(repo)}/tarball/${enc(sha)}`, API_ORIGIN);
  // 이름이 바뀐 저장소는 api.github.com 안에서 한 번 더 넘어가고, 마지막에 codeload.github.com으로 간다.
  // 리다이렉트는 직접 따라가며, 허용한 두 호스트가 아니면 요청하지 않는다.
  for (let hop = 0; hop < 4; hop++) {
    const onApi = url.origin === API_ORIGIN;
    const res = await send(ctx, url, {
      headers: onApi ? apiHeaders(ctx) : { "User-Agent": "catchup-ai" },
      redirect: "manual",
      signal: timeoutSignal(ctx, onApi ? ctx.limits.jsonTimeoutMs : ctx.deadline - Date.now()),
      cache: "no-store",
    });
    if (onApi) recordRate(ctx, res);
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      let next: URL;
      try {
        next = new URL(res.headers.get("location") ?? "");
      } catch {
        throw new GithubError("GITHUB_UNAVAILABLE");
      }
      if (next.protocol !== "https:" || (next.origin !== API_ORIGIN && next.hostname !== ARCHIVE_HOST)) {
        throw new GithubError("GITHUB_UNAVAILABLE");
      }
      url = next;
      continue;
    }
    if (!res.ok || !res.body) throw await httpError(res);
    return { body: res.body, signal: timeoutSignal(ctx, ctx.deadline - Date.now()) };
  }
  throw new GithubError("GITHUB_UNAVAILABLE");
}

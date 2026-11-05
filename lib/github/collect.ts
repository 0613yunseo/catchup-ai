// 공개 GitHub 저장소를 조회해 분석에 쓸 소스코드를 수집하는 서버 전용 모듈.
// UI와 무관하다. 이후 AI 분석 모듈은 collectRepository()를 같은 commitSha로 다시 호출해 같은 코드를 얻는다.
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { ghJson, openArchive, enc, type Ctx } from "./api.ts";
import { GithubError } from "./errors.ts";
import { classifyPath, countLines, inspectContent } from "./filter.ts";
import { DEFAULT_LIMITS, type Limits } from "./limits.ts";
import { TarReader } from "./tar.ts";
import type {
  CollectedRepository,
  InspectWarning,
  RepoRef,
  SourceFile,
} from "./types.ts";

export type CollectOptions = {
  /** 지정하면 기본 브랜치 대신 이 커밋을 조회한다. 같은 근거를 다시 확인할 때 쓴다. */
  commitSha?: string;
  /** 서버 전용 GitHub 토큰(선택). 없으면 인증 없이 조회한다. */
  token?: string;
  fetch?: typeof fetch;
  limits?: Partial<Limits>;
};

type ApiRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  default_branch: string;
  private: boolean;
  html_url: string;
  size: number;
};
type ApiCommit = { sha: string; commit: { tree: { sha: string }; committer?: { date?: string } | null } };
type ApiTree = {
  truncated: boolean;
  tree: { path: string; mode: string; type: string; sha: string; size?: number }[];
};

type Planned = { path: string; size: number; sha: string; extension: string; language: string };

class LimitError extends Error {}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

const kb = (n: number) => `${Math.round(n / 1000)}KB`;
const sample = (paths: string[]) => paths.slice(0, 3).join(", ") + (paths.length > 3 ? " 등" : "");

export async function collectRepository(ref: RepoRef, opts: CollectOptions = {}): Promise<CollectedRepository> {
  if (!OWNER_RE.test(ref.owner) || !REPO_RE.test(ref.repo) || ref.repo === "." || ref.repo === "..") {
    throw new GithubError("INVALID_URL");
  }
  if (opts.commitSha !== undefined && !SHA_RE.test(opts.commitSha)) throw new GithubError("INVALID_REQUEST");

  const limits: Limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const ctx: Ctx = {
    fetch: opts.fetch ?? fetch,
    token: opts.token || undefined,
    deadline: Date.now() + limits.totalTimeoutMs,
    limits,
    rate: null,
  };
  const warnings: InspectWarning[] = [];
  const base = `/repos/${enc(ref.owner)}/${enc(ref.repo)}`;

  // 1) 저장소 정보: 존재 여부, 공개 여부, 기본 브랜치
  const info = await ghJson<ApiRepo>(ctx, base);
  if (info.private) throw new GithubError("PRIVATE_REPOSITORY");
  if (info.size > limits.largeRepoKb) {
    warnings.push({
      code: "LARGE_REPOSITORY",
      message: "저장소가 매우 커서 일부 파일만 읽을 수 있습니다. 수집하지 못한 파일 수는 요약에 표시됩니다.",
    });
  }

  // 2) 커밋: 이후 모든 조회는 이 SHA에 고정한다.
  const branchPath = info.default_branch.split("/").map(enc).join("/");
  const commit = await ghJson<ApiCommit>(ctx, `${base}/commits/${opts.commitSha ?? branchPath}`);

  // 3) 파일 트리
  const tree = await ghJson<ApiTree>(ctx, `${base}/git/trees/${enc(commit.commit.tree.sha)}?recursive=1`);
  if (tree.truncated) {
    warnings.push({
      code: "TREE_TRUNCATED",
      message: "저장소가 너무 커서 파일 목록의 일부만 조회되었습니다.",
    });
  }

  // 4) 수집 대상 선정
  const blobs = tree.tree.filter((e) => e.type === "blob");
  const candidates: (Planned & { tier: number })[] = [];
  for (const e of blobs) {
    if (e.mode === "120000" || typeof e.size !== "number") continue; // 심볼릭 링크 제외
    const c = classifyPath(e.path);
    if (c.ok) candidates.push({ path: e.path, size: e.size, sha: e.sha, extension: c.extension, language: c.language, tier: c.tier });
  }
  candidates.sort(
    (a, b) => a.tier - b.tier || a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path),
  );

  const selected: Planned[] = [];
  const tooLarge: string[] = [];
  let overCount = 0;
  let overTotal = 0;
  let planned = 0;
  for (const c of candidates) {
    if (c.size > limits.maxFileBytes) tooLarge.push(c.path);
    else if (selected.length >= limits.maxFiles) overCount++;
    else if (planned + c.size > limits.maxTotalBytes) overTotal++;
    else {
      selected.push(c);
      planned += c.size;
    }
  }
  if (tooLarge.length) {
    warnings.push({
      code: "SIZE_LIMIT",
      message: `${tooLarge.length}개 파일이 ${kb(limits.maxFileBytes)}를 넘어 제외했습니다 (${sample(tooLarge)}).`,
      paths: tooLarge.slice(0, 20),
    });
  }
  if (overCount) {
    warnings.push({ code: "FILE_LIMIT", message: `파일은 최대 ${limits.maxFiles}개까지 수집합니다. ${overCount}개를 제외했습니다.` });
  }
  if (overTotal) {
    warnings.push({ code: "TOTAL_LIMIT", message: `전체 수집 용량(${kb(limits.maxTotalBytes)}) 제한으로 ${overTotal}개 파일을 제외했습니다.` });
  }

  const files: SourceFile[] = [];
  if (selected.length === 0) {
    warnings.push({ code: "NO_ANALYZABLE_FILES", message: "분석할 수 있는 코드 파일을 찾지 못했습니다." });
  } else {
    // 5) 선택한 파일의 실제 내용: 같은 커밋의 아카이브 한 번으로 읽는다.
    const got = await readFiles(ctx, ref, commit.sha, selected, warnings);
    const mismatch: string[] = [];
    const binary: string[] = [];
    const secret: string[] = [];
    for (const p of selected) {
      const buf = got.get(p.path);
      if (!buf) continue;
      if (buf.length !== p.size) {
        mismatch.push(p.path);
        continue;
      }
      const r = inspectContent(buf);
      if (!r.ok) {
        (r.reason === "secret" ? secret : binary).push(p.path);
        continue;
      }
      files.push({
        path: p.path,
        extension: p.extension,
        language: p.language,
        content: r.text,
        lineCount: countLines(r.text),
        size: p.size,
        blobSha: p.sha,
      });
    }
    if (mismatch.length) {
      warnings.push({ code: "CONTENT_MISMATCH", message: `${mismatch.length}개 파일의 내용이 트리 정보와 달라 제외했습니다.`, paths: mismatch.slice(0, 20) });
    }
    if (binary.length) {
      warnings.push({ code: "BINARY_CONTENT", message: `${binary.length}개 파일이 텍스트가 아니어서 제외했습니다.`, paths: binary.slice(0, 20) });
    }
    if (secret.length) {
      warnings.push({ code: "SECRET_CONTENT", message: `${secret.length}개 파일에 개인키로 보이는 내용이 있어 제외했습니다.`, paths: secret.slice(0, 20) });
    }
  }

  return {
    repository: {
      owner: info.owner.login,
      repo: info.name,
      name: info.full_name,
      description: info.description,
      defaultBranch: info.default_branch,
      commitSha: commit.sha,
      committedAt: commit.commit.committer?.date ?? null,
      htmlUrl: info.html_url,
    },
    files,
    summary: {
      totalFiles: blobs.length,
      candidates: candidates.length,
      collected: files.length,
      excluded: blobs.length - candidates.length,
      limited: candidates.length - files.length,
      totalBytes: files.reduce((n, f) => n + f.size, 0),
    },
    warnings,
    rateLimit: ctx.rate,
  };
}

async function readFiles(
  ctx: Ctx,
  ref: RepoRef,
  sha: string,
  selected: Planned[],
  warnings: InspectWarning[],
): Promise<Map<string, Buffer>> {
  const got = new Map<string, Buffer>();
  const reader = new TarReader(new Map(selected.map((p) => [p.path, p.size])), (path, data) => got.set(path, data));
  const { body, signal } = await openArchive(ctx, ref.owner, ref.repo, sha);

  let read = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      read += chunk.length;
      if (read > ctx.limits.maxArchiveBytes) cb(new LimitError());
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as import("node:stream/web").ReadableStream),
      counter,
      createGunzip(),
      async (source: AsyncIterable<Buffer>) => {
        for await (const chunk of source) {
          reader.push(chunk);
          if (reader.done) break;
        }
      },
      { signal },
    );
  } catch (e) {
    if (!reader.done) {
      const missing = selected.length - got.size;
      const name = (e as { name?: string })?.name;
      if (e instanceof LimitError) {
        warnings.push({
          code: "ARCHIVE_LIMIT",
          message: `저장소가 커서 압축 아카이브를 ${Math.round(ctx.limits.maxArchiveBytes / 1_000_000)}MB까지만 읽었습니다. ${missing}개 파일을 수집하지 못했습니다.`,
        });
      } else if (name === "AbortError" || name === "TimeoutError") {
        warnings.push({ code: "TIMEOUT", message: `시간 제한으로 일부만 읽었습니다. ${missing}개 파일을 수집하지 못했습니다.` });
      } else {
        warnings.push({ code: "READ_FAILED", message: `아카이브를 읽는 중 오류가 발생했습니다. ${missing}개 파일을 수집하지 못했습니다.` });
      }
    }
  }
  if (reader.done === false && got.size < selected.length && warnings.every((w) => !["ARCHIVE_LIMIT", "TIMEOUT", "READ_FAILED"].includes(w.code))) {
    // 아카이브를 끝까지 읽었는데 일부 파일이 없는 경우
    warnings.push({ code: "MISSING_IN_ARCHIVE", message: `${selected.length - got.size}개 파일이 아카이브에 없어 수집하지 못했습니다.` });
  }
  return got;
}

import type { ChangeType, DecisionType, ExtractedRequirement } from "../extract/types.ts";
import { EXTRACT_LIMITS as E } from "../extract/limits.ts";
import type { RepoRef } from "../github/types.ts";
import { INPUT_TYPES, parseGithubRepo, type InputType } from "../validate.ts";
import { CompareError } from "./errors.ts";
import { COMPARE_LIMITS as L } from "./limits.ts";

export type ParsedCompareRequest = {
  projectName: string;
  repoUrl: string;
  ref: RepoRef;
  commitSha?: string;
  requirements: ExtractedRequirement[];
};

const DECISIONS: DecisionType[] = ["confirmed", "suggestion", "undecided"];
const CHANGES: ChangeType[] = ["new", "changed", "removed", "unspecified"];
const ID_RE = /^[A-Za-z0-9_-]{1,20}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

const str = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

// 요청 본문은 신뢰하지 않는다. 형식과 길이를 서버에서 다시 확인한다.
// 요구사항은 비교 대상 "데이터"일 뿐이며, 코드 내용이나 AI 판정은 클라이언트에서 받지 않는다.
export function parseCompareRequest(body: unknown): ParsedCompareRequest {
  const o = (body ?? {}) as Record<string, unknown>;
  if (typeof o.repoUrl !== "string" || o.repoUrl.length > 300) throw new CompareError("INVALID_URL");
  const ref = parseGithubRepo(o.repoUrl);
  if (!ref) throw new CompareError("INVALID_URL");

  let commitSha: string | undefined;
  if (o.commitSha !== undefined && o.commitSha !== null && o.commitSha !== "") {
    if (typeof o.commitSha !== "string" || !SHA_RE.test(o.commitSha)) throw new CompareError("INVALID_REQUEST");
    commitSha = o.commitSha;
  }

  let projectName = `${ref.owner}/${ref.repo}`;
  if (o.projectName !== undefined) {
    if (typeof o.projectName !== "string" || o.projectName.trim().length === 0 || o.projectName.length > E.nameMax) {
      throw new CompareError("INVALID_REQUEST");
    }
    projectName = o.projectName.trim();
  }

  const list = o.requirements;
  if (!Array.isArray(list) || list.length < 1 || list.length > L.maxRequirements) throw new CompareError("INVALID_REQUEST");

  const seen = new Set<string>();
  const requirements = list.map((raw): ExtractedRequirement => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const valid =
      typeof r.id === "string" &&
      ID_RE.test(r.id) &&
      !seen.has(r.id) &&
      str(r.title, E.titleMax) &&
      str(r.description, E.descriptionMax) &&
      INPUT_TYPES.some((t) => t.value === r.sourceType) &&
      str(r.sourceQuote, E.quoteMax) &&
      DECISIONS.includes(r.decisionType as DecisionType) &&
      CHANGES.includes(r.changeType as ChangeType) &&
      (r.ambiguity === null || str(r.ambiguity, E.ambiguityMax));
    if (!valid) throw new CompareError("INVALID_REQUEST");
    seen.add(r.id as string);
    return {
      id: r.id as string,
      title: (r.title as string).trim(),
      description: (r.description as string).trim(),
      sourceType: r.sourceType as InputType,
      sourceQuote: (r.sourceQuote as string).trim(),
      decisionType: r.decisionType as DecisionType,
      changeType: r.changeType as ChangeType,
      ambiguity: r.ambiguity === null ? null : (r.ambiguity as string).trim(),
    };
  });

  return { projectName, repoUrl: o.repoUrl.trim(), ref, commitSha, requirements };
}

// 요구사항 ↔ GitHub 소스코드 비교·판정 엔진 (서버 전용).
// 코드는 서버가 GitHub에서 직접 받은 것만 쓰고, AI의 근거는 실제 파일과 대조한 뒤에만 결과에 넣는다.
import { randomUUID } from "node:crypto";
import { ExtractError } from "../extract/errors.ts";
import type { ResponsesClient } from "../extract/extract.ts";
import type { ExtractedRequirement } from "../extract/types.ts";
import type { CollectedRepository, RepoRef } from "../github/types.ts";
import { STATUSES as STATUS_LIST } from "../status.ts";
import type { Status } from "../status.ts";
import { toCompareError, CompareError } from "./errors.ts";
import { verifyEvidence } from "./evidence.ts";
import { COMPARE_LIMITS as L } from "./limits.ts";
import { runStage, type Budget } from "./model.ts";
import { UNDECIDED_NOTE, applyPolicy } from "./policy.ts";
import { VERDICT_INSTRUCTIONS, SELECT_INSTRUCTIONS, buildSelectInput, buildVerdictInput } from "./prompt.ts";
import type { ParsedCompareRequest } from "./request.ts";
import {
  SELECT_SCHEMA,
  SELECT_SCHEMA_NAME,
  VERDICT_SCHEMA,
  VERDICT_SCHEMA_NAME,
  validateSelection,
  validateVerdicts,
  type SelectionDraft,
  type VerdictDraft,
} from "./schema.ts";
import { buildIndex, keywordTerms, koreanHints, packContext, rankFiles, topCandidates, type Candidate } from "./select.ts";
import { toReport } from "./to-report.ts";
import type { CodeEvidence, CompareCoverage, CompareResponse, CompareSelection, RequirementVerdict } from "./types.ts";

export type CompareDeps = {
  client: ResponsesClient;
  model: string;
  /** 같은 커밋을 다시 조회해 코드를 수집한다. 기본 구현은 collectRepository이다. */
  collect: (ref: RepoRef, opts: { commitSha?: string }) => Promise<CollectedRepository>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  newDelimiter?: () => string;
};

const INCOMPLETE_WARNINGS = new Set(["TREE_TRUNCATED", "ARCHIVE_LIMIT", "TIMEOUT", "READ_FAILED", "MISSING_IN_ARCHIVE"]);
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const noteFor = (list: Candidate[], considered: string[]): string[] =>
  list.filter((c) => considered.includes(c.path)).map((c) => `${c.path} — ${[...new Set(c.reasons)].slice(0, 4).join(", ")}`);

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function compareRequirements(req: ParsedCompareRequest, deps: CompareDeps): Promise<CompareResponse> {
  const now = deps.now ?? Date.now;
  const start = now();
  const delimiter = (deps.newDelimiter ?? (() => randomUUID().slice(0, 8)))();
  const budget: Budget = {
    now,
    sleep: deps.sleep ?? defaultSleep,
    start,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    modelMs: 0,
  };

  // 1) 코드는 항상 서버가 GitHub에서 직접 수집한다. (같은 커밋 SHA로 고정)
  const gh0 = now();
  let collected: CollectedRepository;
  try {
    collected = await deps.collect(req.ref, { commitSha: req.commitSha });
  } catch (e) {
    throw toCompareError(e);
  }
  const githubMs = now() - gh0;
  if (req.commitSha && collected.repository.commitSha !== req.commitSha) throw new CompareError("COMMIT_MISMATCH");

  const files = new Map(collected.files.map((f) => [f.path, f]));
  const s = collected.summary;
  const complete = s.limited === 0 && !collected.warnings.some((w) => INCOMPLETE_WARNINGS.has(w.code));
  const coverage: CompareCoverage = {
    complete,
    totalFiles: s.totalFiles,
    candidates: s.candidates,
    collected: s.collected,
    limited: s.limited,
    warnings: collected.warnings,
  };
  const coverageNote = complete
    ? `분석 가능한 파일 ${s.candidates}개를 모두 수집했습니다.`
    : `분석 가능한 파일 ${s.candidates}개 중 ${s.collected}개만 수집했습니다. 수집하지 못한 ${s.limited}개 파일에 구현이 있을 수 있습니다.`;
  const missedNote = complete ? "" : ` 수집하지 못한 ${s.limited}개 파일에 구현이 있을 수 있습니다.`;

  const verdicts = new Map<string, RequirementVerdict>();
  const policyVerdict = (r: ExtractedRequirement, reason: string, note: string, considered: string[] = []): RequirementVerdict => ({
    requirementId: r.id,
    status: "UNKNOWN",
    reason,
    evidence: [],
    missingConditions: [],
    recommendation: null,
    decisionType: r.decisionType,
    changeType: r.changeType,
    decidedBy: "policy",
    policyNote: note,
    evidenceRejected: 0,
    evidenceRejections: [],
    consideredFiles: considered,
    selectionNotes: [],
    coverageLimited: !complete,
  });

  // 2) 미확정 요구사항은 모델을 부르지 않고 UNKNOWN으로 처리한다.
  const eligible: ExtractedRequirement[] = [];
  for (const r of req.requirements) {
    if (r.decisionType === "undecided") {
      const why = r.ambiguity ? ` 미확정 사유: ${r.ambiguity}` : "";
      verdicts.set(r.id, policyVerdict(r, `${UNDECIDED_NOTE}${why}`, UNDECIDED_NOTE));
    } else eligible.push(r);
  }

  let method: CompareSelection["method"] = "ranked";
  let explanation = "";
  if (eligible.length === 0) {
    explanation = "비교할 확정·제안 요구사항이 없어 AI 비교를 하지 않았습니다.";
  } else if (collected.files.length === 0) {
    for (const r of eligible) {
      verdicts.set(r.id, policyVerdict(r, `수집한 코드 파일이 없어 판정할 수 없습니다.${missedNote}`, "수집된 코드가 없어 판정하지 않았습니다."));
    }
    explanation = "수집된 코드 파일이 없어 AI 비교를 하지 않았습니다.";
  } else {
    // 3) 관련 파일 선택
    const index = buildIndex(collected.files);
    const totalChars = collected.files.reduce((n, f) => n + f.content.length, 0);
    const candidates = new Map<string, Candidate[]>();

    if (totalChars <= L.sendAllBelowChars) {
      method = "all-collected";
      const all = collected.files.map((f): Candidate => ({ path: f.path, score: 1, reasons: ["수집한 코드가 적어 전체를 제공"] }));
      for (const r of eligible) candidates.set(r.id, all);
      explanation = `수집한 코드(${collected.files.length}개 파일, 약 ${Math.round(totalChars / 1000)}K자)가 적어 모든 파일을 AI에게 제공했습니다.`;
    } else {
      const ids = new Set(eligible.map((r) => r.id));
      let drafts = new Map<string, SelectionDraft>();
      let fallback = false;
      try {
        const list = await runStage(deps.client, deps.model, budget, {
          schemaName: SELECT_SCHEMA_NAME,
          effort: "medium",
          schema: SELECT_SCHEMA,
          instructions: SELECT_INSTRUCTIONS,
          maxOutputTokens: L.maxOutputTokensSelect,
          build: () => buildSelectInput(eligible, index, delimiter),
          validate: (raw) => validateSelection(raw, ids, new Set(files.keys())),
        });
        drafts = new Map(list.map((d) => [d.requirementId, d]));
      } catch (e) {
        // 형식 오류만 키워드 선택으로 대체한다. 인증·한도·시간 초과 같은 오류는 그대로 알린다.
        if (e instanceof ExtractError && e.code === "INVALID_OUTPUT") fallback = true;
        else throw toCompareError(e);
      }
      for (const r of eligible) {
        const d = drafts.get(r.id);
        const terms = [...new Set([...(d?.searchTerms ?? []), ...keywordTerms(r.title, r.description, r.sourceQuote), ...koreanHints(r.title, r.description)])];
        candidates.set(r.id, topCandidates(rankFiles(collected.files, index, terms, d?.files ?? [])));
      }
      explanation =
        `수집한 ${collected.files.length}개 파일 전체를 보내지 않고, 요구사항별로 관련도가 높은 파일을 최대 ${L.maxFilesPerRequirement}개씩 골라 제공했습니다. ` +
        (fallback
          ? "AI 파일 선택이 실패해 요구사항 속 영문 키워드와 파일 경로·이름·내용의 일치로만 골랐습니다. "
          : "AI가 파일 목록에서 고른 파일과, 경로·함수 이름·내용의 키워드 일치 점수를 합쳐 골랐습니다. ") +
        "선택되지 않은 파일은 판정에 쓰이지 않았습니다.";
    }

    // 후보가 없는 요구사항은 모델 없이 UNKNOWN 처리한다. (파일을 못 찾은 것만으로 MISMATCH 하지 않는다.)
    const toJudge: ExtractedRequirement[] = [];
    for (const r of eligible) {
      if ((candidates.get(r.id) ?? []).length === 0) {
        verdicts.set(
          r.id,
          policyVerdict(
            r,
            `수집한 파일에서 이 요구사항과 관련된 코드를 찾지 못했습니다.${missedNote || " 정적 검색 기준으로 찾지 못했을 뿐 구현이 없다고 단정할 수 없습니다."}`,
            "관련 후보 파일이 없어 판정하지 않았습니다.",
          ),
        );
      } else toJudge.push(r);
    }

    // 4) 판정: 요구사항을 묶어 소수의 호출로 처리한다.
    await Promise.all(
      chunk(toJudge, L.batchSize).map(async (batch) => {
        const own = new Map(batch.map((r) => [r.id, candidates.get(r.id)!]));
        const pack = packContext(own, files);
        const ids = new Set(batch.map((r) => r.id));
        let drafts: Map<string, VerdictDraft>;
        try {
          drafts = await runStage(deps.client, deps.model, budget, {
            schemaName: VERDICT_SCHEMA_NAME,
            schema: VERDICT_SCHEMA,
            instructions: VERDICT_INSTRUCTIONS,
            maxOutputTokens: L.maxOutputTokensVerdict,
            build: (feedback) =>
              buildVerdictInput({ repository: collected.repository, requirements: batch, shown: pack.shown, coverageNote }, delimiter, feedback),
            validate: (raw) => validateVerdicts(raw, ids),
          });
        } catch (e) {
          throw toCompareError(e);
        }

        for (const r of batch) {
          const info = pack.perRequirement.get(r.id)!;
          const limited = !complete || info.dropped.length > 0 || info.truncated.length > 0;
          const d = drafts.get(r.id);
          if (!d) {
            verdicts.set(r.id, policyVerdict(r, "AI가 이 요구사항의 판정을 반환하지 않아 판정하지 못했습니다.", "AI 응답에 판정이 없어 UNKNOWN으로 처리했습니다.", info.considered));
            continue;
          }
          // AI가 제시한 근거를 실제 파일과 대조한다. 통과한 근거만 쓴다.
          const evidence: CodeEvidence[] = [];
          let rejected = 0;
          const rejections: string[] = [];
          const seen = new Set<string>();
          for (const raw of d.evidence) {
            const v = verifyEvidence(raw, pack.shown, files);
            const key = v.ok ? `${v.evidence.path}:${v.evidence.startLine}-${v.evidence.endLine}` : "";
            if (!v.ok || seen.has(key)) {
              if (!v.ok) {
                rejected++;
                if (rejections.length < 3) rejections.push(v.reason);
              }
              continue;
            }
            seen.add(key);
            evidence.push(v.adjusted ? { ...v.evidence, adjusted: true } : v.evidence);
          }
          const pol = applyPolicy({ requirement: r, status: d.status as Status, evidence, rejected, coverageComplete: complete });
          const missing = [...d.missingConditions];
          if (limited && pol.status !== "VERIFIED") {
            missing.push(
              info.dropped.length || info.truncated.length
                ? "컨텍스트 한도로 제공하지 못했거나 일부만 제공한 파일에 구현이 있을 수 있습니다."
                : "수집하지 못한 파일에 구현이 있을 수 있습니다.",
            );
          }
          verdicts.set(r.id, {
            requirementId: r.id,
            status: pol.status,
            reason: pol.note ? `${pol.note} (AI 판단: ${d.status} — ${d.reason})` : d.reason,
            evidence,
            missingConditions: missing,
            recommendation: d.recommendation,
            decisionType: r.decisionType,
            changeType: r.changeType,
            decidedBy: pol.note ? "policy" : "model",
            policyNote: pol.note,
            evidenceRejected: rejected,
            evidenceRejections: rejections,
            consideredFiles: info.considered,
            selectionNotes: noteFor(own.get(r.id)!, info.considered),
            coverageLimited: limited,
          });
        }
      }),
    );
  }

  const ordered = req.requirements.map((r) => verdicts.get(r.id)!);
  const counts = Object.fromEntries(STATUS_LIST.map((st) => [st, ordered.filter((v) => v.status === st).length])) as Record<Status, number>;
  const selection: CompareSelection = { method, explanation };
  const comparedAt = new Date(now()).toISOString();
  const report = toReport({
    projectName: req.projectName,
    repoUrl: req.repoUrl,
    commitSha: collected.repository.commitSha,
    comparedAt,
    model: deps.model,
    requirements: req.requirements,
    verdicts: ordered,
    coverage,
    selection,
  });

  return {
    repository: collected.repository,
    verdicts: ordered,
    summary: { total: ordered.length, ...counts },
    coverage,
    selection,
    model: deps.model,
    comparedAt,
    usage: {
      modelCalls: budget.calls,
      inputTokens: budget.inputTokens,
      outputTokens: budget.outputTokens,
      totalTokens: budget.totalTokens,
      durationMs: now() - start,
      githubMs,
      modelMs: budget.modelMs,
    },
    report,
  };
}

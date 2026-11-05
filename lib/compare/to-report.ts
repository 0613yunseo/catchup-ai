// 비교 결과를 기존 Report 타입(lib/report.ts)으로 바꾼다. /report 화면이 그대로 쓸 수 있다.
import type { ExtractedRequirement } from "../extract/types.ts";
import type { Report } from "../report.ts";
import type { CompareCoverage, CompareSelection, RequirementVerdict } from "./types.ts";

export type ToReportInput = {
  projectName: string;
  repoUrl: string;
  commitSha: string;
  comparedAt: string;
  model: string;
  requirements: ExtractedRequirement[];
  verdicts: RequirementVerdict[];
  coverage: CompareCoverage;
  selection: CompareSelection;
};

export function toReport(i: ToReportInput): Report {
  const byId = new Map(i.verdicts.map((v) => [v.requirementId, v]));
  return {
    id: `${i.commitSha.slice(0, 7)}-${Date.parse(i.comparedAt)}`,
    projectName: i.projectName,
    repoUrl: i.repoUrl,
    commitSha: i.commitSha,
    analyzedAt: i.comparedAt,
    model: i.model,
    coverage: {
      complete: i.coverage.complete,
      totalFiles: i.coverage.totalFiles,
      candidates: i.coverage.candidates,
      collected: i.coverage.collected,
      limited: i.coverage.limited,
      selection: i.selection.explanation,
      warnings: i.coverage.warnings.map((w) => w.message),
    },
    requirements: i.requirements.map((r) => {
      const v = byId.get(r.id)!;
      return {
        id: r.id,
        text: r.title,
        source: r.sourceType,
        status: v.status,
        reason: v.reason,
        evidence: v.evidence.map((e) => ({ path: e.path, startLine: e.startLine, endLine: e.endLine, snippet: e.snippet, note: e.adjusted ? "AI가 제시한 줄 번호가 어긋나 서버가 인용 코드의 실제 위치에 맞게 범위를 보정했습니다." : undefined })),
        recommendation: v.recommendation ?? undefined,
        description: r.description,
        sourceQuote: r.sourceQuote,
        decisionType: r.decisionType,
        changeType: r.changeType,
        missingConditions: v.missingConditions,
        policyNote: v.policyNote ?? undefined,
        coverageLimited: v.coverageLimited,
        decidedBy: v.decidedBy,
        consideredFiles: v.consideredFiles,
      };
    }),
  };
}

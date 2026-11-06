// 요구사항 ↔ 코드 비교 타입. 서버 모듈, API 응답, 화면이 함께 쓴다. (런타임 코드 없음)
import type { ChangeType, DecisionType, ExtractedRequirement } from "../extract/types.ts";
import type { ExtractErrorCode } from "../extract/types.ts";
import type { InspectErrorCode, InspectWarning, RepositoryInfo } from "../github/types.ts";
import type { Report } from "../report.ts";
import type { Status } from "../status.ts";

/** 서버가 GitHub에서 직접 확인한 코드 근거. 경로·라인·스니펫은 모두 서버가 실제 파일에서 추출했다. */
export type CodeEvidence = {
  path: string;
  startLine: number;
  endLine: number;
  /** 실제 파일의 startLine~endLine 내용 */
  snippet: string;
  language: string;
  /** AI가 제시한 줄 범위가 어긋나 서버가 실제 코드 위치에 맞게 넓혔으면 true */
  adjusted?: boolean;
  /** AI가 스스로 밝힌 근거의 성격. direct: 핵심 동작을 직접 수행하는 코드 / partial: 일부 조건만 / context: 배경·참고 */
  role?: "direct" | "partial" | "context";
};

export type RequirementVerdict = {
  requirementId: string;
  status: Status;
  reason: string;
  /** 서버 검증을 통과한 근거만 들어 있다. */
  evidence: CodeEvidence[];
  /** 확인하지 못한 조건 */
  missingConditions: string[];
  /** 개선 권고 또는 다음 확인 방법 */
  recommendation: string | null;
  decisionType: DecisionType;
  changeType: ChangeType;
  /** model: AI 판정을 검증해 사용 / policy: 서버 정책으로 결정(모델 미호출 또는 판정 조정) */
  decidedBy: "model" | "policy";
  /** 서버가 판정을 정하거나 낮춘 이유. 없으면 null */
  policyNote: string | null;
  /** AI가 제시했지만 서버 검증에 실패해 버린 근거 수 */
  evidenceRejected: number;
  /** 버린 근거의 사유 (코드 내용은 포함하지 않는다). 최대 3건 */
  evidenceRejections: string[];
  /** 이 요구사항을 비교할 때 AI에게 실제로 보여 준 파일 */
  consideredFiles: string[];
  /** 각 파일을 고른 이유 ("경로 — 이유, 이유"). 선택 기준을 설명하는 데 쓴다. */
  selectionNotes: string[];
  /** 수집 범위나 컨텍스트 제한 때문에, 보지 못한 코드에 구현이 있을 수 있는지 */
  coverageLimited: boolean;
};

export type CompareCoverage = {
  /** 미수집 파일이 없고 수집 경고도 없을 때 true */
  complete: boolean;
  totalFiles: number;
  candidates: number;
  collected: number;
  limited: number;
  warnings: InspectWarning[];
};

export type CompareUsage = {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  githubMs: number;
  modelMs: number;
};

export type CompareSelection = {
  /** all-collected: 수집한 파일이 적어 전부 보여 줌 / ranked: 관련도 순으로 골라 보여 줌 */
  method: "all-collected" | "ranked";
  /** 선택 기준 설명 (사용자에게 그대로 보여 줄 수 있다) */
  explanation: string;
};

export type CompareResponse = {
  repository: RepositoryInfo;
  verdicts: RequirementVerdict[];
  summary: { total: number } & Record<Status, number>;
  coverage: CompareCoverage;
  selection: CompareSelection;
  model: string;
  comparedAt: string;
  usage: CompareUsage;
  /** lib/report.ts의 Report로 변환한 결과. /report 화면이 그대로 쓴다. */
  report: Report;
};

export type CompareRequestBody = {
  projectName?: string;
  repoUrl: string;
  commitSha?: string;
  requirements: ExtractedRequirement[];
};

export type CompareErrorCode = ExtractErrorCode | InspectErrorCode | "COMMIT_MISMATCH";

export type CompareErrorInfo = {
  code: CompareErrorCode;
  message: string;
  retryAfterSec?: number;
};

export type CompareOutcome =
  | { ok: true; data: CompareResponse }
  | { ok: false; error: CompareErrorInfo };

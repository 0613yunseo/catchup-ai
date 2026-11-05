import type { ChangeKind } from "@/lib/diff/types";
import type { Status } from "@/lib/status";
import type { InputType } from "@/lib/validate";

// 분석 API가 이 형태로 리포트를 돌려주면 UI는 그대로 동작한다.
// 아래 optional 필드는 이후 기능(다중 문서, 기록, 코드 상세)을 위한 자리이며 현재 UI는 읽지 않는다.

/** 사용자가 입력한 원본 문서 한 건. */
export type SourceDocument = {
  id: string;
  name: string;
  kind: InputType;
  format: "pasted" | "txt" | "md" | "pdf" | "docx";
};

export type Evidence = {
  path: string;
  startLine: number;
  endLine: number;
  snippet?: string;
  note?: string;
};

/** 회의 변경 비교에서 붙는 변경 정보. 구현 상태(status)와는 별개이다. */
export type RequirementChange = {
  kind: ChangeKind;
  summary: string;
  /** 사람이 원문을 직접 확인해야 하는지 */
  needsReview: boolean;
  reviewReason?: string;
  /** 서버가 AI의 분류를 낮추거나 보정한 이유 */
  serverNote?: string;
  /** 이전 회의록 쪽 내용과 원문 근거 */
  previous?: { text: string; quote: string };
  /** 최신 회의록 쪽 내용과 원문 근거 */
  latest?: { text: string; quote: string };
};

export type Requirement = {
  /** 같은 프로젝트의 재분석에서도 같은 요구사항이면 같은 id여야 결과 비교가 가능하다. */
  id: string;
  text: string;
  source: InputType;
  /** 다중 문서일 때 근거 문서. 없으면 source 유형만 표시한다. */
  documentId?: string;
  status: Status;
  reason: string;
  evidence: Evidence[];
  recommendation?: string;
  // 아래는 코드 비교 결과에서 채워지는 선택 필드다. 기존 화면은 읽지 않아도 동작한다.
  /** 요구사항의 구체적 구현 조건 */
  description?: string;
  /** 입력 문서에서 가져온 원문 근거 */
  sourceQuote?: string;
  decisionType?: "confirmed" | "suggestion" | "undecided";
  changeType?: "new" | "changed" | "removed" | "unspecified";
  /** 확인하지 못한 조건 */
  missingConditions?: string[];
  /** 서버가 판정을 정하거나 낮춘 이유 */
  policyNote?: string;
  /** 보지 못한 코드에 구현이 있을 수 있는지(수집 제한 등) */
  coverageLimited?: boolean;
  /** model: AI 판정을 검증해 사용 / policy: 서버 정책으로 결정 */
  decidedBy?: "model" | "policy";
  /** 이 요구사항을 비교할 때 AI에게 보여 준 파일 */
  consideredFiles?: string[];
  /** 회의 변경 비교 결과일 때만 있다. */
  change?: RequirementChange;
};

/** 코드 수집·비교 범위. complete가 false면 일부 파일을 보지 못한 분석이다. */
export type ReportCoverage = {
  complete: boolean;
  totalFiles: number;
  candidates: number;
  collected: number;
  limited: number;
  /** 파일 선택 기준 설명 */
  selection?: string;
  warnings: string[];
};

export type Report = {
  /** single: 단일 문서 분석, diff: 이전·최신 회의록 변경 비교. 없으면 single */
  mode?: "single" | "diff";
  /** 분석 기록 목록에서 이 결과를 가리키는 id. */
  id?: string;
  projectName: string;
  repoUrl: string;
  /** 비교에 사용한 커밋. 이후 코드 링크와 변경 감지에 쓴다. */
  commitSha?: string;
  analyzedAt: string;
  documents?: SourceDocument[];
  /** 비교에 사용한 AI 모델 */
  model?: string;
  coverage?: ReportCoverage;
  requirements: Requirement[];
};

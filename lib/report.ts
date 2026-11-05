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
};

export type Report = {
  /** 분석 기록 목록에서 이 결과를 가리키는 id. */
  id?: string;
  projectName: string;
  repoUrl: string;
  /** 비교에 사용한 커밋. 이후 코드 링크와 변경 감지에 쓴다. */
  commitSha?: string;
  analyzedAt: string;
  documents?: SourceDocument[];
  requirements: Requirement[];
};

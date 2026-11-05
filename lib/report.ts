import type { Status } from "@/lib/status";
import type { InputType } from "@/lib/validate";

// 분석 API 연결 시 이 형태로 리포트를 받는다. 현재는 데이터 소스가 없다.
export type Evidence = {
  path: string;
  startLine: number;
  endLine: number;
  snippet?: string;
  note?: string;
};

export type Requirement = {
  id: string;
  text: string;
  source: InputType;
  status: Status;
  reason: string;
  evidence: Evidence[];
  recommendation?: string;
};

export type Report = {
  projectName: string;
  repoUrl: string;
  analyzedAt: string;
  requirements: Requirement[];
};

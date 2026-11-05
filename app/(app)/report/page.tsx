import type { Metadata } from "next";
import { ReportWorkspace } from "@/components/report/report-workspace";

export const metadata: Metadata = { title: "분석 리포트" };

// 분석 API 연결 전: 리포트 데이터가 없다. 연결 후 여기서 Report를 받아 넘긴다.
export default function ReportPage() {
  return <ReportWorkspace report={null} />;
}

import type { Metadata } from "next";
import { ReportView } from "@/components/report/report-view";

export const metadata: Metadata = { title: "분석 리포트" };

// 분석 API 연결 전: 리포트 데이터가 없다.
export default function ReportPage() {
  return <ReportView report={null} />;
}

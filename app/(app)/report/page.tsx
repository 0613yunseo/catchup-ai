import type { Metadata } from "next";
import { ReportWorkspace } from "@/components/report/report-workspace";
import { getReport } from "@/lib/report-source";

export const metadata: Metadata = { title: "분석 리포트" };

export default async function ReportPage() {
  const report = await getReport();
  return <ReportWorkspace report={report} />;
}

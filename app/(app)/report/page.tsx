import type { Metadata } from "next";
import { ReportLoader } from "@/components/report/report-loader";

export const metadata: Metadata = { title: "분석 리포트" };

// 리포트는 /analyze에서 비교를 마친 같은 브라우저 탭의 sessionStorage에서 읽는다. (서버에는 저장하지 않는다.)
export default function ReportPage() {
  return <ReportLoader />;
}

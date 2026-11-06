import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportLoader } from "@/components/report/report-loader";

export const metadata: Metadata = { title: "분석 리포트" };

// 리포트는 /analyze에서 비교를 마친 같은 브라우저 탭의 sessionStorage에서 읽는다. (로그인하지 않아도 보고, 저장은 선택이다.)
export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportLoader />
    </Suspense>
  );
}

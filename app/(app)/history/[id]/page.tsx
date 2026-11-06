import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryDetail } from "@/components/history/history-detail";

export const metadata: Metadata = { title: "저장된 리포트" };

export default function HistoryDetailPage() {
  return (
    <Suspense fallback={null}>
      <HistoryDetail />
    </Suspense>
  );
}

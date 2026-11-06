import type { Metadata } from "next";
import { HistoryWorkspace } from "@/components/history/history-workspace";

export const metadata: Metadata = { title: "분석 기록" };

// 로그인한 사용자가 클라우드에 저장한 분석 기록. 로그인 여부는 proxy.ts가 서버에서 검증한다.
export default function HistoryPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">분석 기록</h1>
      <p className="mt-1.5 text-muted">클라우드에 저장한 분석 리포트입니다. 기록을 열어도 AI를 다시 호출하지 않습니다.</p>
      <div className="mt-6">
        <HistoryWorkspace />
      </div>
    </div>
  );
}

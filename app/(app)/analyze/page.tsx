import type { Metadata } from "next";
import { AnalyzeWorkspace } from "@/components/analyze/analyze-workspace";

export const metadata: Metadata = { title: "새 분석" };

export default function AnalyzePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">새 분석</h1>
        <p className="mt-1.5 text-muted">
          문서와 공개 저장소를 입력하면 요구사항별 구현 상태를 비교합니다.
        </p>
      </header>
      <AnalyzeWorkspace />
    </div>
  );
}

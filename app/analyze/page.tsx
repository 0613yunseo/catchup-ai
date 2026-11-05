import type { Metadata } from "next";
import { AnalyzeForm } from "@/components/analyze/analyze-form";

export const metadata: Metadata = { title: "분석 시작" };

export default function AnalyzePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,40rem)_1fr] lg:gap-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">분석 시작</h1>
          <p className="mt-2 mb-8 text-muted">
            문서와 저장소 주소를 입력하면 요구사항별 구현 상태를 비교하는 것이 이 화면의 목적입니다.
          </p>
          <AnalyzeForm />
        </div>
        <aside className="lg:pt-24" aria-label="입력 안내">
          <h2 className="text-sm font-semibold">입력 전에 확인하세요</h2>
          <ul className="mt-3 space-y-3 border-t border-line pt-3 text-sm text-muted">
            <li>공개 저장소만 비교할 수 있습니다. 비공개 저장소 주소는 지원하지 않습니다.</li>
            <li>저장소는 루트 주소(<span className="font-mono">github.com/소유자/저장소</span>)로 입력합니다.</li>
            <li>
              <strong className="font-medium text-fg">현재는 분석이 실행되지 않습니다.</strong>{" "}
              입력 검증까지만 동작하며 입력값은 어디에도 전송·저장되지 않습니다.
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

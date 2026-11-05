import Link from "next/link";
import { btnSecondary } from "@/components/button-styles";
import type { Report } from "@/lib/report";

// 제목과 우측 액션 영역. 리포트 다운로드나 분석 기록 같은 액션은 아래 actions 줄에 추가한다.
export function ReportHeader({ report }: { report: Report | null }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">분석 리포트</h1>
        <p className="mt-1.5 break-all text-muted">
          {report ? `${report.projectName} · ${report.repoUrl}` : "분석 결과가 없는 상태입니다."}
        </p>
      </div>
      <div className="flex gap-2">
        {report && (
          <Link href="/analyze" className={btnSecondary}>
            재분석
          </Link>
        )}
        <Link href="/analyze" className={btnSecondary}>
          새 분석
        </Link>
      </div>
    </header>
  );
}

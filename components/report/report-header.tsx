import Link from "next/link";
import { btnSecondary } from "@/components/button-styles";
import type { Report } from "@/lib/report";

function when(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

// 제목, 분석 대상 정보, 우측 액션. 리포트 다운로드나 분석 기록 같은 액션은 아래 actions 줄에 추가한다.
export function ReportHeader({ report }: { report: Report | null }) {
  const sha = report?.commitSha;
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">분석 리포트</h1>
        {report ? (
          <>
            <p className="mt-1.5 break-all text-muted">
              {report.projectName} ·{" "}
              <a
                href={report.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-accent-text underline-offset-2 hover:underline"
              >
                {report.repoUrl.replace("https://github.com/", "")}
              </a>
              {sha && (
                <>
                  {" "}
                  · 커밋{" "}
                  <a
                    href={`${report.repoUrl.replace(/\/$/, "")}/commit/${sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-accent-text underline-offset-2 hover:underline"
                  >
                    {sha.slice(0, 7)}
                  </a>
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-faint">
              {when(report.analyzedAt)}
              {report.model ? ` · AI 모델 ${report.model}` : ""} {report.mode === "diff" ? " · 회의 변경 비교" : ""} · 정적 코드 분석
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-muted">표시할 분석 결과가 없는 상태입니다.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Link href="/analyze" className={btnSecondary}>
          {report ? "다시 분석" : "새 분석"}
        </Link>
      </div>
    </header>
  );
}

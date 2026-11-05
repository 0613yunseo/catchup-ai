import { InfoIcon } from "@/components/icons";
import type { Report } from "@/lib/report";

// 분석 범위와 정적 분석의 한계. 불완전한 수집은 눈에 띄게, 항상 있는 한계는 한 줄로 보여 준다.
export function CoverageNotice({ report }: { report: Report }) {
  const c = report.coverage;
  return (
    <div className="mt-4 space-y-2">
      {c && !c.complete && (
        <div role="note" className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              분석 범위가 불완전합니다: 분석 가능한 파일 {c.candidates.toLocaleString("ko-KR")}개 중 {c.collected.toLocaleString("ko-KR")}개만
              수집했습니다 (미수집 {c.limited.toLocaleString("ko-KR")}개).
            </p>
            <p className="mt-0.5">
              수집하지 못한 파일에 구현이 있을 수 있어, 근거를 찾지 못했다는 이유만으로 구현되지 않았다고 판단하지 않았습니다. 아래 UNKNOWN과
              “확인하지 못한 조건”을 함께 확인하세요.
            </p>
            {c.warnings.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {c.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <p className="text-sm text-faint">
        정적 코드 분석 결과입니다. 코드를 실행하거나 테스트하지 않았고, 코드 근거는 서버가 GitHub 원본과 대조해 확인한 것만 표시합니다.
        {c?.complete && ` 분석 가능한 파일 ${c.candidates.toLocaleString("ko-KR")}개를 모두 수집했습니다.`}
      </p>
      {c?.selection && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-xs text-faint">AI에게 보여 준 파일을 고른 기준</summary>
          <p className="mt-1.5">{c.selection}</p>
        </details>
      )}
    </div>
  );
}

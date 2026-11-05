import Link from "next/link";
import { btnSecondary } from "@/components/button-styles";
import { CodePanelEmpty } from "@/components/code-panel";

const PARTS = [
  "요구사항 원문과 출처 문서",
  "판정 상태와 판정 이유",
  "근거 코드의 파일 경로와 라인 범위",
  "코드 스니펫",
  "개선 권고",
];

export function EmptyWorkspace() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="rounded-lg border border-dashed border-line-strong p-6">
        <h2 className="text-base font-semibold">아직 분석 결과가 없습니다</h2>
        <p className="mt-2 text-sm text-muted">
          분석 엔진이 연결되지 않아 리포트를 만들 수 없습니다. 위의 — 는 실제 값이 아니라 비어 있는 상태입니다.
        </p>
        <p className="mt-5 text-sm font-medium">결과가 생기면 요구사항마다 표시되는 것</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {PARTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Link href="/analyze" className={`${btnSecondary} mt-6`}>
          분석 입력 화면으로
        </Link>
      </section>
      <section aria-label="코드 근거 영역" className="space-y-3">
        <h2 className="text-sm font-semibold">코드 근거</h2>
        <CodePanelEmpty />
      </section>
    </div>
  );
}

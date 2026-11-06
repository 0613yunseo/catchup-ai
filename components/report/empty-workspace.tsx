import { NewAnalysisLink } from "@/components/new-analysis-link";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { CodePanelEmpty } from "@/components/code-panel";
import { InfoIcon } from "@/components/icons";

export type EmptyReason = "none" | "invalid" | "loading";

const PARTS = [
  "요구사항 원문과 출처 문서",
  "판정 상태와 판정 이유",
  "근거 코드의 파일 경로와 라인 범위",
  "코드 스니펫",
  "확인하지 못한 조건과 개선 권고",
];

type Props = { reason: EmptyReason; onClear?: () => void };

// 표시할 리포트가 없을 때의 화면. 어떤 경우에도 가짜 결과를 보여 주지 않는다.
export function EmptyWorkspace({ reason, onClear }: Props) {
  if (reason === "loading") {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong p-6 text-sm text-muted">
        <span className="block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        저장된 분석 결과를 불러오는 중입니다.
      </p>
    );
  }
  const invalid = reason === "invalid";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="rounded-lg border border-dashed border-line-strong p-6">
        {invalid && <InfoIcon className="mb-2 size-5 text-bad" />}
        <h2 className="text-base font-semibold">{invalid ? "저장된 분석 결과를 표시할 수 없습니다" : "표시할 분석 결과가 없습니다"}</h2>
        <p className="mt-2 text-sm text-muted">
          {invalid
            ? "이 브라우저 탭에 저장된 결과가 손상되었거나 올바른 형식이 아니어서 사용하지 않았습니다. 일부만 읽어 보여 주지 않습니다. 새 분석을 실행하면 다시 만들 수 있습니다."
            : "분석 결과는 새 분석에서 ‘코드 비교’를 마친 같은 브라우저 탭에서만 볼 수 있습니다. 탭을 닫았거나 다른 탭에서 열었다면 결과가 없습니다. 위의 — 는 실제 값이 아니라 비어 있는 상태입니다."}
        </p>
        {!invalid && (
          <>
            <p className="mt-5 text-sm font-medium">결과가 있으면 요구사항마다 표시되는 것</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {PARTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <NewAnalysisLink className={btnPrimary}>
            새 분석 시작
          </NewAnalysisLink>
          {invalid && onClear && (
            <button type="button" onClick={onClear} className={btnSecondary}>
              저장된 결과 지우기
            </button>
          )}
        </div>
      </section>
      <section aria-label="코드 근거 영역" className="space-y-3">
        <h2 className="text-sm font-semibold">코드 근거</h2>
        <CodePanelEmpty />
      </section>
    </div>
  );
}

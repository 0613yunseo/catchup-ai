import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { CodePanel } from "@/components/code-panel";
import { InfoIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import type { ComparisonState } from "@/components/analyze/use-comparison";
import type { Requirement } from "@/lib/report";
import { STATUSES, STATUS_META } from "@/lib/status";

type Props = {
  state: ComparisonState;
  canRun: boolean;
  /** 실행할 수 없는 이유. 실행 가능하면 null */
  disabledReason: string | null;
  onRun: () => void;
  onRetry: () => void;
  panelRef: React.Ref<HTMLDivElement>;
};

const NO_RETRY = new Set(["INVALID_REQUEST", "INVALID_URL", "INPUT_TOO_LONG", "NOT_CONFIGURED", "NOT_FOUND", "PRIVATE_REPOSITORY"]);

const DECISION_LABEL = { confirmed: "확정", suggestion: "제안", undecided: "미확정" } as const;

function RequirementCard({ q, v }: { q: Requirement; v: ComparisonStateSuccess["verdicts"][number] }) {
  const suggestion = q.decisionType === "suggestion";
  return (
    <li
      className={`space-y-3 px-4 py-4 ${suggestion ? "border-l-2 border-dashed border-line-strong" : ""}`}
      aria-label={`${q.id} ${q.text}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">{q.id}</span>
        <StatusBadge status={v.status} />
        {q.decisionType && q.decisionType !== "confirmed" && (
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">
            {DECISION_LABEL[q.decisionType]}
            {suggestion ? " · 미준수로 판정하지 않음" : " · 구현 여부 판정 안 함"}
          </span>
        )}
        {q.changeType === "removed" && <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">삭제 요구</span>}
      </div>
      <h3 className="text-sm font-semibold">{q.text}</h3>
      <p className="text-sm text-muted">{v.reason}</p>

      {v.policyNote && (
        <p className="flex items-start gap-2 text-sm text-warn">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          서버 검증: {v.policyNote}
        </p>
      )}

      {v.evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-faint">코드 근거 · 서버가 GitHub 원본과 대조해 확인함</p>
          {v.evidence.map((e) => (
            <div key={`${e.path}:${e.startLine}-${e.endLine}`} className="space-y-1">
              <CodePanel path={e.path} startLine={e.startLine} endLine={e.endLine} snippet={e.snippet} />
              {e.adjusted && <p className="text-xs text-faint">AI가 제시한 줄 번호가 어긋나 서버가 인용 코드의 실제 위치에 맞게 보정했습니다.</p>}
            </div>
          ))}
        </div>
      )}
      {v.evidenceRejected > 0 && (
        <p className="text-xs text-faint">AI가 제시한 근거 {v.evidenceRejected}건은 실제 코드와 일치하지 않아 사용하지 않았습니다.</p>
      )}

      {v.missingConditions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted">확인하지 못한 조건</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
            {v.missingConditions.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {v.recommendation && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm">
          <span className="font-semibold text-accent-text">권고 </span>
          {v.recommendation}
        </p>
      )}
      {v.consideredFiles.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-xs text-faint">AI가 검토한 파일 {v.consideredFiles.length}개</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {(v.selectionNotes.length ? v.selectionNotes : v.consideredFiles).map((n) => (
              <li key={n} className="break-all">
                {n}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

type ComparisonStateSuccess = Extract<ComparisonState, { status: "success" }>["data"];

// 코드 비교 영역. 값은 모두 서버 응답에서 오며, 정적 분석 결과이므로 코드를 실행했다고 표시하지 않는다.
export function ComparisonResult({ state, canRun, disabledReason, onRun, onRetry, panelRef }: Props) {
  const data = state.status === "success" ? state.data : null;
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="compare-title"
      aria-live="polite"
      className="mt-2 rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="compare-title" className="text-sm font-semibold">
          코드 비교
        </h2>
        {data && (
          <p className="text-xs tabular-nums text-faint">
            {data.model} · 모델 호출 {data.usage.modelCalls}회 · {data.usage.totalTokens.toLocaleString("ko-KR")}토큰 ·{" "}
            {(data.usage.durationMs / 1000).toFixed(1)}초 · 커밋 {data.repository.commitSha.slice(0, 7)}
          </p>
        )}
      </div>

      {(state.status === "idle" || state.status === "loading") && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted">
            추출한 요구사항을 GitHub 저장소의 실제 코드와 비교합니다. 서버가 같은 커밋의 코드를 다시 받아 확인하며, 코드를 실행하지 않는
            정적 분석입니다.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onRun} disabled={!canRun || state.status === "loading"} className={`${btnPrimary} disabled:opacity-60`}>
              {state.status === "loading" ? "비교 중…" : "코드 비교 실행"}
            </button>
            {state.status === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <span className="block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                GitHub 코드를 수집하고 AI가 비교하는 중입니다. 최대 2분 정도 걸릴 수 있습니다.
              </p>
            ) : (
              disabledReason && <p className="text-sm text-faint">{disabledReason}</p>
            )}
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="space-y-3 px-4 py-4">
          <p className="flex items-start gap-2 text-sm text-bad">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              {state.error.message}
              {state.error.retryAfterSec ? ` (약 ${state.error.retryAfterSec}초 후 가능)` : ""}
            </span>
          </p>
          {!NO_RETRY.has(state.error.code) && (
            <button type="button" onClick={onRetry} className={btnSecondary}>
              다시 시도
            </button>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-sm">
            {STATUSES.map((s) => (
              <span key={s} className="tabular-nums text-muted">
                {STATUS_META[s].label} <strong className="font-semibold text-fg">{data.summary[s]}</strong>
              </span>
            ))}
            <span className="text-faint">전체 {data.summary.total}건</span>
            {state.status === "success" && state.saved ? (
              <Link href="/report" className={`${btnPrimary} ml-auto h-8 px-3`}>
                전체 리포트 보기
              </Link>
            ) : (
              <span className="ml-auto text-faint">이 브라우저에서 결과를 보관하지 못해 리포트 화면에서는 열 수 없습니다.</span>
            )}
          </div>

          {!data.coverage.complete && (
            <div className="flex items-start gap-2 border-b border-line bg-warn-soft px-4 py-3 text-sm text-warn">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  분석 범위가 불완전합니다: 분석 가능한 파일 {data.coverage.candidates}개 중 {data.coverage.collected}개만 수집했습니다.
                </p>
                <p className="mt-0.5">
                  수집하지 못한 파일에 구현이 있을 수 있어, 근거가 없다는 이유만으로 구현되지 않았다고 판단하지 않았습니다.
                </p>
                {data.coverage.warnings.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {data.coverage.warnings.map((w) => (
                      <li key={w.code + w.message}>{w.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <details className="border-b border-line px-4 py-3 text-sm text-muted">
            <summary className="cursor-pointer text-xs text-faint">파일 선택 기준</summary>
            <p className="mt-1.5">{data.selection.explanation}</p>
          </details>

          <ol className="divide-y divide-line">
            {data.report.requirements.map((q, i) => (
              <RequirementCard key={q.id} q={q} v={data.verdicts[i]} />
            ))}
          </ol>

          <p className="border-t border-line px-4 py-3 text-sm text-faint">
            정적 코드 분석 결과이며 코드를 실행하거나 테스트하지 않았습니다.{" "}
            {state.status === "success" && state.saved
              ? "같은 결과를 ‘전체 리포트 보기’에서 열 수 있습니다. 결과는 이 브라우저 탭에만 임시 보관됩니다."
              : "결과를 이 브라우저에 보관하지 못했습니다."}
          </p>
        </>
      )}
    </section>
  );
}

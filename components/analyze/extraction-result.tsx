import { btnSecondary } from "@/components/button-styles";
import { InfoIcon } from "@/components/icons";
import type { ExtractionState } from "@/components/analyze/use-extraction";
import type { ChangeType, DecisionType } from "@/lib/extract/types";

const DECISION: Record<DecisionType, { label: string; tone: string }> = {
  confirmed: { label: "확정", tone: "bg-accent-soft text-accent-text" },
  suggestion: { label: "요청·제안", tone: "bg-sunken text-muted" },
  undecided: { label: "미확정", tone: "bg-warn-soft text-warn" },
};

const CHANGE: Record<ChangeType, string> = {
  new: "신규",
  changed: "변경",
  removed: "삭제",
  unspecified: "변경 여부 미지정",
};

type Props = {
  state: ExtractionState;
  onRetry: () => void;
  panelRef: React.Ref<HTMLDivElement>;
};

const NO_RETRY = new Set(["INVALID_REQUEST", "INPUT_TOO_LONG", "NOT_CONFIGURED"]);

// 요구사항 추출 결과. 값은 모두 서버 응답에서 오며, 구현 여부는 아직 판정하지 않는다.
export function ExtractionResult({ state, onRetry, panelRef }: Props) {
  if (state.status === "idle") return null;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-labelledby="extract-title"
      aria-live="polite"
      className="mt-2 rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="extract-title" className="text-sm font-semibold">
          {state.status === "success" ? `추출된 요구사항 ${state.data.count}건` : "요구사항 추출"}
        </h2>
        {state.status === "success" && (
          <p className="text-xs tabular-nums text-faint">
            {state.data.model} · {(state.data.usage.durationMs / 1000).toFixed(1)}초 ·{" "}
            {state.data.usage.totalTokens.toLocaleString("ko-KR")}토큰
          </p>
        )}
      </div>

      {state.status === "loading" && (
        <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted">
          <span className="block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          AI가 문서에서 요구사항을 추출하는 중입니다. 최대 1분 정도 걸릴 수 있습니다.
        </p>
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

      {state.status === "success" && (
        <>
          {state.data.count === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">문서에서 추출할 수 있는 구현 요구사항이 없습니다.</p>
          ) : (
            <ol className="divide-y divide-line">
              {state.data.requirements.map((r) => (
                <li key={r.id} className="space-y-2 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-faint">{r.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DECISION[r.decisionType].tone}`}>
                      {DECISION[r.decisionType].label}
                    </span>
                    <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">
                      {CHANGE[r.changeType]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold">{r.title}</h3>
                  <p className="text-sm text-muted">{r.description}</p>
                  {r.ambiguity && (
                    <p className="flex items-start gap-2 text-sm text-warn">
                      <InfoIcon className="mt-0.5 size-4 shrink-0" />
                      불확실: {r.ambiguity}
                    </p>
                  )}
                  <blockquote className="border-l-2 border-accent pl-3 text-sm">
                    <span className="block text-xs text-faint">원문 근거 · 입력 문서와 일치 확인됨</span>
                    {r.sourceQuote}
                  </blockquote>
                </li>
              ))}
            </ol>
          )}
          <p className="border-t border-line px-4 py-3 text-sm text-faint">
            구현 여부는 아직 판정하지 않았습니다. GitHub 코드와의 비교와 리포트 생성은 다음 단계에서 연결됩니다.
          </p>
        </>
      )}
    </section>
  );
}

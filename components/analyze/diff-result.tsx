import { btnSecondary } from "@/components/button-styles";
import { ChangeBadge } from "@/components/change-badge";
import { InfoIcon } from "@/components/icons";
import type { DiffState } from "@/components/analyze/use-diff";
import { CHANGE_KINDS, CHANGE_LABEL, type ChangeSide } from "@/lib/diff/types";

type Props = {
  state: DiffState;
  onRetry: () => void;
  panelRef: React.Ref<HTMLDivElement>;
};

const NO_RETRY = new Set(["INVALID_REQUEST", "INPUT_TOO_LONG", "NOT_CONFIGURED"]);

function Quote({ label, side }: { label: string; side: ChangeSide | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-faint">{label}</p>
      {side ? (
        <blockquote className="mt-1 border-l-2 border-accent pl-3 text-sm">
          <span className="block font-medium">{side.title}</span>
          {side.quote}
        </blockquote>
      ) : (
        <p className="mt-1 text-sm text-faint">해당 회의록에 없음</p>
      )}
    </div>
  );
}

// 회의 변경 비교 결과. 값은 모두 서버 응답이며, 구현 여부는 아직 판정하지 않았다.
export function DiffResult({ state, onRetry, panelRef }: Props) {
  if (state.status === "idle") return null;

  return (
    <section ref={panelRef} tabIndex={-1} aria-labelledby="diff-title" aria-live="polite" className="mt-2 rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="diff-title" className="text-sm font-semibold">
          {state.status === "success" ? `회의 변경사항 ${state.data.items.length}건` : "회의 변경 비교"}
        </h2>
        {state.status === "success" && (
          <p className="text-xs tabular-nums text-faint">
            {state.data.model} · {(state.data.usage.durationMs / 1000).toFixed(1)}초 · {state.data.usage.totalTokens.toLocaleString("ko-KR")}토큰
          </p>
        )}
      </div>

      {state.status === "loading" && (
        <p className="flex items-center gap-2 px-4 py-5 text-sm text-muted">
          <span className="block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          AI가 두 회의록을 비교하는 중입니다. 최대 1~2분 정도 걸릴 수 있습니다.
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
          <ul className="flex flex-wrap gap-2 border-b border-line px-4 py-3" aria-label="변경 유형별 개수">
            {CHANGE_KINDS.map((k) => (
              <li key={k} className="text-xs text-muted">
                {CHANGE_LABEL[k]} <span className="font-semibold tabular-nums text-fg">{state.data.counts[k]}</span>
              </li>
            ))}
          </ul>
          <ol className="divide-y divide-line">
            {state.data.items.map((it) => (
              <li key={it.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-faint">{it.id}</span>
                  <ChangeBadge kind={it.kind} />
                  {it.needsReview && <span className="rounded-md bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">추가 확인 필요</span>}
                </div>
                <p className="text-sm font-medium">{it.summary}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Quote label="이전 회의록 · 원문 일치 확인됨" side={it.previous} />
                  <Quote label="최신 회의록 · 원문 일치 확인됨" side={it.latest} />
                </div>
                {it.reviewReason && (
                  <p className="flex items-start gap-2 text-sm text-warn">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    확인할 점: {it.reviewReason}
                  </p>
                )}
                {it.serverNote && (
                  <p className="flex items-start gap-2 text-sm text-muted">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    서버 검증: {it.serverNote}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-4 py-3 text-sm text-faint">
            이 단계에서는 코드 구현 여부를 판정하지 않았습니다. 아래 ‘코드 비교’가 최신 회의록 기준 요구사항을 GitHub 코드와 비교합니다. 최신 회의록에 언급이 없다는 이유만으로 삭제로 확정하지 않습니다.
          </p>
        </>
      )}
    </section>
  );
}

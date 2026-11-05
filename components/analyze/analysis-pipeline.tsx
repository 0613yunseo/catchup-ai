import { CheckIcon, InfoIcon, XCircleIcon } from "@/components/icons";
import { STAGES, type RunStatus, type StageId, type StageResult, type StageState } from "@/lib/analysis";

type Props = {
  status: RunStatus;
  /** 단계별 상태. API 연결 후 서버 응답으로 채운다. */
  stages?: Partial<Record<StageId, StageResult>>;
};

const STATE_LABEL: Record<StageState, string> = {
  pending: "대기",
  running: "진행 중",
  done: "완료",
  error: "오류",
};

function Marker({ state }: { state: StageState }) {
  if (state === "done")
    return (
      <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
        <CheckIcon className="size-3" />
      </span>
    );
  if (state === "error") return <XCircleIcon className="size-5 text-bad" />;
  if (state === "running")
    return <span className="block size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />;
  return <span className="block size-5 rounded-full border-2 border-line-strong" />;
}

// 분석 진행 상태. 값은 props로만 받으며 내부에 타이머나 가짜 진행률이 없다.
export function AnalysisPipeline({ status, stages = {} }: Props) {
  const unavailable = status === "unavailable";
  return (
    <section aria-labelledby="pipeline-title" className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 id="pipeline-title" className="text-sm font-semibold">
          분석 진행 상태
        </h2>
      </div>
      {unavailable && (
        <p
          role="status"
          className="flex items-start gap-2 border-b border-line bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          분석 API가 아직 연결되지 않아 실행할 수 없습니다.
        </p>
      )}
      <ol className="px-4 py-3">
        {STAGES.map((s, i) => {
          const result = unavailable ? undefined : stages[s.id];
          const state: StageState = result?.state ?? "pending";
          const last = i === STAGES.length - 1;
          return (
            <li key={s.id} className={`relative flex gap-3 ${last ? "" : "pb-4"}`}>
              {!last && (
                <span aria-hidden="true" className="absolute left-[9.5px] top-6 bottom-0 w-px bg-line" />
              )}
              <span className={`flex shrink-0 ${unavailable ? "opacity-60" : ""}`}>
                <Marker state={state} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-sm font-medium ${unavailable ? "text-muted" : ""}`}>{s.label}</p>
                  <p className="shrink-0 text-xs text-faint">
                    {unavailable ? "준비 중" : STATE_LABEL[state]}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-faint">{s.description}</p>
                {result?.error && <p className="mt-1 text-sm text-bad">{result.error}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

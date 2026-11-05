import { CheckIcon } from "@/components/icons";

type Props = {
  step: number;
  title: string;
  state: "done" | "current" | "todo";
  last?: boolean;
  children: React.ReactNode;
};

// 입력 단계 한 칸. 완료 여부는 입력값 검증 결과에서만 계산된다.
export function StepSection({ step, title, state, last, children }: Props) {
  return (
    <section aria-labelledby={`step-${step}`} className="relative flex gap-4 sm:gap-5">
      {!last && <span aria-hidden="true" className="absolute left-[13px] top-8 bottom-0 w-px bg-line" />}
      <div
        aria-hidden="true"
        className={`z-10 grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium tabular-nums ${
          state === "done"
            ? "bg-accent text-accent-fg"
            : state === "current"
              ? "border-2 border-accent bg-canvas text-accent-text"
              : "border border-line-strong bg-canvas text-faint"
        }`}
      >
        {state === "done" ? <CheckIcon className="size-3.5" /> : step}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-9"}`}>
        <h2 id={`step-${step}`} className="flex h-7 items-center text-base font-semibold">
          {title}
          <span className="sr-only">
            {state === "done" ? " (입력 완료)" : state === "current" ? " (입력 중)" : " (대기)"}
          </span>
        </h2>
        <div className="mt-4 space-y-5">{children}</div>
      </div>
    </section>
  );
}

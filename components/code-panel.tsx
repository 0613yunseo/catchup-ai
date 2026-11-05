import { FileCodeIcon } from "@/components/icons";

type Props = {
  path: string;
  startLine: number;
  endLine: number;
  snippet?: string;
  /** 강조할 줄 번호 범위 (예시 화면용) */
  highlight?: [number, number];
};

// 파일 경로, 라인 범위, 번호가 붙은 코드 조각을 보여주는 패널.
export function CodePanel({ path, startLine, endLine, snippet, highlight }: Props) {
  const lines = snippet?.replace(/\n$/, "").split("\n");
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-code">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 font-mono text-[13px]">
          <FileCodeIcon className="size-4 shrink-0 text-faint" />
          <span className="truncate" title={path}>
            {path}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          L{startLine}
          {endLine !== startLine && `–${endLine}`}
        </span>
      </figcaption>
      {lines ? (
        <pre tabIndex={0} className="overflow-x-auto py-2 font-mono text-[13px] leading-6">
          {lines.map((text, i) => {
            const no = startLine + i;
            const on = highlight && no >= highlight[0] && no <= highlight[1];
            return (
              <div key={no} className={`flex ${on ? "bg-accent-soft" : ""}`}>
                <span className="w-12 shrink-0 select-none pr-3 text-right tabular-nums text-faint">
                  {no}
                </span>
                <code className="whitespace-pre pr-4">{text || " "}</code>
              </div>
            );
          })}
        </pre>
      ) : (
        <p className="px-3 py-4 text-sm text-faint">이 근거에는 코드 스니펫이 없습니다.</p>
      )}
    </figure>
  );
}

// 분석 결과가 없을 때: 같은 틀을 비워서 보여준다.
export function CodePanelEmpty() {
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-line-strong">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-line-strong px-3 py-2 text-[13px] text-faint">
        <span className="flex items-center gap-2 font-mono">
          <FileCodeIcon className="size-4" />
          파일 경로
          <span aria-hidden="true">—</span>
        </span>
        <span className="font-mono text-xs">
          L<span aria-hidden="true">—</span>
        </span>
      </div>
      <p className="px-4 py-10 text-center text-sm text-muted">
        분석 결과가 생기면 근거가 된 파일 경로, 시작·끝 라인, 코드 스니펫이 여기에 표시됩니다.
      </p>
    </div>
  );
}

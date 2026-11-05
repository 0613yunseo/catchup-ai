import { StatusBadge } from "@/components/status-badge";
import type { Requirement } from "@/lib/report";
import { INPUT_TYPES } from "@/lib/validate";

export function RequirementCard({ req }: { req: Requirement }) {
  const source = INPUT_TYPES.find((t) => t.value === req.source)?.label;
  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-faint">
          <span className="font-mono">{req.id}</span> · {source}
        </p>
        <StatusBadge status={req.status} />
      </header>
      <h3 className="mt-3 font-medium">{req.text}</h3>
      <p className="mt-2 text-sm text-muted">{req.reason}</p>

      <section className="mt-4 border-t border-line pt-4" aria-label="코드 근거">
        <h4 className="text-sm font-semibold">코드 근거</h4>
        {req.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-faint">연결된 코드 근거가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {req.evidence.map((e) => (
              <li key={`${e.path}:${e.startLine}`}>
                <p className="break-all font-mono text-sm">
                  {e.path}
                  <span className="text-faint">
                    :L{e.startLine}
                    {e.endLine !== e.startLine && `–${e.endLine}`}
                  </span>
                </p>
                {e.note && <p className="mt-1 text-sm text-muted">{e.note}</p>}
                {e.snippet && (
                  <pre
                    tabIndex={0}
                    className="mt-2 overflow-x-auto rounded-md bg-sunken p-3 font-mono text-xs leading-relaxed"
                  >
                    {e.snippet}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {req.recommendation && (
        <p className="mt-4 border-t border-line pt-4 text-sm">
          <span className="font-semibold">권고 </span>
          {req.recommendation}
        </p>
      )}
    </article>
  );
}

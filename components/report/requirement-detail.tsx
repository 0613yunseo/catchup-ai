import { CodePanel } from "@/components/code-panel";
import { InfoIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import type { Requirement } from "@/lib/report";
import { sourceLabel } from "@/lib/source-label";

type Props = {
  req: Requirement;
  evidenceIdx: number;
  onEvidence: (idx: number) => void;
};

const DECISION = { confirmed: "확정", suggestion: "제안", undecided: "미확정" } as const;

// 요구사항 한 건의 상세. 파일별 상세 보기나 이전 결과 비교 같은 확장은 이 안에 섹션으로 추가한다.
export function RequirementDetail({ req, evidenceIdx, onEvidence }: Props) {
  const ev = req.evidence[evidenceIdx];
  const missing = req.missingConditions ?? [];
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm text-faint">
            <span>
              {req.id} · {sourceLabel(req.source)}
            </span>
            {req.decisionType && req.decisionType !== "confirmed" && (
              <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">
                {DECISION[req.decisionType]}
                {req.decisionType === "suggestion" ? " · 미준수로 판정하지 않음" : " · 구현 여부 판정 안 함"}
              </span>
            )}
            {req.changeType === "removed" && <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">삭제 요구</span>}
          </p>
          <StatusBadge status={req.status} />
        </div>
        <h2 className="mt-2 text-xl font-semibold leading-snug">{req.text}</h2>
        {req.description && <p className="mt-2 text-sm text-muted">{req.description}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">판정 이유</h3>
          <p className="mt-1.5 text-sm text-muted">{req.reason}</p>
          {req.policyNote && (
            <p className="mt-2 flex items-start gap-2 text-sm text-warn">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              서버 검증: {req.policyNote}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">원문 근거</h3>
          <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-sm text-muted">
            <span className="block text-xs text-faint">{sourceLabel(req.source)}</span>
            {req.sourceQuote ?? req.text}
          </blockquote>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">코드 근거</h3>
        {!ev ? (
          <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-faint">
            확인된 코드 근거가 없습니다.
            {req.coverageLimited && " 수집하지 못했거나 AI에게 보여 주지 못한 파일에 구현이 있을 수 있습니다."}
          </p>
        ) : (
          <div className="space-y-2">
            {req.evidence.length > 1 && (
              <div role="tablist" aria-label="근거 파일" className="flex flex-wrap gap-1">
                {req.evidence.map((e, i) => (
                  <button
                    key={`${e.path}:${e.startLine}`}
                    role="tab"
                    type="button"
                    aria-selected={i === evidenceIdx}
                    onClick={() => onEvidence(i)}
                    className={`max-w-full truncate rounded-md px-2.5 py-1 font-mono text-xs ${
                      i === evidenceIdx ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-sunken"
                    }`}
                  >
                    {e.path.split("/").pop()}
                  </button>
                ))}
              </div>
            )}
            <CodePanel path={ev.path} startLine={ev.startLine} endLine={ev.endLine} snippet={ev.snippet} />
            {req.decidedBy !== undefined && <p className="text-xs text-faint">서버가 GitHub 원본의 같은 줄과 대조해 확인한 코드입니다.</p>}
            {ev.note && <p className="text-sm text-muted">{ev.note}</p>}
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">확인하지 못한 조건</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {req.recommendation && (
        <div className="rounded-lg bg-accent-soft p-4 text-sm">
          <h3 className="font-semibold text-accent-text">개선 권고</h3>
          <p className="mt-1">{req.recommendation}</p>
        </div>
      )}

      {req.consideredFiles && req.consideredFiles.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer text-xs text-faint">AI가 검토한 파일 {req.consideredFiles.length}개</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {req.consideredFiles.map((f) => (
              <li key={f} className="break-all">
                {f}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

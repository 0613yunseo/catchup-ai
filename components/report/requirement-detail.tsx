import { CodePanel } from "@/components/code-panel";
import { StatusBadge } from "@/components/status-badge";
import type { Requirement } from "@/lib/report";
import { sourceLabel } from "@/lib/source-label";

type Props = {
  req: Requirement;
  evidenceIdx: number;
  onEvidence: (idx: number) => void;
};

// 요구사항 한 건의 상세. 파일별 상세 보기나 이전 결과 비교 같은 확장은 이 안에 섹션으로 추가한다.
export function RequirementDetail({ req, evidenceIdx, onEvidence }: Props) {
  const ev = req.evidence[evidenceIdx];
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-faint">
            {req.id} · {sourceLabel(req.source)}
          </p>
          <StatusBadge status={req.status} />
        </div>
        <h2 className="mt-2 text-xl font-semibold leading-snug">{req.text}</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">판정 이유</h3>
          <p className="mt-1.5 text-sm text-muted">{req.reason}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">근거 문서</h3>
          <blockquote className="mt-1.5 border-l-2 border-accent pl-3 text-sm text-muted">
            <span className="text-faint">{sourceLabel(req.source)} · </span>
            {req.text}
          </blockquote>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">코드 근거</h3>
        {!ev ? (
          <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-faint">
            연결된 코드 근거가 없습니다.
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
            <CodePanel {...ev} />
            {ev.note && <p className="text-sm text-muted">{ev.note}</p>}
          </div>
        )}
      </div>

      {req.recommendation && (
        <div className="rounded-lg bg-accent-soft p-4 text-sm">
          <h3 className="font-semibold text-accent-text">개선 권고</h3>
          <p className="mt-1">{req.recommendation}</p>
        </div>
      )}
    </div>
  );
}

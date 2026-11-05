import { GitBranchIcon } from "@/components/icons";
import { parseGithubRepo } from "@/lib/validate";

// 입력한 URL을 형식만 해석해 보여준다. GitHub에는 조회하지 않는다.
export function GithubPanel({ repoUrl }: { repoUrl: string }) {
  const repo = parseGithubRepo(repoUrl);
  const rows = [
    ["소유자", repo?.owner],
    ["저장소", repo?.repo],
    ["기본 브랜치", undefined],
    ["공개 여부", undefined],
  ] as const;
  return (
    <section aria-labelledby="gh-title" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <GitBranchIcon className="size-4 text-muted" />
        <h2 id="gh-title" className="text-sm font-semibold">
          GitHub 저장소
        </h2>
      </div>
      <dl className="divide-y divide-line px-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 truncate font-mono">
              {v ?? <span className="font-sans text-faint">—</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm text-faint">
        <span aria-hidden="true" className="size-2 rounded-full bg-line-strong" />
        {repo ? "주소 형식 확인됨 · GitHub 조회 전" : "저장소 주소를 입력하세요"}
      </p>
    </section>
  );
}

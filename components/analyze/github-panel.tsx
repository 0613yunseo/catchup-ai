import { GitBranchIcon, InfoIcon } from "@/components/icons";
import { btnSecondary } from "@/components/button-styles";
import type { InspectState } from "@/components/analyze/use-repo-inspection";
import { parseGithubRepo } from "@/lib/validate";

type Props = {
  repoUrl: string;
  state: InspectState;
  onRetry: () => void;
};

const dash = <span className="font-sans text-faint">—</span>;

// GitHub 저장소 정보 패널. 값은 모두 조회 결과에서 오며, 조회 전에는 —로 둔다.
export function GithubPanel({ repoUrl, state, onRetry }: Props) {
  const parsed = parseGithubRepo(repoUrl);
  const data = state.status === "success" ? state.data : null;
  const repo = data?.repository;
  const s = data?.summary;

  const rows: [string, React.ReactNode][] = [
    ["저장소", repo?.name ?? (parsed ? `${parsed.owner}/${parsed.repo}` : null)],
    ["기본 브랜치", repo?.defaultBranch],
    [
      "최신 커밋",
      repo ? (
        <a
          href={`${repo.htmlUrl}/commit/${repo.commitSha}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-text underline-offset-2 hover:underline"
        >
          {repo.commitSha.slice(0, 7)}
        </a>
      ) : null,
    ],
    ["공개 여부", repo ? "공개" : null],
    ["분석 가능한 파일", s ? `${s.candidates.toLocaleString("ko-KR")}개` : null],
    ["수집한 파일", s ? `${s.collected.toLocaleString("ko-KR")}개` : null],
  ];

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
            <dd className="min-w-0 truncate font-mono">{v ?? dash}</dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite" className="border-t border-line px-4 py-3 text-sm">
        {state.status === "idle" && (
          <p className="flex items-center gap-2 text-faint">
            <span aria-hidden="true" className="size-2 rounded-full bg-line-strong" />
            {parsed ? "‘저장소 확인’을 눌러 GitHub에서 조회하세요" : "저장소 주소를 입력하세요"}
          </p>
        )}
        {state.status === "loading" && (
          <p className="flex items-center gap-2 text-muted">
            <span className="block size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            GitHub에서 저장소와 코드를 조회하는 중…
          </p>
        )}
        {state.status === "success" && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-ok">
              <span aria-hidden="true" className="size-2 rounded-full bg-ok" />
              조회 완료 · {repo!.commitSha.slice(0, 7)} 커밋 기준
            </p>
            {repo!.description && <p className="text-muted">{repo!.description}</p>}
            <p className="text-faint">
              전체 {s!.totalFiles.toLocaleString("ko-KR")}개 파일 중 형식·보안 규칙으로 {s!.excluded.toLocaleString("ko-KR")}개 제외
              {s!.limited > 0 && `, 제한으로 ${s!.limited.toLocaleString("ko-KR")}개 미수집`}
            </p>
            {data!.warnings.length > 0 && (
              <ul className="space-y-1.5 rounded-md bg-warn-soft p-3 text-warn">
                {data!.warnings.map((w) => (
                  <li key={w.code} className="flex items-start gap-2">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {state.status === "error" && (
          <div role="alert" className="space-y-3">
            <p className="flex items-start gap-2 text-bad">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              {state.error.message}
            </p>
            {state.error.code !== "INVALID_URL" && (
              <button type="button" onClick={onRetry} className={btnSecondary}>
                다시 시도
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

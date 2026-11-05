import Link from "next/link";
import { InfoIcon } from "@/components/icons";
import { btnSecondary } from "@/components/button-styles";
import { INPUT_TYPES, parseGithubRepo, type FormValues } from "@/lib/validate";

type Props = {
  values: FormValues;
  onEdit: () => void;
  ref: React.Ref<HTMLDivElement>;
};

// 분석 API가 없으므로 실행되지 않았음을 명확히 알린다.
export function PendingNotice({ values, onEdit, ref }: Props) {
  const repo = parseGithubRepo(values.repoUrl);
  const typeLabel = INPUT_TYPES.find((t) => t.value === values.type)?.label;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="rounded-lg border border-warn/40 bg-warn-soft p-5 text-warn"
    >
      <div className="flex items-start gap-3">
        <InfoIcon className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-3">
          <h2 className="font-semibold">분석 엔진이 아직 준비되지 않았습니다</h2>
          <p className="text-sm">
            입력값은 검증을 통과했지만 분석은 실행되지 않았습니다. 입력 내용은 서버로
            전송되거나 저장되지 않았고, 페이지를 새로고침하면 사라집니다.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="opacity-80">프로젝트</dt>
            <dd className="break-all">{values.name.trim()}</dd>
            <dt className="opacity-80">입력 유형</dt>
            <dd>{typeLabel}</dd>
            <dt className="opacity-80">저장소</dt>
            <dd className="break-all font-mono">
              {repo ? `${repo.owner}/${repo.repo}` : values.repoUrl}
            </dd>
            <dt className="opacity-80">내용 길이</dt>
            <dd>{values.text.trim().length.toLocaleString("ko-KR")}자</dd>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onEdit} className={btnSecondary}>
              입력 수정
            </button>
            <Link href="/report" className={btnSecondary}>
              리포트 화면 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

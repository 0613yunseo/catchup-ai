import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { StatusBadge } from "@/components/status-badge";
import { STATUSES, STATUS_META } from "@/lib/status";

const STEPS = [
  {
    title: "입력",
    body: "회의록, 교수 피드백, 요구사항 텍스트와 공개 GitHub 저장소 주소를 입력합니다.",
  },
  {
    title: "비교",
    body: "문서에서 요구사항을 항목으로 나누고, 저장소의 코드와 하나씩 대조합니다.",
  },
  {
    title: "근거",
    body: "항목마다 구현 상태와 판단 이유, 근거가 된 파일 경로와 코드 라인을 보여줍니다.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <p className="inline-flex items-center rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
          프리뷰 · 분석 엔진 준비 중
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-[1.15]">
          회의에서 정한 것,
          <br />
          코드에 실제로 있나요?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          회의록과 교수 피드백은 쌓이는데, 어디까지 구현했는지는 기억에 의존하게 됩니다.
          CatchUp AI는 그 문서들을 공개 GitHub 저장소의 코드와 비교해 회의록과 코드 사이의
          간극을 항목별로 짚어 줍니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/analyze" className={btnPrimary}>
            분석 시작
            <ArrowRightIcon />
          </Link>
          <Link href="/report" className={btnSecondary}>
            리포트 화면 보기
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="how"
        className="border-y border-line bg-surface"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="how" className="text-sm font-semibold text-muted">
            작동 방식
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
            {STEPS.map((s, i) => (
              <li key={s.title} className="md:px-6 md:first:pl-0 md:last:pr-0">
                <p className="font-mono text-sm text-accent">0{i + 1}</p>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-faint">
            현재 구현된 것은 입력 화면과 검증, 리포트 화면의 구조입니다. 비교와 근거 생성은 아직
            연결되지 않았습니다.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="status"
        className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <h2 id="status" className="text-2xl font-semibold tracking-tight">
              네 가지 상태로 구분합니다
            </h2>
            <p className="mt-3 text-muted">
              모호한 “대충 됨”을 없애고, 요구사항마다 하나의 상태와 그 근거를 붙입니다.
            </p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {STATUSES.map((s) => (
              <li
                key={s}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="sm:w-48 sm:shrink-0">
                  <StatusBadge status={s} />
                </div>
                <p className="text-sm text-muted">{STATUS_META[s].description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

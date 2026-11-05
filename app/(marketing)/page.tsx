import Link from "next/link";
import { ArrowRightIcon, CheckIcon, MinusCircleIcon } from "@/components/icons";
import { btnOnAccent, btnPrimary, btnSecondary } from "@/components/button-styles";
import { ProductPreview } from "@/components/marketing/product-preview";
import { STATUSES, STATUS_META } from "@/lib/status";

const FLOW = [
  { title: "회의록", body: "회의록, 교수 피드백, 요구사항 문서" },
  { title: "요구사항", body: "문서에서 항목 단위로 추출" },
  { title: "GitHub 코드", body: "공개 저장소의 실제 구현" },
  { title: "결과 리포트", body: "항목별 판정과 코드 근거" },
];

const SCOPE = [
  { label: "입력 화면과 검증", done: true },
  { label: "리포트 화면 구조", done: true },
  { label: "문서에서 요구사항 추출", done: false },
  { label: "GitHub 저장소 조회와 코드 비교", done: false },
];

const TONE: Record<(typeof STATUSES)[number], string> = {
  VERIFIED: "bg-ok-soft text-ok",
  PARTIAL: "bg-warn-soft text-warn",
  MISMATCH: "bg-bad-soft text-bad",
  UNKNOWN: "bg-unk-soft text-unk",
};

export default function Home() {
  return (
    <>
      <section className="relative">
        {/* 제품 프리뷰 뒤의 파란 면 */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-[58%] bg-accent-soft" />
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-24">
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl sm:leading-[1.1]">
            회의에서 정한 것,
            <br />
            코드에 실제로 있나요?
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            회의록과 요구사항을 GitHub 코드와 비교해, 구현 여부를 근거와 함께 확인하세요.
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
          <p className="mt-4 text-sm text-faint">
            현재 UI 프리뷰 단계입니다. 분석 엔진은 아직 연결되지 않았습니다.
          </p>
          <div className="mt-12 pb-14 sm:pb-20">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section aria-labelledby="flow" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 id="flow" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          회의록에서 코드까지, 한 줄로 이어서 봅니다
        </h2>
        <ol className="mt-12 grid gap-8 md:grid-cols-4 md:gap-0">
          {FLOW.map((f, i) => (
            <li key={f.title} className="flex items-start md:pr-6">
              <div>
                <p className="text-xl font-semibold">{f.title}</p>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
              {i < FLOW.length - 1 && (
                <ArrowRightIcon className="ml-auto mt-1.5 hidden size-5 shrink-0 text-accent md:block" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="status" className="bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 id="status" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            요구사항마다 네 가지 판정 중 하나를 붙입니다
          </h2>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUSES.map((s) => (
              <li key={s} className={`rounded-xl p-6 ${TONE[s]}`}>
                <p className="text-2xl font-semibold">{STATUS_META[s].label}</p>
                <p className="mt-1 text-sm font-medium opacity-80">{s}</p>
                <p className="mt-6 text-sm text-fg">{STATUS_META[s].description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="start" className="bg-accent text-accent-fg">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2 md:items-center">
          <div>
            <h2 id="start" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              먼저 입력부터 시작해 보세요
            </h2>
            <p className="mt-4 max-w-md opacity-90">
              프로젝트 이름, 문서, 공개 저장소 주소만 있으면 됩니다.
            </p>
            <Link href="/analyze" className={`${btnOnAccent} mt-8`}>
              분석 시작
              <ArrowRightIcon />
            </Link>
          </div>
          <div>
            <h3 className="text-sm font-semibold opacity-90">현재 구현 현황</h3>
            <ul className="mt-3 divide-y divide-current/20">
              {SCOPE.map((s) => (
                <li key={s.label} className="flex items-center gap-3 py-3 text-sm">
                  {s.done ? (
                    <CheckIcon className="size-4 shrink-0" />
                  ) : (
                    <MinusCircleIcon className="size-4 shrink-0 opacity-70" />
                  )}
                  <span className={s.done ? "" : "opacity-80"}>{s.label}</span>
                  <span className="ml-auto text-xs opacity-80">{s.done ? "구현됨" : "준비 중"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

import Image from "next/image";
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
  { label: "AI 요구사항 추출", done: true },
  { label: "GitHub 저장소 조회와 코드 수집", done: true },
  { label: "AI 코드 비교와 근거 검증", done: true },
  { label: "분석 리포트 화면", done: true },
  { label: "문서 파일 업로드 (PDF·DOCX·TXT)", done: true },
  { label: "이전·최신 회의록 변경 비교", done: true },
  { label: "분석 기록 저장", done: false },
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
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12 lg:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-10">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.1]">
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
                공개 GitHub 저장소의 코드를 분석하고, 결과를 근거와 함께 확인할 수 있습니다.
              </p>
            </div>
            {/* 이미지는 텍스트보다 작고 오른쪽에 둔다. 모바일에서는 텍스트·버튼 아래에 놓인다. */}
            <div className="relative isolate mx-auto w-full max-w-xs bg-canvas sm:max-w-sm lg:mr-0 lg:max-w-[25rem] lg:justify-self-end lg:translate-x-5">
              {/* 뒤에서 은은하게 번지는 파란 빛. 래퍼를 isolate + 배경색으로 두어 이미지의 흰 바탕이 다크 모드에서 배경색과 섞이게 한다(mix-blend-multiply). */}
              <div aria-hidden="true" className="absolute inset-0 rounded-full bg-[light-dark(rgb(37_99_235/0.2),rgb(96_165_250/0.55))] blur-3xl" />
              <Image
                src="/gpu-hero.png"
                alt="노트북 화면과 떠 있는 유리 패널로 표현한 회의 내용과 코드 비교 이미지"
                width={512}
                height={512}
                priority
                sizes="(min-width: 1024px) 400px, 320px"
                className="relative h-auto w-full object-contain mix-blend-multiply [mask-image:radial-gradient(closest-side,#000_72%,transparent_100%)] [-webkit-mask-image:radial-gradient(closest-side,#000_72%,transparent_100%)]"
              />
            </div>
          </div>
        </div>

        {/* 예시 리포트. 파란 면은 이 블록에만 깔리고, 위 히어로와는 간격을 둔다. */}
        <div className="relative mt-14 sm:mt-16">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-0 bg-accent-soft" />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-3 sm:px-6 sm:pb-20">
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

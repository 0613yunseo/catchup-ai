import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFormLoader } from "@/components/auth/login-form-loader";

export const metadata: Metadata = { title: "로그인" };

// 로그인 없이도 분석과 리포트 보기는 그대로 쓸 수 있다. 로그인은 분석 기록을 클라우드에 저장하고 다시 볼 때만 필요하다.
export default function LoginPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight">로그인</h1>
      <p className="mt-3 text-muted">분석 기록을 클라우드에 저장하고 다시 보려면 로그인하세요. 로그인하지 않아도 분석은 그대로 사용할 수 있습니다.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-faint">불러오는 중…</p>}>
          <LoginFormLoader />
        </Suspense>
      </div>
    </section>
  );
}

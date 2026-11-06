"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

// 주소의 next(이동할 경로)와 error(링크 인증 실패 사유)를 읽어 로그인 폼에 넘긴다. next는 폼과 서버에서 내부 경로만 허용하도록 다시 검증한다.
export function LoginFormLoader() {
  const params = useSearchParams();
  return <LoginForm next={params.get("next") ?? ""} initialError={params.get("error")} />;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { InfoIcon } from "@/components/icons";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^\d{6,10}$/;
const COOLDOWN_SEC = 60;

const LINK_ERRORS: Record<string, string> = {
  link: "로그인 링크가 만료되었거나 이미 사용되었습니다. 인증 메일을 다시 요청해 주세요. (링크는 요청한 브라우저에서 열어야 합니다.)",
  not_configured: "로그인 기능이 설정되지 않았습니다.",
};

const inputCls =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-faint aria-[invalid=true]:border-bad sm:text-sm";

// 이메일로 받은 링크 또는 인증 코드로 로그인한다. 비밀번호를 쓰지 않는다.
export function LoginForm({ next, initialError }: { next: string; initialError?: string | null }) {
  const router = useRouter();
  const target = safeNextPath(next);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(initialError ? (LINK_ERRORS[initialError] ?? null) : null);
  const [cooldown, setCooldown] = useState(0);
  const [alreadyIn, setAlreadyIn] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  // 이미 로그인되어 있으면 안내한다. (서버가 검증한 사용자 정보를 확인한다)
  useEffect(() => {
    const db = createClient();
    if (!db) return;
    let alive = true;
    void db.auth.getUser().then(({ data }) => {
      if (alive && data.user) setAlreadyIn(data.user.email ?? "계정");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendMail(ev?: FormEvent) {
    ev?.preventDefault();
    const db = createClient();
    if (!db) return setError(LINK_ERRORS.not_configured);
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) return setError("올바른 이메일 주소를 입력해 주세요.");
    setError(null);
    setBusy("send");
    const { error: err } = await db.auth.signInWithOtp({
      email: mail,
      options: { emailRedirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent(target)}`, shouldCreateUser: true },
    });
    setBusy(null);
    if (err) {
      setError(
        err.status === 429 || err.code === "over_email_send_rate_limit"
          ? "인증 메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요."
          : "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }
    setStep("code");
    setCooldown(COOLDOWN_SEC);
  }

  async function verify(ev: FormEvent) {
    ev.preventDefault();
    const db = createClient();
    if (!db) return setError(LINK_ERRORS.not_configured);
    const token = code.trim();
    if (!CODE_RE.test(token)) return setError("메일에 적힌 숫자 코드를 입력해 주세요.");
    setError(null);
    setBusy("verify");
    const { error: err } = await db.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (err) {
      setBusy(null);
      setError("코드가 올바르지 않거나 만료되었습니다. 새 코드를 요청해 주세요.");
      return;
    }
    router.replace(target);
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
        <p className="flex items-start gap-2">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          로그인 기능이 설정되지 않았습니다. 로그인 없이도 분석과 리포트 보기는 그대로 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {alreadyIn && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-text">
          {alreadyIn} 계정으로 로그인되어 있습니다.{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => router.replace(target)}>
            계속하기
          </button>
        </p>
      )}

      {step === "email" ? (
        <form onSubmit={sendMail} noValidate className="space-y-3">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              placeholder="name@example.com"
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={busy !== null} className={`${btnPrimary} w-full disabled:opacity-60`}>
            {busy === "send" ? "보내는 중…" : "인증 메일 받기"}
          </button>
          <p className="text-sm text-faint">비밀번호 없이 이메일로 받은 링크 또는 코드로 로그인합니다. 처음이라면 계정이 자동으로 만들어집니다.</p>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="space-y-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-fg">{email.trim()}</span>로 인증 메일을 보냈습니다. 메일의 <strong>링크</strong>를 누르거나, 메일에 코드가 있으면 아래에 입력하세요.
          </p>
          <div>
            <label htmlFor="login-code" className="mb-1.5 block text-sm font-medium">
              인증 코드 (메일에 있는 경우)
            </label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              maxLength={10}
              className={`${inputCls} font-mono tracking-widest`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy !== null} className={`${btnPrimary} disabled:opacity-60`}>
              {busy === "verify" ? "확인 중…" : "코드로 로그인"}
            </button>
            <button type="button" disabled={busy !== null || cooldown > 0} onClick={() => void sendMail()} className={`${btnSecondary} disabled:opacity-60`}>
              {cooldown > 0 ? `다시 보내기 (${cooldown}초)` : "메일 다시 보내기"}
            </button>
            <button
              type="button"
              className="px-2 text-sm text-muted underline underline-offset-2"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              이메일 변경
            </button>
          </div>
        </form>
      )}

      {error && (
        <p id="login-error" role="alert" className="flex items-start gap-2 text-sm text-bad">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { CheckCircleIcon, InfoIcon } from "@/components/icons";
import { loginUrl } from "@/lib/auth/redirect";
import { clearPending, savePending } from "@/lib/pending-report";
import type { Report } from "@/lib/report";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Phase =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "confirm" }
  | { name: "saving" }
  | { name: "saved"; alreadySaved: boolean }
  | { name: "error"; message: string; relogin?: boolean };

const RESTORE_PATH = "/report?restore=1";

// 리포트를 로그인한 사용자의 클라우드(Supabase)에 저장한다. 저장 전에 무엇이 저장되는지 안내하고 확인을 받는다.
// 로그인하지 않았다면 리포트를 잠시 보관한 뒤 로그인 화면으로 보내며, 인증 후 /report에서 복구해 이어서 저장할 수 있다.
export function SaveToCloud({ report, autoPrompt = false }: { report: Report; autoPrompt?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(autoPrompt ? { name: "confirm" } : { name: "idle" });

  if (!isSupabaseConfigured()) return null;

  function goLogin() {
    // 이메일 링크는 새 탭에서 열릴 수 있으므로 탭을 넘는 임시 보관(30분)을 쓴다. 복구하면 바로 지운다.
    savePending(report);
    router.push(loginUrl(RESTORE_PATH));
  }

  async function start() {
    const db = createClient();
    if (!db) return;
    setPhase({ name: "checking" });
    const { data } = await db.auth.getUser(); // 서버가 검증한 사용자만 로그인으로 본다
    if (!data.user) return goLogin();
    setPhase({ name: "confirm" });
  }

  async function save() {
    setPhase({ name: "saving" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const body = (await res.json()) as { ok?: boolean; alreadySaved?: boolean; code?: string; message?: string };
      if (res.ok && body.ok) {
        clearPending();
        setPhase({ name: "saved", alreadySaved: !!body.alreadySaved });
        return;
      }
      if (res.status === 401) {
        setPhase({ name: "error", message: body.message ?? "로그인이 만료되었습니다. 다시 로그인해 주세요.", relogin: true });
        return;
      }
      setPhase({ name: "error", message: body.message ?? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } catch {
      setPhase({ name: "error", message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요." });
    }
  }

  const p = phase;
  return (
    <section aria-label="클라우드 저장" className="-mt-2 mb-6">
      {(p.name === "idle" || p.name === "checking") && (
        <button type="button" onClick={() => void start()} disabled={p.name === "checking"} className={`${btnSecondary} disabled:opacity-60`}>
          {p.name === "checking" ? "확인 중…" : "클라우드에 저장"}
        </button>
      )}

      {(p.name === "confirm" || p.name === "saving") && (
        <div className="rounded-lg border border-line-strong bg-surface p-4 text-sm">
          <h2 className="font-semibold">이 리포트를 내 계정에 저장할까요?</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>저장되는 것: 분석 리포트(요구사항, 판정, 원문 인용, 코드 근거 파일 경로·줄 번호·코드 스니펫 등)</li>
            <li>저장되지 않는 것: 업로드한 PDF·DOCX·TXT 원본 파일과 입력한 문서 전체</li>
            <li>리포트에는 문서의 일부 문장과 저장소의 코드 일부가 포함될 수 있습니다. 민감한 내용이 없는지 확인하세요.</li>
            <li>저장한 기록은 본인만 볼 수 있고, 분석 기록에서 언제든 삭제할 수 있습니다.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={p.name === "saving"} className={`${btnPrimary} disabled:opacity-60`}>
              {p.name === "saving" ? "저장 중…" : "저장하기"}
            </button>
            <button type="button" onClick={() => setPhase({ name: "idle" })} disabled={p.name === "saving"} className={`${btnSecondary} disabled:opacity-60`}>
              취소
            </button>
          </div>
        </div>
      )}

      {p.name === "saved" && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ok">
          <CheckCircleIcon className="size-4 shrink-0" />
          {p.alreadySaved ? "이미 저장된 리포트입니다." : "클라우드에 저장했습니다."}
          <Link href="/history" className="font-medium underline underline-offset-2">
            분석 기록 보기
          </Link>
        </p>
      )}

      {p.name === "error" && (
        <div role="alert" className="space-y-2">
          <p className="flex items-start gap-2 text-sm text-bad">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {p.message}
          </p>
          <div className="flex flex-wrap gap-2">
            {p.relogin ? (
              <button type="button" onClick={goLogin} className={btnPrimary}>
                다시 로그인
              </button>
            ) : (
              <button type="button" onClick={() => setPhase({ name: "confirm" })} className={btnSecondary}>
                다시 시도
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

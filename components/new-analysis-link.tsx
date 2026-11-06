"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NEW_ANALYSIS_CONFIRM, NEW_ANALYSIS_EVENT, getAnalysisActivity, needsConfirm } from "@/lib/new-analysis";
import { clearReport } from "@/lib/report-store";

// 새 분석으로 가는 링크. 어느 화면에서 눌러도 이전 분석 상태와 저장된 리포트가 새 분석과 섞이지 않게 한다.
// - /analyze 밖: 저장된 리포트를 지우고 /analyze로 이동한다. (분석 화면은 새로 만들어진다)
// - /analyze 안: 이동 없이 분석 화면의 세션을 새로 시작한다. 입력 중이거나 분석 중일 때만 확인한다.
export function NewAnalysisLink({ className, children, current }: { className?: string; children: ReactNode; current?: boolean }) {
  const pathname = usePathname();
  return (
    <Link
      href="/analyze"
      className={className}
      aria-current={current ? "page" : undefined}
      onClick={(e) => {
        // 새 탭으로 열기 등은 브라우저 기본 동작에 맡긴다.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (pathname === "/analyze") {
          e.preventDefault();
          if (needsConfirm(getAnalysisActivity()) && !window.confirm(NEW_ANALYSIS_CONFIRM)) return;
          clearReport();
          window.dispatchEvent(new Event(NEW_ANALYSIS_EVENT));
          window.scrollTo({ top: 0 });
          return;
        }
        clearReport();
      }}
    >
      {children}
    </Link>
  );
}

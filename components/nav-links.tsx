"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewAnalysisLink } from "@/components/new-analysis-link";

export const NAV = [
  { href: "/analyze", label: "새 분석" },
  { href: "/report", label: "분석 리포트" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="flex items-center gap-1">
      {NAV.map(({ href, label }) => {
        const active = pathname === href;
        const cls = `rounded-md px-3 py-1.5 text-sm transition-colors ${
          active ? "bg-accent-soft font-medium text-accent-text" : "text-muted hover:text-fg"
        }`;
        // 새 분석은 어느 화면에서 눌러도 이전 상태 없이 새로 시작한다.
        if (href === "/analyze") return <NewAnalysisLink key={href} className={cls} current={active}>{label}</NewAnalysisLink>;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent-text" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

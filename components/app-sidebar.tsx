"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileTextIcon, PlusIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const ITEMS = [
  { href: "/analyze", label: "새 분석", Icon: PlusIcon },
  { href: "/report", label: "분석 리포트", Icon: FileTextIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const nav = ITEMS.map(({ href, label, Icon }) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          active
            ? "bg-accent-soft font-medium text-accent-text"
            : "text-muted hover:bg-sunken hover:text-fg"
        }`}
      >
        <Icon className="size-4" />
        {label}
      </Link>
    );
  });

  return (
    <>
      {/* 모바일·태블릿: 상단 바 */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line bg-canvas/90 px-4 py-2 backdrop-blur lg:hidden">
        <Logo />
        <ThemeToggle />
        <nav aria-label="주요 메뉴" className="order-last flex w-full items-center gap-1 whitespace-nowrap">
          {nav}
        </nav>
      </header>

      {/* 데스크톱: 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-canvas px-3 py-4 lg:flex">
        <div className="px-2.5 pb-5">
          <Logo />
        </div>
        <nav aria-label="주요 메뉴" className="flex flex-col gap-0.5">
          {nav}
        </nav>
        <div className="mt-auto space-y-3 px-2.5">
          <p className="text-sm text-faint">UI 프리뷰 · 분석 엔진 미연결</p>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}

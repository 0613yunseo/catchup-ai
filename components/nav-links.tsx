"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/analyze", label: "분석" },
  { href: "/report", label: "리포트" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-sunken font-medium text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

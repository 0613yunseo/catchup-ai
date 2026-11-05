import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";

function LogoMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
      <rect x="2" y="3" width="11" height="4" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="7" y="9" width="11" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="15" width="11" height="2" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 text-accent" aria-label="CatchUp AI 홈">
            <LogoMark />
            <span className="text-sm font-semibold tracking-tight text-fg">CatchUp AI</span>
          </Link>
          <NavLinks />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

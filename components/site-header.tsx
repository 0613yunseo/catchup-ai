import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnPrimary } from "@/components/button-styles";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Logo />
          <div className="hidden sm:block">
            <NavLinks />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/analyze" className={`${btnPrimary} hidden h-8 px-3 sm:inline-flex`}>
            분석 시작
          </Link>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

// 두 줄이 따라잡는 모양: 위 줄이 아래 줄(진하게)을 뒤따른다.
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      <rect x="5" y="6.5" width="9" height="3.5" rx="1.5" fill="var(--accent-fg)" opacity="0.55" />
      <rect x="9" y="12.5" width="10" height="3.5" rx="1.5" fill="var(--accent-fg)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="CatchUp AI 홈">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">CatchUp AI</span>
    </Link>
  );
}

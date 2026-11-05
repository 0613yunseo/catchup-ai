const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors";

export const btnPrimary = `${base} bg-accent text-accent-fg hover:brightness-110`;
export const btnSecondary = `${base} border border-line-strong bg-surface text-fg hover:bg-sunken`;
// 파란 면 위에서 쓰는 버튼
export const btnOnAccent = `${base} bg-accent-fg text-accent hover:opacity-90`;

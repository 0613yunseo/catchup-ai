"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";

type Theme = "system" | "light" | "dark";

const KEY = "theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function write(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // 저장소 접근이 막혀도 현재 탭에서는 적용된다.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const OPTIONS = [
  { value: "system", label: "시스템 설정", Icon: MonitorIcon },
  { value: "light", label: "라이트 모드", Icon: SunIcon },
  { value: "dark", label: "다크 모드", Icon: MoonIcon },
] as const;

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <div
      role="group"
      aria-label="테마"
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          onClick={() => write(value)}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            theme === value
              ? "bg-sunken text-fg"
              : "text-faint hover:text-fg"
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

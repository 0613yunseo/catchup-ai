import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* 동적 경로(/history/[id])에서 usePathname이 요청 시점 값이라 Suspense가 필요하다. */}
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}

"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ReportWorkspace } from "@/components/report/report-workspace";
import { clearReport, parseStoredReport, readRawReport } from "@/lib/report-store";

// 같은 탭의 sessionStorage 값은 바뀌어도 알림이 없으므로 구독할 것이 없다. 직접 지우면 아래 notify로 다시 읽는다.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const notify = () => listeners.forEach((l) => l());

/**
 * /report 화면. 저장된 Report를 읽어 표시한다.
 * 서버 렌더링 중에는 저장소를 알 수 없으므로(undefined) 불러오는 상태를 보여 주고, 가짜 결과는 만들지 않는다.
 */
export function ReportLoader() {
  const raw = useSyncExternalStore(subscribe, readRawReport, () => undefined);
  const stored = useMemo(() => (raw === undefined ? null : parseStoredReport(raw)), [raw]);

  if (stored === null) return <ReportWorkspace report={null} emptyReason="loading" />;
  if (stored.status === "ok") return <ReportWorkspace report={stored.report} />;
  return (
    <ReportWorkspace
      report={null}
      emptyReason={stored.status === "empty" ? "none" : "invalid"}
      onClear={() => {
        clearReport();
        notify();
      }}
    />
  );
}

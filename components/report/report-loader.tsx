"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ReportWorkspace } from "@/components/report/report-workspace";
import { clearPending, loadPending } from "@/lib/pending-report";
import { clearReport, parseStoredReport, readRawReport, saveReport } from "@/lib/report-store";

// 같은 탭의 sessionStorage 값은 바뀌어도 알림이 없으므로 구독할 것이 없다. 직접 지우거나 복구하면 아래 notify로 다시 읽는다.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const notify = () => listeners.forEach((l) => l());

/**
 * /report 화면. 저장된 Report를 읽어 표시한다.
 * 서버 렌더링 중에는 저장소를 알 수 없으므로(undefined) 불러오는 상태를 보여 주고, 가짜 결과는 만들지 않는다.
 *
 * ?restore=1 은 로그인 전에 저장하려던 리포트를 인증 후 되살리는 경로이다.
 * 이 탭에 리포트가 없고 임시 보관된(30분 이내, 형식 검증을 통과한) 리포트가 있으면 복구하고, 임시 보관본은 지운다.
 */
export function ReportLoader() {
  const raw = useSyncExternalStore(subscribe, readRawReport, () => undefined);
  const stored = useMemo(() => (raw === undefined ? null : parseStoredReport(raw)), [raw]);
  const restore = useSearchParams().get("restore") === "1";
  const [prompt, setPrompt] = useState(restore); // 복구한 리포트에서 저장 확인을 바로 띄운다
  const handled = useRef(false);

  useEffect(() => {
    if (!restore || handled.current || raw === undefined) return;
    handled.current = true;
    if (parseStoredReport(raw).status === "empty") {
      const pending = loadPending();
      if (pending && saveReport(pending)) notify();
    }
    clearPending();
    // 새로고침할 때 같은 안내가 반복되지 않도록 주소에서 표시를 지운다.
    window.history.replaceState(null, "", "/report");
  }, [restore, raw]);

  if (stored === null) return <ReportWorkspace report={null} emptyReason="loading" />;
  if (stored.status === "ok") return <ReportWorkspace report={stored.report} autoPrompt={prompt} />;
  return (
    <ReportWorkspace
      report={null}
      emptyReason={stored.status === "empty" ? "none" : "invalid"}
      onClear={() => {
        clearReport();
        notify();
        setPrompt(false);
      }}
    />
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestInspect } from "@/lib/github/api-client";
import type { InspectErrorInfo, InspectResponse } from "@/lib/github/types";

export type InspectState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: InspectResponse }
  | { status: "error"; error: InspectErrorInfo };

// 저장소 조회 상태. 결과는 조회한 URL에 묶여 있어서 URL을 바꾸면 자동으로 idle이 된다.
export function useRepoInspection(repoUrl: string) {
  const [result, setResult] = useState<{ url: string; state: InspectState }>({
    url: "",
    state: { status: "idle" },
  });
  const abort = useRef<AbortController | null>(null);
  const url = repoUrl.trim();

  useEffect(() => () => abort.current?.abort(), []);

  const inspect = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setResult({ url, state: { status: "loading" } });
    try {
      const outcome = await requestInspect(url, controller.signal);
      setResult({
        url,
        state: outcome.ok ? { status: "success", data: outcome.data } : { status: "error", error: outcome.error },
      });
    } catch {
      // 새 조회나 화면 이동으로 취소된 요청은 무시한다.
    }
  }, [url]);

  const state: InspectState = result.url === url ? result.state : { status: "idle" };
  return { state, inspect };
}

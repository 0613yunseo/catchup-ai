"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestExtract } from "@/lib/extract/api-client";
import type { ExtractErrorInfo, ExtractRequest, ExtractResponse } from "@/lib/extract/types";

export type ExtractionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ExtractResponse }
  | { status: "error"; error: ExtractErrorInfo };

// 요구사항 추출 상태. 결과는 요청 당시의 입력(key)에 묶여 있어서, 입력을 고치면 이전 결과는 숨겨진다.
export function useExtraction(key: string) {
  const [result, setResult] = useState<{ key: string; state: ExtractionState }>({
    key: "",
    state: { status: "idle" },
  });
  const inflight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const last = useRef<ExtractRequest | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(
    async (input: ExtractRequest) => {
      if (inflight.current) return; // 중복 요청 방지
      inflight.current = true;
      last.current = input;
      const controller = new AbortController();
      abort.current = controller;
      setResult({ key, state: { status: "loading" } });
      try {
        const outcome = await requestExtract(input, controller.signal);
        if (controller.signal.aborted) return; // 새 분석·화면 이동으로 취소된 뒤 늦게 도착한 응답은 반영하지 않는다
        setResult({
          key,
          state: outcome.ok ? { status: "success", data: outcome.data } : { status: "error", error: outcome.error },
        });
      } catch {
        // 화면을 벗어나 취소된 요청은 무시한다.
      } finally {
        inflight.current = false;
      }
    },
    [key],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current);
  }, [run]);

  const state: ExtractionState = result.key === key ? result.state : { status: "idle" };
  return { state, run, retry };
}

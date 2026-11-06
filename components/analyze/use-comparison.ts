"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestCompare } from "@/lib/compare/api-client";
import type { CompareErrorInfo, CompareRequestBody, CompareResponse } from "@/lib/compare/types";
import type { Report } from "@/lib/report";
import { saveReport } from "@/lib/report-store";

export type ComparisonState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: CompareResponse; saved: boolean }
  | { status: "error"; error: CompareErrorInfo };

// 코드 비교 상태. 결과는 요청 당시의 입력(key)에 묶여 있어서, 문서·저장소·추출 결과가 바뀌면 이전 결과는 숨겨진다.
export function useComparison(key: string) {
  const [result, setResult] = useState<{ key: string; state: ComparisonState }>({
    key: "",
    state: { status: "idle" },
  });
  const inflight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const last = useRef<{ body: CompareRequestBody; decorate?: (r: Report) => Report } | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const run = useCallback(
    // decorate: 저장하기 전에 Report에 정보를 덧붙인다. (예: 회의 변경 정보) 서버 응답은 바꾸지 않는다.
    async (body: CompareRequestBody, decorate?: (r: Report) => Report) => {
      if (inflight.current) return; // 중복 요청 방지
      inflight.current = true;
      last.current = { body, decorate };
      const controller = new AbortController();
      abort.current = controller;
      setResult({ key, state: { status: "loading" } });
      try {
        const outcome = await requestCompare(body, controller.signal);
        if (controller.signal.aborted) return; // 새 분석·화면 이동으로 취소된 뒤 늦게 도착한 응답은 반영하지 않는다
        if (!outcome.ok) {
          setResult({ key, state: { status: "error", error: outcome.error } });
        } else if (body.commitSha && outcome.data.repository.commitSha !== body.commitSha) {
          // 조회한 커밋과 비교한 커밋이 다르면 결과를 쓰지 않는다.
          setResult({
            key,
            state: {
              status: "error",
              error: { code: "COMMIT_MISMATCH", message: "조회한 커밋과 비교한 커밋이 달라 결과를 사용하지 않았습니다. 저장소를 다시 확인해 주세요." },
            },
          });
        } else {
          // 다음 화면(/report)에서 쓸 수 있도록 Report를 이 탭의 세션에 보관한다.
          setResult({ key, state: { status: "success", data: outcome.data, saved: saveReport(decorate ? decorate(outcome.data.report) : outcome.data.report) } });
        }
      } catch {
        // 화면을 벗어나 취소된 요청은 무시한다.
      } finally {
        inflight.current = false;
      }
    },
    [key],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current.body, last.current.decorate);
  }, [run]);

  const state: ComparisonState = result.key === key ? result.state : { status: "idle" };
  return { state, run, retry };
}

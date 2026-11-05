"use client";

import { useRef, useState } from "react";
import { btnSecondary } from "@/components/button-styles";
import { InfoIcon, UploadIcon } from "@/components/icons";
import type { StageResult } from "@/lib/analysis";
import { ACCEPT, uploadDocument, type UploadedDocument } from "@/lib/document/api-client";

type State =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "error"; message: string }
  | { status: "ready"; doc: UploadedDocument; applied: boolean };

type Props = {
  /** 입력란에 이미 내용이 있는지. 있으면 덮어쓰기 전에 확인을 받는다. */
  hasText: boolean;
  /** 추출한 텍스트를 문서 입력란에 반영한다. */
  onApply: (text: string) => void;
  disabled?: boolean;
  /** 같은 화면에 업로드 패널이 둘일 때 입력 요소를 구분한다. */
  id?: string;
  /** 업로드 진행 상태를 진행 단계 표시에 알린다. 파일을 처리하지 않을 때는 undefined. */
  onStage?: (stage: StageResult | undefined) => void;
};

const PREVIEW_CHARS = 600;

// 파일 1개(PDF·DOCX·TXT)를 올려 텍스트를 추출한다. 원본은 저장하지 않는다.
export function UploadPanel({ hasText, onApply, disabled, onStage, id = "f-file" }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = state.status === "uploading";

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    setState({ status: "uploading", fileName: file.name });
    onStage?.({ state: "running" });
    const res = await uploadDocument(file);
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일을 다시 고를 수 있게 한다
    if (!res.ok) {
      setState({ status: "error", message: res.error.message });
      onStage?.({ state: "error", error: res.error.message });
      return;
    }
    onStage?.(undefined); // 성공하면 입력 문서 검사 결과(길이)가 단계 상태를 정한다
    // 입력란이 비어 있으면 바로 반영하고, 내용이 있으면 사용자가 확인한 뒤에만 바꾼다.
    if (!hasText) {
      onApply(res.data.text);
      setState({ status: "ready", doc: res.data, applied: true });
    } else {
      setState({ status: "ready", doc: res.data, applied: false });
    }
  }

  const doc = state.status === "ready" ? state.doc : null;

  return (
    <div className="rounded-lg border border-dashed border-line-strong px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <UploadIcon className="size-4 shrink-0 text-muted" />
        <p className="min-w-0 flex-1 text-sm text-muted">
          <span className="font-medium text-fg">파일 업로드</span> · PDF, DOCX, TXT 한 개 (4MB 이하, 텍스트 PDF만 지원)
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <label
          htmlFor={id}
          className={`${btnSecondary} cursor-pointer ${disabled || busy ? "pointer-events-none opacity-50" : ""} focus-within:outline`}
        >
          {busy ? "읽는 중…" : "파일 선택"}
        </label>
      </div>

      <div role="status" aria-live="polite">
        {state.status === "uploading" && (
          <p className="mt-3 text-sm text-muted">‘{state.fileName}’에서 텍스트를 추출하고 있습니다.</p>
        )}
        {state.status === "error" && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-bad">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {state.message}
          </p>
        )}
      </div>

      {doc && state.status === "ready" && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            <span className="break-all font-medium">{doc.fileName}</span>
            <span className="ml-2 text-muted">
              {doc.format.toUpperCase()} · {doc.pages ? `${doc.pages}쪽 · ` : ""}
              {doc.chars.toLocaleString("ko-KR")}자 추출
            </span>
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sunken px-3 py-2 text-sm leading-6 text-muted">
            {doc.text.slice(0, PREVIEW_CHARS)}
            {doc.text.length > PREVIEW_CHARS ? "\n…" : ""}
          </pre>
          {state.applied ? (
            <p className="text-sm text-ok">문서 입력란에 반영했습니다. 내용을 확인하고 필요하면 고쳐 쓰세요.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  onApply(doc.text);
                  setState({ status: "ready", doc, applied: true });
                }}
              >
                입력란에 반영 (기존 내용 대체)
              </button>
              <button type="button" className="text-sm text-muted underline underline-offset-2" onClick={() => setState({ status: "idle" })}>
                취소
              </button>
              <p className="text-sm text-faint">입력란에 이미 내용이 있어 바꾸지 않았습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { btnSecondary } from "@/components/button-styles";
import { FileTextIcon, InfoIcon, UploadIcon, XIcon } from "@/components/icons";
import type { Attachment, AttachmentsApi } from "@/components/analyze/use-attachments";
import { ATTACH_LIMITS } from "@/lib/document/attachments";

const PREVIEW_CHARS = 3000;
const ACCEPT = ".pdf,.docx,.txt";
const fmt = (n: number) => n.toLocaleString("ko-KR");

type Props = {
  /** 입력 요소와 접근성 id를 구분한다. (이전/최신 영역이 한 화면에 있다) */
  idPrefix: string;
  /** 영역 이름. 예: 이전 회의록, 최신 회의록, 문서 */
  label: string;
  api: AttachmentsApi;
  /** 분석에 합쳐질 전체 텍스트 길이(직접 입력 + 첨부, 출처 표시 포함) */
  totalChars: number;
  /** 중복 내용이라 분석에서 빠지는 첨부파일 id와 이유 */
  skipped: Map<string, string>;
  disabled?: boolean;
};

function ExtractedPreview({ id, text, chars }: { id: string; text: string; chars: number }) {
  return (
    <div id={id} className="mt-2">
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sunken px-3 py-2 text-sm leading-6 text-muted">
        {text.slice(0, PREVIEW_CHARS)}
        {text.length > PREVIEW_CHARS ? "\n…" : ""}
      </pre>
      {text.length > PREVIEW_CHARS && (
        <p className="mt-1 text-xs text-faint">
          전체 {fmt(chars)}자 중 앞 {fmt(PREVIEW_CHARS)}자만 보여 줍니다. 분석에는 전체 텍스트가 쓰입니다.
        </p>
      )}
    </div>
  );
}

function AttachmentCard({ a, skipReason, onRemove }: { a: Attachment; skipReason?: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const previewId = useId();
  const ext = a.name.split(".").pop()?.toUpperCase() ?? "";
  const tone = a.status === "error" ? "border-bad/50" : "border-line-strong";
  return (
    <li className={`rounded-lg border ${tone} bg-surface px-3 py-2.5`}>
      <div className="flex items-start gap-3">
        <FileTextIcon className="mt-0.5 size-5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 max-w-full truncate text-sm font-medium" title={a.name}>
              {a.name}
            </p>
            <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-muted">{a.format ? a.format.toUpperCase() : ext}</span>
          </div>
          {a.status === "extracting" && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <span className="block size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              텍스트 추출 중…
            </p>
          )}
          {a.status === "ready" && (
            <p className="mt-1 text-sm text-muted">
              추출 완료 · {fmt(a.chars ?? 0)}자{a.pages ? ` · ${a.pages}쪽` : ""}
              {skipReason && <span className="ml-1 text-warn">· 분석에서 제외</span>}
            </p>
          )}
          {a.status === "error" && (
            <p role="alert" className="mt-1 flex items-start gap-1.5 text-sm text-bad">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{a.error} 이 파일은 분석에 포함되지 않습니다.</span>
            </p>
          )}
          {skipReason && <p className="mt-1 text-xs text-warn">{skipReason}</p>}
          {a.status === "ready" && a.text && (
            <>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={previewId}
                onClick={() => setOpen((v) => !v)}
                className="mt-1 text-sm text-accent-text underline underline-offset-2"
              >
                {open ? "추출 텍스트 접기" : "추출 텍스트 보기"}
              </button>
              {open && <ExtractedPreview id={previewId} text={a.text} chars={a.chars ?? a.text.length} />}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${a.name} 삭제`}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-fg"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </li>
  );
}

// 첨부파일 영역: 끌어다 놓기·여러 파일 선택·카드 목록. 추출한 텍스트는 기본으로 접어 두고 편집기에 펼치지 않는다.
export function AttachmentPanel({ idPrefix, label, api, totalChars, skipped, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = `${idPrefix}-input`;
  const full = api.items.length >= ATTACH_LIMITS.maxFiles;
  const off = disabled || full;

  function take(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length) api.add(files);
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일을 다시 고를 수 있게 한다
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!off) take(e.dataTransfer.files);
  }

  return (
    <div className="space-y-2">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!off) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 ${
          dragging ? "border-accent bg-accent-soft" : "border-line-strong"
        }`}
      >
        <UploadIcon className="size-4 shrink-0 text-muted" />
        <p className="min-w-0 flex-1 text-sm text-muted">
          <span className="font-medium text-fg">{label} 파일 첨부</span> · 파일을 끌어다 놓거나 선택하세요. PDF, DOCX, TXT · 최대 {ATTACH_LIMITS.maxFiles}개 · 파일당 4MB (텍스트 PDF만)
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={off}
          onChange={(e) => take(e.target.files)}
        />
        <label
          htmlFor={inputId}
          className={`${btnSecondary} cursor-pointer focus-within:outline ${off ? "pointer-events-none opacity-50" : ""}`}
        >
          {full ? `최대 ${ATTACH_LIMITS.maxFiles}개` : "파일 선택"}
        </label>
      </div>

      <div aria-live="polite">
        {api.rejected.length > 0 && (
          <div role="alert" className="flex items-start gap-2 text-sm text-bad">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <ul className="min-w-0 flex-1 space-y-0.5">
              {api.rejected.map((r, i) => (
                <li key={`${r.name}-${i}`} className="break-words">
                  <span className="font-medium">{r.name}</span> — {r.message}
                </li>
              ))}
            </ul>
            <button type="button" onClick={api.dismissRejected} aria-label="알림 닫기" className="shrink-0 text-muted hover:text-fg">
              <XIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {api.items.length > 0 && (
        <>
          <ul aria-label={`${label} 첨부파일`} className="space-y-2">
            {api.items.map((a) => (
              <AttachmentCard key={a.id} a={a} skipReason={skipped.get(a.id)} onRemove={() => api.remove(a.id)} />
            ))}
          </ul>
          <p className="text-xs tabular-nums text-faint">
            {label} 전체 입력(직접 입력 + 첨부) {fmt(totalChars)} / {fmt(ATTACH_LIMITS.maxChars)}자
          </p>
        </>
      )}
    </div>
  );
}

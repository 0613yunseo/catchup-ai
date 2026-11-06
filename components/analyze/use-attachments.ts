"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ATTACH_LIMITS, checkAddable, composeDocument, type ComposeFile } from "@/lib/document/attachments";
import { uploadDocument } from "@/lib/document/api-client";
import type { DocFormat } from "@/lib/document/limits";

export type Attachment = {
  id: string;
  name: string;
  size: number;
  status: "extracting" | "ready" | "error";
  format?: DocFormat;
  text?: string;
  chars?: number;
  pages?: number | null;
  error?: string;
};

export type Rejected = { name: string; message: string };

let seq = 0;
const nextId = () => `att-${Date.now().toString(36)}-${++seq}`;

/**
 * 한 문서 영역(단일/이전/최신)의 첨부파일 목록. 파일마다 기존 /api/documents/extract로 텍스트를 추출한다.
 * 추출한 텍스트는 편집기에 펼치지 않고 목록에만 보관하며, 분석 직전에 composeDocument로 합친다.
 * 화면을 벗어나거나 새 분석을 시작하면(컴포넌트가 사라지면) 진행 중인 요청을 모두 취소한다.
 */
export function useAttachments(getDirectText: () => string) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const itemsRef = useRef<Attachment[]>([]);
  const directRef = useRef(getDirectText);
  const aborts = useRef(new Map<string, AbortController>());

  useEffect(() => {
    directRef.current = getDirectText;
  });
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    const map = aborts.current;
    return () => {
      for (const c of map.values()) c.abort();
      map.clear();
    };
  }, []);

  const finish = useCallback((id: string, patch: (prev: Attachment[], self: Attachment) => Attachment) => {
    setItems((prev) => {
      const self = prev.find((x) => x.id === id);
      if (!self) return prev; // 그 사이 삭제된 파일의 늦은 응답은 버린다
      const next = patch(prev, self);
      return prev.map((x) => (x.id === id ? next : x));
    });
  }, []);

  const startUpload = useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController();
      aborts.current.set(id, controller);
      try {
        const res = await uploadDocument(file, controller.signal);
        if (controller.signal.aborted) return;
        if (!res.ok) {
          finish(id, (_p, self) => ({ ...self, status: "error", error: res.error.message }));
          return;
        }
        const d = res.data;
        finish(id, (prev, self) => {
          // 직접 입력과 이미 쓸 수 있는 파일을 합친 길이에 이 파일을 더했을 때 한도를 넘으면 이 파일은 쓰지 않는다.
          const others: ComposeFile[] = prev.filter((x) => x.status === "ready" && x.text).map((x) => ({ id: x.id, name: x.name, text: x.text! }));
          const before = composeDocument(directRef.current(), others).text.length;
          const after = composeDocument(directRef.current(), [...others, { id, name: self.name, text: d.text }]).text.length;
          if (after > ATTACH_LIMITS.maxChars) {
            return {
              ...self,
              status: "error",
              error: `합산 ${ATTACH_LIMITS.maxChars.toLocaleString("ko-KR")}자를 넘어 이 파일은 분석에 쓰지 않습니다. (현재 ${before.toLocaleString("ko-KR")}자 + 이 파일 ${d.chars.toLocaleString("ko-KR")}자)`,
            };
          }
          return { ...self, status: "ready", format: d.format, text: d.text, chars: d.chars, pages: d.pages };
        });
      } catch {
        // 삭제·새 분석으로 취소된 요청은 무시한다.
      } finally {
        aborts.current.delete(id);
      }
    },
    [finish],
  );

  const add = useCallback(
    (files: File[]) => {
      const skipped: Rejected[] = [];
      const accepted: { id: string; file: File }[] = [];
      let list = itemsRef.current;
      for (const file of files) {
        const why = checkAddable(list, { name: file.name, size: file.size });
        if (why) {
          skipped.push({ name: file.name, message: why });
          continue;
        }
        const entry: Attachment = { id: nextId(), name: file.name, size: file.size, status: "extracting" };
        list = [...list, entry];
        accepted.push({ id: entry.id, file });
      }
      itemsRef.current = list; // 같은 호출 안의 다음 파일이 최신 목록을 보게 한다
      setItems(list);
      setRejected(skipped);
      for (const { id, file } of accepted) void startUpload(id, file);
    },
    [startUpload],
  );

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.abort();
    aborts.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    setRejected([]);
  }, []);

  const dismissRejected = useCallback(() => setRejected([]), []);

  const ready = useMemo<ComposeFile[]>(
    () => items.filter((x) => x.status === "ready" && x.text).map((x) => ({ id: x.id, name: x.name, text: x.text! })),
    [items],
  );
  const busy = items.some((x) => x.status === "extracting");

  return { items, ready, busy, rejected, add, remove, dismissRejected };
}

export type AttachmentsApi = ReturnType<typeof useAttachments>;

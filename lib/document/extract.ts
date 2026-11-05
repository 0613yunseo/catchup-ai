import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { DocumentError } from "./errors.ts";
import { DOC_LIMITS, type DocFormat } from "./limits.ts";
import { zipUncompressedTotal } from "./zip.ts";

export type ExtractedDocument = { format: DocFormat; text: string; chars: number; pages?: number };

export function formatFromName(name: string): DocFormat | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === "pdf" || ext === "docx" || ext === "txt" ? ext : null;
}

// 제어 문자와 BOM을 지우고 줄바꿈과 빈 줄을 정리한다.
export function normalizeText(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeTxt(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new DocumentError("TYPE_MISMATCH"); // 바이너리 파일
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // 한국어 메모장 등이 만드는 EUC-KR(CP949) 파일
    try {
      return new TextDecoder("euc-kr", { fatal: true }).decode(bytes);
    } catch {
      throw new DocumentError("CORRUPT");
    }
  }
}

async function readPdf(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!head.includes("%PDF-")) throw new DocumentError("TYPE_MISMATCH");
  try {
    // pdfjs가 버퍼를 가져가므로 복사본을 넘긴다.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    try {
      if (pdf.numPages > DOC_LIMITS.maxPdfPages) throw new DocumentError("TOO_MANY_PAGES");
      const { text } = await extractText(pdf, { mergePages: true });
      return { text, pages: pdf.numPages };
    } finally {
      await pdf.loadingTask.destroy();
    }
  } catch (e) {
    if (e instanceof DocumentError) throw e;
    if ((e as { name?: string })?.name === "PasswordException") throw new DocumentError("ENCRYPTED");
    throw new DocumentError("CORRUPT");
  }
}

async function readDocx(bytes: Uint8Array): Promise<string> {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new DocumentError("TYPE_MISMATCH");
  const total = zipUncompressedTotal(bytes);
  if (total === null) throw new DocumentError("CORRUPT");
  if (total > DOC_LIMITS.maxDocxUncompressed) throw new DocumentError("FILE_TOO_LARGE");
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  } catch {
    throw new DocumentError("CORRUPT");
  }
}

// 업로드된 파일 한 개에서 텍스트를 뽑는다. 파일은 메모리에서만 다루고 어디에도 저장하지 않는다.
export async function extractDocument(fileName: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  const format = formatFromName(fileName);
  if (!format) throw new DocumentError("UNSUPPORTED_TYPE");
  if (bytes.length === 0) throw new DocumentError("EMPTY_FILE");
  if (bytes.length > DOC_LIMITS.maxBytes) throw new DocumentError("FILE_TOO_LARGE");

  let raw: string;
  let pages: number | undefined;
  if (format === "pdf") {
    const r = await readPdf(bytes);
    raw = r.text;
    pages = r.pages;
  } else if (format === "docx") {
    raw = await readDocx(bytes);
  } else {
    raw = decodeTxt(bytes);
  }

  const text = normalizeText(raw);
  if (!text) throw new DocumentError(format === "txt" ? "EMPTY_FILE" : "NO_TEXT");
  if (text.length > DOC_LIMITS.textMax) throw new DocumentError("TEXT_TOO_LONG");
  return { format, text, chars: text.length, ...(pages ? { pages } : {}) };
}

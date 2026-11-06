// 첨부파일 목록 규칙과 문서 합치기. 브라우저와 서버가 함께 쓰며 DOM·React에 의존하지 않는다.
import { normalizeForMatch } from "../extract/quote.ts";
import { DOC_LIMITS } from "./limits.ts";
import { DIRECT_HEADER, fileHeader } from "./source-marker.ts";

export const ATTACH_LIMITS = {
  maxFiles: 3,
  maxBytes: DOC_LIMITS.maxBytes,
  /** 직접 입력과 첨부파일을 합친 텍스트(출처 표시 포함)의 최대 글자 수 */
  maxChars: DOC_LIMITS.textMax,
  fileNameMax: 60,
} as const;

const EXT_RE = /\.(pdf|docx|txt)$/i;
// 줄 구분 문자(U+2028, U+2029)도 줄바꿈처럼 취급한다. 소스에 직접 쓰지 않고 코드 값으로 만든다.
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, "g");
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

/** 출처 표시와 프롬프트에 들어가는 파일명을 안전하게 만든다. 줄바꿈·제어 문자·대괄호·꺾쇠를 없애고 길이를 줄인다. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARS, " ")
    .replace(LINE_SEPARATORS, " ")
    .replace(/[[\]<>"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "파일";
  if (cleaned.length <= ATTACH_LIMITS.fileNameMax) return cleaned;
  const ext = cleaned.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? "";
  return `${cleaned.slice(0, ATTACH_LIMITS.fileNameMax - ext.length - 1)}…${ext}`;
}

export const ATTACH_MESSAGES = {
  tooMany: `첨부파일은 최대 ${ATTACH_LIMITS.maxFiles}개까지 추가할 수 있습니다.`,
  type: "PDF, DOCX, TXT 파일만 올릴 수 있습니다.",
  empty: "빈 파일입니다. 내용이 있는 파일을 올려 주세요.",
  tooLarge: `파일이 너무 큽니다. ${Math.round(ATTACH_LIMITS.maxBytes / 1024 / 1024)}MB 이하의 파일만 올릴 수 있습니다.`,
  duplicate: "이미 첨부된 파일입니다.",
} as const;

export type FileLike = { name: string; size: number };

/** 목록에 추가할 수 있는 파일인지 확인한다. 추가할 수 없으면 이유를, 가능하면 null을 돌려준다. (서버가 형식·내용을 다시 검사한다.) */
export function checkAddable(existing: FileLike[], file: FileLike): string | null {
  if (existing.length >= ATTACH_LIMITS.maxFiles) return ATTACH_MESSAGES.tooMany;
  if (!EXT_RE.test(file.name)) return ATTACH_MESSAGES.type;
  if (file.size === 0) return ATTACH_MESSAGES.empty;
  if (file.size > ATTACH_LIMITS.maxBytes) return ATTACH_MESSAGES.tooLarge;
  if (existing.some((f) => f.name === file.name && f.size === file.size)) return ATTACH_MESSAGES.duplicate;
  return null;
}

export type ComposeFile = { id: string; name: string; text: string };
export type ComposeResult = {
  /** AI에 보낼 텍스트. 첨부파일이 없으면 직접 입력 텍스트 그대로이다. */
  text: string;
  /** 다른 출처에 이미 들어 있는 내용이라 빼낸 항목. direct는 id가 "direct"이다. */
  skipped: { id: string; reason: string }[];
  /** 실제로 합친 첨부파일의 id */
  included: string[];
};

const clean = (s: string) => s.replace(/\r\n?/g, "\n").trim();

/**
 * 직접 입력과 첨부파일 텍스트를 출처 표시와 함께 한 문서로 합친다.
 * - 첨부파일이 없으면 직접 입력을 그대로 돌려준다(기존 단일 입력과 같다).
 * - 다른 출처의 텍스트에 통째로 들어 있는 출처는 중복으로 보고 뺀다. (같은 내용을 붙여넣고 파일도 올린 경우)
 * - 파일명은 sanitizeFileName으로 정리한다. 출처 표시는 인용 검증이 거부하므로 AI의 원문 인용에 섞이지 않는다.
 */
export function composeDocument(direct: string, files: ComposeFile[]): ComposeResult {
  const directText = clean(direct);
  if (files.length === 0) return { text: directText, skipped: [], included: [] };

  type Part = { id: string; name: string | null; text: string; norm: string };
  const parts: Part[] = [];
  if (directText) parts.push({ id: "direct", name: null, text: directText, norm: normalizeForMatch(directText) });
  for (const f of files) {
    const t = clean(f.text);
    if (t) parts.push({ id: f.id, name: sanitizeFileName(f.name), text: t, norm: normalizeForMatch(t) });
  }

  // 긴 것부터 보며, 이미 남긴 출처에 통째로 들어 있으면 중복으로 뺀다. (같은 길이면 앞선 것을 남긴다)
  const order = parts.map((p, i) => ({ p, i })).sort((a, b) => b.p.norm.length - a.p.norm.length || a.i - b.i);
  const kept: Part[] = [];
  const skipped: ComposeResult["skipped"] = [];
  for (const { p } of order) {
    const dup = kept.find((k) => k.norm.includes(p.norm));
    if (dup) skipped.push({ id: p.id, reason: dup.name ? `‘${dup.name}’에 같은 내용이 있어 제외했습니다.` : "직접 입력에 같은 내용이 있어 제외했습니다." });
    else kept.push(p);
  }
  const ordered = parts.filter((p) => kept.includes(p));
  if (!ordered.some((p) => p.name !== null)) return { text: directText, skipped, included: [] }; // 쓸 수 있는 첨부 텍스트가 없으면 출처 표시도 붙이지 않는다
  let n = 0;
  const text = ordered
    .map((p) => `${p.name === null ? DIRECT_HEADER : fileHeader(++n, p.name)}\n${p.text}`)
    .join("\n\n");
  return { text, skipped, included: ordered.filter((p) => p.name !== null).map((p) => p.id) };
}

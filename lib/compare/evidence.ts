// AI가 제시한 코드 근거를 서버가 실제 파일과 대조해 검증한다. 통과한 근거의 스니펫은 서버가 파일에서 직접 잘라 넣는다.
import { normalizeForMatch } from "../extract/quote.ts";
import type { SourceFile } from "../github/types.ts";
import { COMPARE_LIMITS as L } from "./limits.ts";
import type { ShownFile } from "./select.ts";
import type { CodeEvidence } from "./types.ts";

export type EvidenceCheck = { ok: true; evidence: CodeEvidence; adjusted: boolean } | { ok: false; reason: string };

const WINDOW = 3;

/** 정규화한 인용이 lines[from..to](1부터) 안 어디에 있는지 찾아 실제 줄 범위를 돌려준다. */
function locateQuote(lines: string[], q: string, from: number, to: number): { start: number; end: number } | null {
  let joined = "";
  const segs: { line: number; from: number; to: number }[] = [];
  for (let n = from; n <= to; n++) {
    const t = normalizeForMatch(lines[n - 1] ?? "");
    if (!t) continue;
    if (joined) joined += " ";
    segs.push({ line: n, from: joined.length, to: joined.length + t.length });
    joined += t;
  }
  const at = joined.indexOf(q);
  if (at < 0) return null;
  const first = segs.find((g) => at < g.to);
  const last = segs.find((g) => at + q.length - 1 < g.to);
  return first && last ? { start: first.line, end: last.line } : null;
}

export function verifyEvidence(
  raw: unknown,
  shown: Map<string, ShownFile>,
  files: Map<string, SourceFile>,
): EvidenceCheck {
  const e = (raw ?? {}) as Record<string, unknown>;
  const { path, startLine, endLine, quote, role } = e;
  if (typeof path !== "string" || typeof quote !== "string") return { ok: false, reason: "형식이 올바르지 않습니다." };

  const file = files.get(path);
  if (!file) return { ok: false, reason: `수집한 파일 목록에 없는 경로입니다: ${path.slice(0, 80)}` };
  const view = shown.get(path);
  if (!view) return { ok: false, reason: `AI에게 제공하지 않은 파일입니다: ${path}` };

  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return { ok: false, reason: "라인 번호가 정수가 아닙니다." };
  let start = startLine as number;
  let end = endLine as number;
  if (start < 1 || end < start) return { ok: false, reason: "라인 범위가 올바르지 않습니다." };
  if (end > view.shownLines) return { ok: false, reason: `${path}의 ${end}번째 줄은 제공된 범위(${view.shownLines}줄)를 벗어납니다.` };

  // 프롬프트의 줄 번호 접두사("12| ")를 인용에 그대로 복사한 경우만 제거한다. 코드 내용은 바꾸지 않는다.
  const q = normalizeForMatch(quote.replace(/^[ \t]*\d+\|[ \t]?/gm, ""));
  if (q.length < L.quoteMin || quote.length > L.quoteMax) return { ok: false, reason: "인용한 코드가 너무 짧거나 깁니다." };

  const lines = file.content.split("\n");
  let adjusted = false;
  if (!normalizeForMatch(lines.slice(start - 1, end).join("\n")).includes(q)) {
    // AI가 줄 번호를 한두 줄 어긋나게 센 경우: 근처(±3줄)에서 인용한 코드가 실제로 발견될 때만 그 위치까지 범위를 넓힌다.
    const loc = locateQuote(lines, q, Math.max(1, start - WINDOW), Math.min(view.shownLines, end + WINDOW));
    if (!loc) return { ok: false, reason: `${path} ${start}-${end}줄 근처에 인용한 코드가 없습니다.` };
    start = Math.min(start, loc.start);
    end = Math.max(end, loc.end);
    adjusted = true;
  }
  if (end - start + 1 > L.evidenceMaxLines) return { ok: false, reason: `근거 범위가 ${L.evidenceMaxLines}줄을 넘습니다.` };
  const snippet = lines.slice(start - 1, end).join("\n");
  if (snippet.length > L.evidenceMaxChars) return { ok: false, reason: "근거 코드가 너무 깁니다." };
  const r = role === "direct" || role === "partial" || role === "context" ? role : undefined;
  return { ok: true, adjusted, evidence: { path, startLine: start, endLine: end, snippet, language: file.language, ...(r ? { role: r } : {}) } };
}

// 요구사항과 관련된 코드 파일을 고르고, AI에게 보여 줄 컨텍스트를 한도 안에서 구성한다. 순수 함수라 네트워크 없이 테스트할 수 있다.
import type { ExtractedRequirement } from "../extract/types.ts";
import type { SourceFile } from "../github/types.ts";
import { COMPARE_LIMITS as L } from "./limits.ts";

export type IndexEntry = { path: string; language: string; lineCount: number; symbols: string[] };

const SYMBOL_RE =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|static\s+)*(?:function\*?|class|interface|def|func|fn|type|enum|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/;

/** 파일의 대표 이름(함수·클래스·상수)을 몇 개 뽑는다. 파일 목록에서 무엇이 들어 있는지 알려 주는 용도다. */
export function symbolsOf(content: string): string[] {
  const out: string[] = [];
  for (const line of content.split("\n")) {
    const m = SYMBOL_RE.exec(line);
    if (m && !out.includes(m[1])) {
      out.push(m[1]);
      if (out.length >= L.maxSymbolsPerFile) break;
    }
  }
  return out;
}

export function buildIndex(files: SourceFile[]): IndexEntry[] {
  return files.map((f) => ({ path: f.path, language: f.language, lineCount: f.lineCount, symbols: symbolsOf(f.content) }));
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "are", "can", "use", "api", "get", "set"]);

/** 요구사항 문장에 영문으로 적힌 단어(JWT, GitHub 등)를 검색어로 쓴다. */
export function keywordTerms(...texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    for (const m of t.matchAll(/[A-Za-z][A-Za-z0-9_]{2,}/g)) {
      const w = m[0].toLowerCase();
      if (!STOP.has(w) && !out.includes(w)) out.push(w);
    }
  }
  return out;
}

// 한국어 요구사항에 자주 나오는 말과 코드에서 쓰이는 영문 이름의 대응. 파일 선별 호출이 놓친 파일을 키워드로 보완한다.
const HINTS: [RegExp, string[]][] = [
  [/API|엔드포인트|라우트|라우팅/i, ["route", "api", "handler"]],
  [/응답|리스폰스/, ["response"]],
  [/요청|리퀘스트/, ["request"]],
  [/제한|빈도|레이트/, ["limit", "limiter", "rate"]],
  [/인증|로그인|로그아웃|세션|토큰/, ["auth", "login", "session", "token", "jwt"]],
  [/비밀번호|패스워드/, ["password"]],
  [/재설정|리셋/, ["reset"]],
  [/가입|회원/, ["signup", "register", "user"]],
  [/권한|역할|관리자/, ["role", "permission", "admin"]],
  [/결제|구독|주문/, ["payment", "checkout", "stripe", "order"]],
  [/업로드/, ["upload"]],
  [/다운로드/, ["download"]],
  [/검증|유효성/, ["validate", "validation", "schema"]],
  [/저장|보관|데이터베이스|DB/i, ["save", "store", "db", "database", "prisma", "sql"]],
  [/삭제|제거/, ["delete", "remove"]],
  [/다크|테마|색상/, ["theme", "dark"]],
  [/알림|이메일|메일/, ["notification", "email", "mail"]],
  [/검색/, ["search"]],
  [/캐시/, ["cache"]],
  [/로그|기록/, ["log", "history"]],
  [/목록|리스트/, ["list"]],
  [/보안|암호|비밀/, ["security", "secret", "crypto", "encrypt"]],
  [/오류|에러|예외/, ["error", "exception"]],
  [/설정|환경변수/, ["config", "env", "settings"]],
  [/브라우저|화면|UI|페이지/i, ["page", "component", "client"]],
  [/저장소|깃허브|GitHub/i, ["github", "repo", "repository"]],
  [/리포트|보고서/, ["report"]],
  [/요구사항|추출/, ["requirement", "extract"]],
  [/비교|판정/, ["compare", "verdict"]],
];

/** 한국어 문장에서 코드 이름으로 쓰일 만한 영문 검색어를 뽑는다. */
export function koreanHints(...texts: string[]): string[] {
  const joined = texts.join(" ");
  const out: string[] = [];
  for (const [re, terms] of HINTS) if (re.test(joined)) for (const t of terms) if (!out.includes(t)) out.push(t);
  return out;
}

/** 모델이 제안한 검색어를 안전한 형태로만 받는다. */
export function sanitizeTerm(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const s = t.trim().toLowerCase();
  return /^[a-z0-9_.-]{2,40}$/.test(s) ? s : null;
}

export type Candidate = { path: string; score: number; reasons: string[] };

/** 파일마다 관련도 점수를 매긴다: 경로 일치, 심볼 일치, 내용 일치, 모델이 고른 파일. */
export function rankFiles(files: SourceFile[], index: IndexEntry[], terms: string[], picked: string[]): Candidate[] {
  const symbolsByPath = new Map(index.map((i) => [i.path, i.symbols.map((s) => s.toLowerCase())]));
  const out: Candidate[] = [];
  for (const f of files) {
    let score = 0;
    const reasons: string[] = [];
    const pickedAt = picked.indexOf(f.path);
    if (pickedAt >= 0) {
      score += Math.max(3, 8 - pickedAt);
      reasons.push("AI가 관련 파일로 선택");
    }
    const lowerPath = f.path.toLowerCase();
    const lowerContent = f.content.toLowerCase();
    const syms = symbolsByPath.get(f.path) ?? [];
    for (const t of terms) {
      if (lowerPath.includes(t)) {
        score += 3;
        reasons.push(`경로에 "${t}"`);
      }
      if (syms.some((s) => s.includes(t))) {
        score += 2;
        reasons.push(`이름에 "${t}"`);
      }
      let hits = 0;
      for (let at = lowerContent.indexOf(t); at !== -1 && hits < 5; at = lowerContent.indexOf(t, at + t.length)) hits++;
      if (hits > 0) {
        score += hits;
        reasons.push(`내용에 "${t}" ${hits}회`);
      }
    }
    if (score > 0) out.push({ path: f.path, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export type ShownFile = {
  path: string;
  language: string;
  lineCount: number;
  /** 모델에게 실제로 보여 준 줄 수 (앞에서부터) */
  shownLines: number;
  truncated: boolean;
  /** "줄번호| 코드" 형식의 텍스트 */
  text: string;
};

const LINE_CAP = 300;

export function renderFile(f: SourceFile, maxChars: number): ShownFile {
  const lines = f.content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].length > LINE_CAP ? lines[i].slice(0, LINE_CAP) + "…" : lines[i];
    const row = `${i + 1}| ${line}`;
    if (used + row.length + 1 > maxChars && out.length > 0) break;
    out.push(row);
    used += row.length + 1;
  }
  return { path: f.path, language: f.language, lineCount: f.lineCount, shownLines: out.length, truncated: out.length < lines.length, text: out.join("\n") };
}

export type PackResult = {
  shown: Map<string, ShownFile>;
  perRequirement: Map<string, { considered: string[]; dropped: string[]; truncated: string[] }>;
};

/**
 * 요구사항들의 후보 파일을 합쳐 컨텍스트 한도 안에서 담는다. 점수가 높은 파일이 먼저 들어가고,
 * 한도 때문에 빠진 파일은 요구사항별로 dropped에 기록한다.
 */
export function packContext(candidates: Map<string, Candidate[]>, files: Map<string, SourceFile>): PackResult {
  const best = new Map<string, number>();
  for (const list of candidates.values()) for (const c of list) best.set(c.path, Math.max(best.get(c.path) ?? 0, c.score));
  const order = [...best.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);

  const shown = new Map<string, ShownFile>();
  let chars = 0;
  for (const path of order) {
    const file = files.get(path);
    if (!file || shown.size >= L.maxFilesPerCall) continue;
    const r = renderFile(file, L.maxFileChars);
    if (chars + r.text.length > L.maxContextChars) continue;
    shown.set(path, r);
    chars += r.text.length;
  }

  const perRequirement: PackResult["perRequirement"] = new Map();
  for (const [id, list] of candidates) {
    const considered = list.filter((c) => shown.has(c.path)).map((c) => c.path);
    perRequirement.set(id, {
      considered,
      dropped: list.filter((c) => !shown.has(c.path)).map((c) => c.path),
      truncated: considered.filter((p) => shown.get(p)!.truncated),
    });
  }
  return { shown, perRequirement };
}

/** 한 요구사항의 후보를 정리한다: 점수 순 상위 N개. */
export function topCandidates(list: Candidate[]): Candidate[] {
  return list.slice(0, L.maxFilesPerRequirement);
}

export type RequirementLike = Pick<ExtractedRequirement, "id" | "title" | "description" | "sourceQuote">;

// 어떤 파일을 수집할지 경로만으로 판단한다. 순수 함수라 네트워크 없이 테스트할 수 있다.

const CODE_LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  java: "Java",
  kt: "Kotlin",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  c: "C",
  h: "C",
  cpp: "C++",
  hpp: "C++",
  swift: "Swift",
  dart: "Dart",
  scala: "Scala",
  sql: "SQL",
  sh: "Shell",
  vue: "Vue",
  svelte: "Svelte",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  prisma: "Prisma",
  graphql: "GraphQL",
};

// 이 폴더 아래는 통째로 제외한다. (의존성, 빌드 산출물, 편집기·인증 설정)
const EXCLUDED_DIRS = new Set([
  ".git", "node_modules", ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel", ".cache",
  "dist", "build", "out", "coverage", "vendor", "target", "bin", "obj", "pods",
  ".venv", "venv", "__pycache__", ".gradle", ".idea", ".vscode", ".terraform",
  ".ssh", ".aws", ".kube", ".gnupg", ".docker",
]);

const SECRET_EXTENSIONS = new Set(["pem", "key", "p12", "pfx", "jks", "keystore", "ppk", "asc", "gpg", "kdbx", "tfstate", "tfvars"]);
const SECRET_NAMES = new Set([".npmrc", ".pypirc", ".netrc", ".htpasswd", ".git-credentials", ".dockercfg", ".pgpass", ".envrc"]);

// 소유자가 비밀을 둘 가능성이 높은 이름. 정상 코드(credentials.ts 등)가 걸려도 안전한 쪽을 택한다.
const SECRET_NAME_PATTERNS = [/^\.env/, /^id_(rsa|dsa|ecdsa|ed25519)/, /(^|[._-])(secrets?|credentials?)([._-]|$)/, /service[-_]?account.*\.json$/];

// secrets/, credentials/ 같은 이름의 폴더는 안의 파일을 모두 제외한다.
const SECRET_DIR = /^\.?(secrets?|credentials?)$/;

const PRIORITY_DIRS = new Set([
  "src", "app", "lib", "server", "api", "pages", "components", "routes", "controllers", "models", "services", "core", "packages",
]);

// 파일 수 제한에 걸릴 때 맨 마지막에 수집할 폴더
const LOW_PRIORITY_DIRS = new Set([
  "test", "tests", "__tests__", "spec", "e2e", "fixtures", "examples", "example", "docs", "doc", "benchmarks", "scripts", "mocks", "__mocks__",
]);

export type PathClass =
  | { ok: true; extension: string; language: string; tier: 0 | 1 | 2 | 3 }
  | { ok: false; reason: "dir" | "secret" | "generated" | "unsupported" | "unsafe" };

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function classifyPath(path: string): PathClass {
  if (!path || path.startsWith("/") || path.includes("\0") || path.split("/").some((s) => s === "..")) {
    return { ok: false, reason: "unsafe" };
  }
  const segments = path.split("/");
  const name = segments[segments.length - 1];
  const dirs = segments.slice(0, -1).map((d) => d.toLowerCase());
  const lower = name.toLowerCase();
  const ext = extensionOf(name);

  if (dirs.some((d) => EXCLUDED_DIRS.has(d))) return { ok: false, reason: "dir" };
  if (
    dirs.some((d) => SECRET_DIR.test(d)) ||
    SECRET_NAMES.has(lower) ||
    SECRET_EXTENSIONS.has(ext) ||
    SECRET_NAME_PATTERNS.some((re) => re.test(lower))
  ) {
    return { ok: false, reason: "secret" };
  }
  if (/\.min\.(js|css)$/.test(lower) || ext === "map" || ext === "lock" || /(^|-)lock\.(json|yaml)$/.test(lower)) {
    return { ok: false, reason: "generated" };
  }

  // 코드가 아니어도 프로젝트 구조를 설명하는 두 종류는 허용한다.
  if (dirs.length === 0 && (lower === "package.json" || /^readme(\.md)?$/.test(lower))) {
    return { ok: true, extension: ext, language: lower === "package.json" ? "JSON" : "Markdown", tier: 0 };
  }

  const language = CODE_LANGUAGES[ext];
  if (!language) return { ok: false, reason: "unsupported" };
  const tier = dirs.some((d) => LOW_PRIORITY_DIRS.has(d)) ? 3 : dirs.some((d) => PRIORITY_DIRS.has(d)) ? 1 : 2;
  return { ok: true, extension: ext, language, tier };
}

const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

/** 내용 기준 검사. 경로 규칙을 통과해도 개인키가 들어 있거나 바이너리면 버린다. */
export function inspectContent(buf: Buffer): { ok: true; text: string } | { ok: false; reason: "binary" | "secret" } {
  if (buf.includes(0)) return { ok: false, reason: "binary" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return { ok: false, reason: "binary" };
  }
  if (PRIVATE_KEY.test(text)) return { ok: false, reason: "secret" };
  return { ok: true, text: text.replace(/^﻿/, "").replace(/\r\n?/g, "\n") };
}

export function countLines(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

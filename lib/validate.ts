export const INPUT_TYPES = [
  { value: "meeting", label: "회의록", hint: "회의에서 합의된 결정과 할 일을 붙여넣으세요." },
  { value: "feedback", label: "교수 피드백", hint: "교수님이 요청하거나 지적한 내용을 붙여넣으세요." },
  { value: "requirements", label: "요구사항", hint: "기능 요구사항 목록이나 명세를 붙여넣으세요." },
] as const;

export type InputType = (typeof INPUT_TYPES)[number]["value"];

export const LIMITS = { name: 60, textMin: 20, textMax: 20000 } as const;

export type AnalysisMode = "single" | "diff";

export type FormValues = {
  name: string;
  type: InputType;
  text: string;
  repoUrl: string;
  /** 분석 방식. 없으면 단일 문서 분석 */
  mode?: AnalysisMode;
  /** 회의 변경 비교에서 이전 회의록. text는 최신 회의록이다. */
  previousText?: string;
};
export type FieldKey = "name" | "text" | "previousText" | "repoUrl";
export type FormErrors = Partial<Record<FieldKey, string>>;

// 저장소 루트 주소(https://github.com/소유자/저장소)만 허용한다.
export function parseGithubRepo(input: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  const [owner, rawRepo, ...rest] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawRepo || rest.length > 0) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  // GitHub 규칙: 소유자는 영문·숫자·하이픈(39자 이하), 저장소는 영문·숫자·._-(100자 이하). "."과 ".."는 경로 이탈이므로 거부한다.
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) return null;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo };
}

export function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {};

  const name = v.name.trim();
  if (!name) errors.name = "프로젝트 이름을 입력해 주세요.";
  else if (name.length > LIMITS.name)
    errors.name = `프로젝트 이름은 ${LIMITS.name}자 이하로 입력해 주세요.`;

  const diff = v.mode === "diff";
  const textError = (raw: string, empty: string) => {
    const t = raw.trim();
    if (!t) return empty;
    if (t.length < LIMITS.textMin) return `내용이 너무 짧습니다. ${LIMITS.textMin}자 이상 입력해 주세요.`;
    if (t.length > LIMITS.textMax) return `내용이 너무 깁니다. ${LIMITS.textMax.toLocaleString("ko-KR")}자 이하로 줄여 주세요.`;
    return undefined;
  };
  const textMsg = textError(v.text, diff ? "최신 회의록을 입력해 주세요." : "분석할 내용을 입력해 주세요.");
  if (textMsg) errors.text = textMsg;
  if (diff) {
    const prevMsg = textError(v.previousText ?? "", "이전 회의록을 입력해 주세요.");
    if (prevMsg) errors.previousText = prevMsg;
    else if (!textMsg && (v.previousText ?? "").replace(/\s+/g, " ").trim() === v.text.replace(/\s+/g, " ").trim())
      errors.text = "이전 회의록과 최신 회의록이 같습니다. 서로 다른 두 문서를 입력해 주세요.";
  }

  if (!v.repoUrl.trim()) errors.repoUrl = "GitHub 저장소 URL을 입력해 주세요.";
  else if (!parseGithubRepo(v.repoUrl))
    errors.repoUrl =
      "https://github.com/소유자/저장소 형식의 공개 저장소 주소를 입력해 주세요.";

  return errors;
}

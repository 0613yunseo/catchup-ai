export const INPUT_TYPES = [
  { value: "meeting", label: "회의록", hint: "회의에서 합의된 결정과 할 일을 붙여넣으세요." },
  { value: "feedback", label: "교수 피드백", hint: "교수님이 요청하거나 지적한 내용을 붙여넣으세요." },
  { value: "requirements", label: "요구사항", hint: "기능 요구사항 목록이나 명세를 붙여넣으세요." },
] as const;

export type InputType = (typeof INPUT_TYPES)[number]["value"];

export const LIMITS = { name: 60, textMin: 20, textMax: 20000 } as const;

export type FormValues = {
  name: string;
  type: InputType;
  text: string;
  repoUrl: string;
};
export type FieldKey = "name" | "text" | "repoUrl";
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
  const ok = /^[\w.-]+$/;
  if (!repo || !ok.test(owner) || !ok.test(repo)) return null;
  return { owner, repo };
}

export function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {};

  const name = v.name.trim();
  if (!name) errors.name = "프로젝트 이름을 입력해 주세요.";
  else if (name.length > LIMITS.name)
    errors.name = `프로젝트 이름은 ${LIMITS.name}자 이하로 입력해 주세요.`;

  const text = v.text.trim();
  if (!text) errors.text = "분석할 내용을 입력해 주세요.";
  else if (text.length < LIMITS.textMin)
    errors.text = `내용이 너무 짧습니다. ${LIMITS.textMin}자 이상 입력해 주세요.`;
  else if (text.length > LIMITS.textMax)
    errors.text = `내용이 너무 깁니다. ${LIMITS.textMax.toLocaleString("ko-KR")}자 이하로 줄여 주세요.`;

  if (!v.repoUrl.trim()) errors.repoUrl = "GitHub 저장소 URL을 입력해 주세요.";
  else if (!parseGithubRepo(v.repoUrl))
    errors.repoUrl =
      "https://github.com/소유자/저장소 형식의 공개 저장소 주소를 입력해 주세요.";

  return errors;
}

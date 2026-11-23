import { DEFAULT_MODEL } from "./limits.ts";

export type Provider = "openai" | "gemini";

/** Gemini 기본 모델. 항상 최신 Flash 모델을 가리키는 별칭이다. GEMINI_MODEL로 바꿀 수 있다. */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

const MODEL_RE = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * 서버 환경 변수에서 설정을 읽는다. 키 값은 반환 객체 밖으로 내보내지 않도록 호출부에서 다룬다.
 * GEMINI_API_KEY가 있으면 Gemini를, 없으면 OPENAI_API_KEY로 OpenAI를 쓴다.
 */
export function readConfig(env: Record<string, string | undefined>): { apiKey: string | null; model: string; provider: Provider } {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const m = env.GEMINI_MODEL?.trim();
    return { apiKey: geminiKey, model: m && MODEL_RE.test(m) ? m : DEFAULT_GEMINI_MODEL, provider: "gemini" };
  }
  const apiKey = env.OPENAI_API_KEY?.trim() || null;
  const m = env.OPENAI_MODEL?.trim();
  const model = m && MODEL_RE.test(m) ? m : DEFAULT_MODEL;
  return { apiKey, model, provider: "openai" };
}

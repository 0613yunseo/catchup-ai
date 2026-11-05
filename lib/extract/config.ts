import { DEFAULT_MODEL } from "./limits.ts";

/** 서버 환경 변수에서 설정을 읽는다. 키 값은 반환 객체 밖으로 내보내지 않도록 호출부에서 다룬다. */
export function readConfig(env: Record<string, string | undefined>): { apiKey: string | null; model: string } {
  const apiKey = env.OPENAI_API_KEY?.trim() || null;
  const m = env.OPENAI_MODEL?.trim();
  const model = m && /^[A-Za-z0-9._:-]{1,64}$/.test(m) ? m : DEFAULT_MODEL;
  return { apiKey, model };
}

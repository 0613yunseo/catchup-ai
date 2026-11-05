// OpenAI 공식 SDK 클라이언트 생성. 서버에서만 가져다 쓴다. 키는 인자로만 받고 어디에도 기록하지 않는다.
import OpenAI from "openai";
import type { ResponsesClient } from "./extract.ts";

export function createOpenAIClient(apiKey: string): ResponsesClient {
  // SDK의 자동 재시도는 끄고, 재시도는 extract.ts에서 횟수를 제한해 직접 한다.
  return new OpenAI({ apiKey, maxRetries: 0 }) as unknown as ResponsesClient;
}

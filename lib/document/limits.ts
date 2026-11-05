import { LIMITS } from "../validate.ts";

export const DOC_LIMITS = {
  // Vercel 함수 본문 한도(약 4.5MB)보다 작게 둔다.
  maxBytes: 4 * 1024 * 1024,
  // 본문에는 multipart 경계 등이 더해진다.
  maxBodyBytes: 4 * 1024 * 1024 + 64 * 1024,
  textMax: LIMITS.textMax,
  maxPdfPages: 50,
  // DOCX는 압축 파일이라 풀었을 때의 크기를 제한한다. (압축 폭탄 방지)
  maxDocxUncompressed: 30 * 1024 * 1024,
} as const;

export const FORMATS = ["pdf", "docx", "txt"] as const;
export type DocFormat = (typeof FORMATS)[number];

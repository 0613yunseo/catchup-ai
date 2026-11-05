// 원문 인용 검증. 공백·줄바꿈 차이만 무시하고, 글자 자체는 한 글자도 다르면 안 된다.
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 인용이 문서 안에 그대로 들어 있는지 확인한다. 요약·번역·부분 수정은 통과하지 못한다. */
export function quoteExistsInDocument(document: string, quote: string, minLength: number): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < minLength) return false;
  return normalizeForMatch(document).includes(q);
}

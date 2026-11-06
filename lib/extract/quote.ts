import { SOURCE_MARKER } from "../document/source-marker.ts";

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
  // 여러 출처를 합친 문서의 출처 표시는 원문이 아니다. 표시를 포함한 인용(출처에 걸친 인용)은 거부한다.
  if (SOURCE_MARKER.test(q)) return false;
  return normalizeForMatch(document).includes(q);
}

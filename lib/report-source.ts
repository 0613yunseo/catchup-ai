import type { Report } from "@/lib/report";

// 리포트 데이터의 유일한 진입점. 분석 API·DB가 생기면 이 함수만 바꾼다.
// 주의: cacheComponents가 켜져 있어 실제 fetch를 넣으면 호출부를 <Suspense>로 감싸야 한다.
export async function getReport(): Promise<Report | null> {
  return null;
}

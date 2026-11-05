// 수집 범위 제한. 대형 저장소에서도 응답 시간과 메모리가 일정하게 유지되도록 한다.
export type Limits = {
  /** 수집할 파일 수 상한 */
  maxFiles: number;
  /** 파일 하나의 크기 상한(바이트) */
  maxFileBytes: number;
  /** 수집 내용 총량 상한(바이트) */
  maxTotalBytes: number;
  /** 압축된 아카이브를 읽는 상한(바이트). 넘으면 거기서 중단한다. */
  maxArchiveBytes: number;
  /** GitHub JSON API 호출 하나의 제한 시간(ms) */
  jsonTimeoutMs: number;
  /** 조회 전체 제한 시간(ms) */
  totalTimeoutMs: number;
  /** 저장소 크기(KB)가 이 값을 넘으면 일부만 읽을 수 있다고 경고한다. */
  largeRepoKb: number;
};

export const DEFAULT_LIMITS: Limits = {
  maxFiles: 60,
  maxFileBytes: 100_000,
  maxTotalBytes: 1_500_000,
  maxArchiveBytes: 30_000_000,
  jsonTimeoutMs: 8_000,
  totalTimeoutMs: 25_000,
  largeRepoKb: 200_000,
};

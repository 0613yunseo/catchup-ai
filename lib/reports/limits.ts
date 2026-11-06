// 클라우드 저장 한도. 브라우저와 서버가 함께 쓰므로 node 전용 모듈을 가져오지 않는다.
export const REPORT_LIMITS = {
  /** 리포트 JSON 최대 크기(바이트). DB의 report_data 크기 제한(1MB)보다 작다. */
  maxBytes: 900_000,
  maxRequirements: 100,
  projectNameMax: 200,
  /** 사용자당 저장할 수 있는 기록 수 */
  maxPerUser: 100,
} as const;

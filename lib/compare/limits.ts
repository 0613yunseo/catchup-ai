// 비교 비용·시간 상한. 대회용 공용 키를 아끼고 서버리스 실행 시간 안에 끝나도록 정한다.
export const COMPARE_LIMITS = {
  /** 한 번에 비교할 요구사항 수 (추출 상한과 같다) */
  maxRequirements: 30,
  /** 한 번의 판정 호출에 담는 요구사항 수. 넘으면 호출을 나눈다. */
  batchSize: 10,
  /** 판정 호출 한 번에 보여 주는 코드 총 글자 수 */
  maxContextChars: 60_000,
  /** 파일 하나당 글자 수. 넘으면 앞부분만 보여 주고 표시한다. */
  maxFileChars: 12_000,
  /** 한 요구사항에 대해 고르는 후보 파일 수 */
  maxFilesPerRequirement: 8,
  /** 판정 호출 한 번에 보여 주는 파일 수 */
  maxFilesPerCall: 18,
  /** 수집한 코드가 이 글자 수 이하이면 파일 선별 호출 없이 전부 보여 준다. */
  sendAllBelowChars: 45_000,
  /** 파일 목록에 적는 심볼 수 */
  maxSymbolsPerFile: 12,
  maxSearchTerms: 8,
  maxSelectFiles: 8,

  maxOutputTokensSelect: 3000,
  maxOutputTokensVerdict: 9000,
  callTimeoutMs: 60_000,
  totalTimeoutMs: 105_000,
  retryMinRemainingMs: 20_000,
  /** 한 요청에서 모델 호출 총 횟수 상한 (재시도 포함) */
  maxModelCalls: 8,

  evidencePerRequirement: 3,
  evidenceMaxLines: 60,
  evidenceMaxChars: 6000,
  quoteMin: 6,
  quoteMax: 3000,
  reasonMax: 600,
  missingMax: 5,
  missingItemMax: 200,
  recommendationMax: 300,
} as const;

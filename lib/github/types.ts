// GitHub 저장소 조회 결과 타입. 서버 모듈, API 응답, 화면이 함께 쓴다. (런타임 코드 없음)

export type RepoRef = { owner: string; repo: string };

export type RepositoryInfo = {
  owner: string;
  repo: string;
  /** "owner/repo" */
  name: string;
  description: string | null;
  defaultBranch: string;
  /** 모든 파일 내용이 이 커밋 기준이다. 같은 SHA로 다시 조회하면 같은 내용을 얻는다. */
  commitSha: string;
  committedAt: string | null;
  htmlUrl: string;
};

/** 서버가 수집한 소스 파일 한 건. content는 서버 안에서만 쓰고 브라우저로 보내지 않는다. */
export type SourceFile = {
  /** 저장소 루트 기준 경로. 리포트의 근거 경로로 그대로 쓴다. */
  path: string;
  extension: string;
  language: string;
  /** UTF-8 텍스트. 줄바꿈은 \n으로 통일했고, 줄 번호는 content.split("\n")의 인덱스 + 1이다. */
  content: string;
  lineCount: number;
  /** 원본 바이트 크기 */
  size: number;
  /** git blob SHA (파일 단위 식별자) */
  blobSha: string;
};

/** 브라우저로 보내는 파일 정보. 내용은 포함하지 않는다. */
export type SourceFileInfo = Omit<SourceFile, "content">;

export type FilesSummary = {
  /** 커밋 트리의 전체 파일 수 */
  totalFiles: number;
  /** 분석 가능한 코드 파일 후보 수 */
  candidates: number;
  /** 실제로 내용을 수집한 파일 수 */
  collected: number;
  /** 형식·경로·비밀정보 규칙으로 제외된 파일 수 */
  excluded: number;
  /** 후보였지만 크기·개수·시간 제한이나 읽기 실패로 수집하지 못한 파일 수 */
  limited: number;
  /** 수집한 내용의 총 바이트 */
  totalBytes: number;
};

export type WarningCode =
  | "TREE_TRUNCATED"
  | "FILE_LIMIT"
  | "SIZE_LIMIT"
  | "TOTAL_LIMIT"
  | "ARCHIVE_LIMIT"
  | "TIMEOUT"
  | "READ_FAILED"
  | "MISSING_IN_ARCHIVE"
  | "CONTENT_MISMATCH"
  | "SECRET_CONTENT"
  | "BINARY_CONTENT"
  | "LARGE_REPOSITORY"
  | "NO_ANALYZABLE_FILES";

export type InspectWarning = { code: WarningCode; message: string; paths?: string[] };

export type RateLimitInfo = { remaining: number; resetAt: string | null };

/** 서버 안에서 쓰는 전체 결과 (파일 내용 포함). 이후 AI 분석 모듈이 이것을 받는다. */
export type CollectedRepository = {
  repository: RepositoryInfo;
  files: SourceFile[];
  summary: FilesSummary;
  warnings: InspectWarning[];
  rateLimit: RateLimitInfo | null;
};

/** POST /api/github/inspect 성공 응답의 data. 파일 내용은 없다. */
export type InspectResponse = {
  repository: RepositoryInfo;
  files: SourceFileInfo[];
  summary: FilesSummary;
  warnings: InspectWarning[];
  rateLimit: RateLimitInfo | null;
};

export type InspectErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_URL"
  | "NOT_FOUND"
  | "PRIVATE_REPOSITORY"
  | "EMPTY_REPOSITORY"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "UNAVAILABLE_FOR_LEGAL_REASONS"
  | "GITHUB_UNAVAILABLE"
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "NETWORK"
  | "INTERNAL";

export type InspectErrorInfo = {
  code: InspectErrorCode;
  message: string;
  /** RATE_LIMITED일 때 다시 시도할 수 있기까지 남은 초 */
  retryAfterSec?: number;
};

export type InspectOutcome =
  | { ok: true; data: InspectResponse }
  | { ok: false; error: InspectErrorInfo };

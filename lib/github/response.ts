import type { CollectedRepository, InspectResponse, SourceFile, SourceFileInfo } from "./types.ts";

function withoutContent(file: SourceFile): SourceFileInfo {
  const info: Partial<SourceFile> = { ...file };
  delete info.content;
  return info as SourceFileInfo;
}

/** 브라우저로 보낼 형태로 줄인다. 파일 내용(content)은 서버 밖으로 나가지 않는다. */
export function toInspectResponse(c: CollectedRepository): InspectResponse {
  return {
    repository: c.repository,
    files: c.files.map(withoutContent),
    summary: c.summary,
    warnings: c.warnings,
    rateLimit: c.rateLimit,
  };
}

import { DOC_LIMITS } from "./limits.ts";

export type DocErrorCode =
  | "INVALID_REQUEST"
  | "NO_FILE"
  | "MULTIPLE_FILES"
  | "UNSUPPORTED_TYPE"
  | "TYPE_MISMATCH"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "CORRUPT"
  | "ENCRYPTED"
  | "NO_TEXT"
  | "TOO_MANY_PAGES"
  | "TEXT_TOO_LONG"
  | "INTERNAL";

const mb = (n: number) => `${Math.round(n / 1024 / 1024)}MB`;

export const DOC_MESSAGES: Record<DocErrorCode, string> = {
  INVALID_REQUEST: "업로드 요청 형식이 올바르지 않습니다. 파일 한 개를 선택해 다시 시도해 주세요.",
  NO_FILE: "업로드할 파일이 없습니다. PDF, DOCX, TXT 파일을 선택해 주세요.",
  MULTIPLE_FILES: "파일은 한 번에 한 개만 올릴 수 있습니다.",
  UNSUPPORTED_TYPE: "지원하지 않는 파일 형식입니다. PDF, DOCX, TXT 파일만 올릴 수 있습니다.",
  TYPE_MISMATCH: "파일 내용이 확장자와 맞지 않습니다. 파일이 손상되었거나 다른 형식일 수 있습니다.",
  FILE_TOO_LARGE: `파일이 너무 큽니다. ${mb(DOC_LIMITS.maxBytes)} 이하의 파일만 올릴 수 있습니다.`,
  EMPTY_FILE: "빈 파일입니다. 내용이 있는 파일을 올려 주세요.",
  CORRUPT: "문서를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다. 다른 파일로 시도하거나 내용을 직접 붙여넣어 주세요.",
  ENCRYPTED: "암호로 보호된 문서입니다. 암호를 해제한 파일을 올려 주세요.",
  NO_TEXT:
    "문서에서 텍스트를 찾지 못했습니다. 스캔한 이미지 PDF는 지원하지 않습니다(OCR 미지원). 텍스트가 있는 파일을 올리거나 내용을 직접 붙여넣어 주세요.",
  TOO_MANY_PAGES: `페이지가 너무 많습니다. ${DOC_LIMITS.maxPdfPages}쪽 이하의 PDF만 지원합니다.`,
  TEXT_TOO_LONG: `추출한 텍스트가 너무 깁니다. ${DOC_LIMITS.textMax.toLocaleString("ko-KR")}자 이하로 줄여서 올려 주세요.`,
  INTERNAL: "문서를 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export class DocumentError extends Error {
  code: DocErrorCode;
  constructor(code: DocErrorCode) {
    super(DOC_MESSAGES[code]);
    this.name = "DocumentError";
    this.code = code;
  }
  toInfo() {
    return { code: this.code, message: this.message };
  }
}

export function httpStatusFor(code: DocErrorCode): number {
  switch (code) {
    case "FILE_TOO_LARGE":
    case "TEXT_TOO_LONG":
      return 413;
    case "UNSUPPORTED_TYPE":
      return 415;
    case "INTERNAL":
      return 500;
    case "INVALID_REQUEST":
    case "NO_FILE":
    case "MULTIPLE_FILES":
      return 400;
    default:
      return 422;
  }
}

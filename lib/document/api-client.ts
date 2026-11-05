// 브라우저에서 /api/documents/extract를 부르는 함수. 서버 전용 코드를 가져오지 않는다.
import { DOC_LIMITS, type DocFormat } from "./limits.ts";

export type UploadedDocument = { fileName: string; format: DocFormat; text: string; chars: number; pages: number | null };
export type UploadOutcome =
  | { ok: true; data: UploadedDocument }
  | { ok: false; error: { code: string; message: string } };

export const ACCEPT = ".pdf,.docx,.txt";

export async function uploadDocument(file: File, signal?: AbortSignal): Promise<UploadOutcome> {
  // 서버가 다시 검사한다. 여기서는 불필요한 전송만 막는다.
  if (file.size > DOC_LIMITS.maxBytes) {
    return { ok: false, error: { code: "FILE_TOO_LARGE", message: "파일이 너무 큽니다. 4MB 이하의 파일만 올릴 수 있습니다." } };
  }
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/documents/extract", { method: "POST", body: form, signal });
    const body = (await res.json()) as UploadOutcome;
    if (body && typeof body === "object" && "ok" in body) return body;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
  }
  return {
    ok: false,
    error: { code: "NETWORK", message: "서버에 연결하지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요." },
  };
}

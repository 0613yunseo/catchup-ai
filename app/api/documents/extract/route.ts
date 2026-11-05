import { DocumentError, httpStatusFor } from "@/lib/document/errors";
import { extractDocument } from "@/lib/document/extract";
import { DOC_LIMITS } from "@/lib/document/limits";

export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function fail(e: DocumentError) {
  return Response.json({ ok: false, error: e.toInfo() }, { status: httpStatusFor(e.code), headers: NO_STORE });
}

// POST /api/documents/extract  (multipart/form-data, 필드 이름 "file", 파일 1개)
// 파일은 메모리에서만 처리하고 저장하지 않는다. 파일 내용과 이름은 기록하지 않는다.
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return fail(new DocumentError("INVALID_REQUEST"));
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > DOC_LIMITS.maxBodyBytes) return fail(new DocumentError("FILE_TOO_LARGE"));

  const started = Date.now();
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return fail(new DocumentError("INVALID_REQUEST"));
    }
    const files = form.getAll("file");
    if (files.length === 0) return fail(new DocumentError("NO_FILE"));
    if (files.length > 1) return fail(new DocumentError("MULTIPLE_FILES"));
    const file = files[0];
    if (typeof file === "string") return fail(new DocumentError("NO_FILE"));
    if (file.size > DOC_LIMITS.maxBytes) return fail(new DocumentError("FILE_TOO_LARGE"));

    const doc = await extractDocument(file.name, new Uint8Array(await file.arrayBuffer()));
    console.info("document.ok", JSON.stringify({ format: doc.format, bytes: file.size, chars: doc.chars, ms: Date.now() - started }));
    return Response.json(
      { ok: true, data: { fileName: file.name.slice(0, 120), format: doc.format, text: doc.text, chars: doc.chars, pages: doc.pages ?? null } },
      { headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof DocumentError) {
      console.warn("document.fail", JSON.stringify({ code: e.code }));
      return fail(e);
    }
    console.error("document.error", e instanceof Error ? e.name : "unknown");
    return fail(new DocumentError("INTERNAL"));
  }
}

import { UploadIcon } from "@/components/icons";

// 파일 업로드 확장 자리. 입력 요소가 없어 아무것도 업로드되지 않는다.
export function UploadPlaceholder() {
  return (
    <div
      aria-disabled="true"
      className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-faint"
    >
      <UploadIcon className="size-4 shrink-0" />
      <p>
        <span className="font-medium text-muted">파일 업로드</span> · .md, .txt, .pdf 지원 예정 (준비 중)
      </p>
    </div>
  );
}

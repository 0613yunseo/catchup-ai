import { INPUT_TYPES, LIMITS, type InputType } from "@/lib/validate";

type Props = {
  kind: InputType;
  /** 같은 화면에 편집기가 둘일 때 구분한다. 기본은 단일 문서 분석의 값이다. */
  id?: string;
  /** 표시 이름. 기본은 문서 유형 이름이다. */
  label?: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
};

// 문서 입력 편집기. 다중 문서 목록이나 파일 업로드가 생기면 이 컴포넌트를 문서 1건 단위로 쓰고
// 바깥(문서 단계)에 목록·업로드를 둔다.
export function DocumentEditor({ kind, id = "f-text", label, hint, value, error, onChange, onBlur }: Props) {
  const meta = INPUT_TYPES.find((t) => t.value === kind)!;
  const name = label ?? meta.label;
  const len = value.trim().length;
  const lines = value === "" ? 0 : value.split("\n").length;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {name} 내용
        <span className="ml-2 font-normal text-muted">{hint ?? meta.hint}</span>
      </label>
      <div
        className={`overflow-hidden rounded-lg border bg-surface focus-within:border-accent ${
          error ? "border-bad" : "border-line-strong"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-3 py-1.5 text-sm text-muted">
          <span>{name}</span>
          <span className="tabular-nums text-faint">
            {len.toLocaleString("ko-KR")} / {LIMITS.textMax.toLocaleString("ko-KR")}자
          </span>
        </div>
        <textarea
          id={id}
          rows={14}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `e-${id.slice(2)}` : undefined}
          className="block min-h-[22rem] w-full resize-y bg-transparent px-4 py-3 text-base leading-7 outline-none placeholder:text-faint sm:text-sm sm:leading-7"
        />
        <div className="border-t border-line bg-sunken px-3 py-1.5 text-xs tabular-nums text-faint">
          {lines}줄
        </div>
      </div>
      {error && (
        <p id={`e-${id.slice(2)}`} className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

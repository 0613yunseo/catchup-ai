"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { btnPrimary } from "@/components/button-styles";
import { PendingNotice } from "@/components/analyze/pending-notice";
import {
  INPUT_TYPES,
  LIMITS,
  validate,
  type FieldKey,
  type FormErrors,
  type FormValues,
} from "@/lib/validate";

const INITIAL: FormValues = { name: "", type: "meeting", text: "", repoUrl: "" };
const ORDER: FieldKey[] = ["name", "text", "repoUrl"];

const inputCls =
  "w-full scroll-mt-24 rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-faint aria-[invalid=true]:border-bad sm:text-sm";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1.5 text-sm text-bad">
      {message}
    </p>
  ) : null;
}

export function AnalyzeForm() {
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState<FormValues | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitted) noticeRef.current?.focus();
  }, [submitted]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    setSubmitted(null);
    if (key !== "type" && errors[key as FieldKey]) {
      setErrors((e) => ({ ...e, [key]: validate(next)[key as FieldKey] }));
    }
  }

  function blur(key: FieldKey) {
    setErrors((e) => ({ ...e, [key]: validate(values)[key] }));
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const found = validate(values);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      setSubmitted(null);
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setSubmitted(values);
  }

  const typeMeta = INPUT_TYPES.find((t) => t.value === values.type)!;
  const textLen = values.text.trim().length;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <label htmlFor="f-name" className="mb-1.5 block text-sm font-medium">
          프로젝트 이름
        </label>
        <input
          id="f-name"
          type="text"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          onBlur={() => blur("name")}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "e-name" : undefined}
          autoComplete="off"
          className={inputCls}
        />
        <FieldError id="e-name" message={errors.name} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">입력 유형</legend>
        <div className="grid grid-cols-3 gap-2">
          {INPUT_TYPES.map((t) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface px-2 py-2 text-center text-sm has-[:checked]:border-accent has-[:checked]:font-semibold has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={values.type === t.value}
                onChange={() => update("type", t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="f-text" className="mb-1 block text-sm font-medium">
          {typeMeta.label} 내용
        </label>
        <p id="h-text" className="mb-1.5 text-sm text-muted">
          {typeMeta.hint}
        </p>
        <textarea
          id="f-text"
          rows={10}
          value={values.text}
          onChange={(e) => update("text", e.target.value)}
          onBlur={() => blur("text")}
          aria-invalid={errors.text ? true : undefined}
          aria-describedby={errors.text ? "h-text e-text" : "h-text"}
          className={`${inputCls} resize-y leading-relaxed`}
        />
        <div className="mt-1.5 flex justify-between gap-4">
          <div>
            <FieldError id="e-text" message={errors.text} />
          </div>
          <p className="ml-auto shrink-0 text-sm tabular-nums text-faint">
            {textLen.toLocaleString("ko-KR")} / {LIMITS.textMax.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="f-repoUrl" className="mb-1.5 block text-sm font-medium">
          공개 GitHub 저장소 URL
        </label>
        <input
          id="f-repoUrl"
          type="url"
          inputMode="url"
          value={values.repoUrl}
          onChange={(e) => update("repoUrl", e.target.value)}
          onBlur={() => blur("repoUrl")}
          placeholder="https://github.com/소유자/저장소"
          aria-invalid={errors.repoUrl ? true : undefined}
          aria-describedby={errors.repoUrl ? "e-repoUrl" : undefined}
          autoComplete="off"
          className={`${inputCls} font-mono`}
        />
        <FieldError id="e-repoUrl" message={errors.repoUrl} />
      </div>

      <button type="submit" className={btnPrimary}>
        분석 시작
      </button>

      {submitted && (
        <PendingNotice
          ref={noticeRef}
          values={submitted}
          onEdit={() => {
            setSubmitted(null);
            document.getElementById("f-name")?.focus();
          }}
        />
      )}
    </form>
  );
}

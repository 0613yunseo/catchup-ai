"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { AnalysisPipeline } from "@/components/analyze/analysis-pipeline";
import { DocumentEditor } from "@/components/analyze/document-editor";
import { ExtractionResult } from "@/components/analyze/extraction-result";
import { GithubPanel } from "@/components/analyze/github-panel";
import { StepSection } from "@/components/analyze/step-section";
import { UploadPlaceholder } from "@/components/analyze/upload-placeholder";
import { useExtraction } from "@/components/analyze/use-extraction";
import { useRepoInspection } from "@/components/analyze/use-repo-inspection";
import type { StageResult } from "@/lib/analysis";
import {
  INPUT_TYPES,
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

export function AnalyzeWorkspace() {
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const inspection = useRepoInspection(values.repoUrl);
  // 추출 결과는 이름·유형·문서가 같을 때만 보여 준다.
  const extraction = useExtraction(JSON.stringify([values.name.trim(), values.type, values.text.trim()]));
  const panelRef = useRef<HTMLDivElement>(null);
  const extractStatus = extraction.state.status;

  // 추출이 끝나면(성공·실패) 결과 영역으로 포커스를 옮긴다.
  useEffect(() => {
    if (extractStatus === "success" || extractStatus === "error") panelRef.current?.focus();
  }, [extractStatus]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (key !== "type" && errors[key as FieldKey]) {
      setErrors((e) => ({ ...e, [key]: validate(next)[key as FieldKey] }));
    }
  }

  function blur(key: FieldKey) {
    setErrors((e) => ({ ...e, [key]: validate(values)[key] }));
  }

  // GitHub 저장소 확인: 저장소 주소만 검증하고 실제 조회를 요청한다.
  function inspectRepo() {
    const err = validate(values).repoUrl;
    setErrors((e) => ({ ...e, repoUrl: err }));
    if (err) {
      document.getElementById("f-repoUrl")?.focus();
      return;
    }
    void inspection.inspect();
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const found = validate(values);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    void extraction.run({ projectName: values.name, documentType: values.type, text: values.text });
  }

  // 단계 완료는 입력값이 검증을 통과하는지로만 판단한다.
  const found = validate(values);
  const done = [
    values.name.trim() !== "" && !found.name,
    values.text.trim() !== "" && !found.text,
    values.repoUrl.trim() !== "" && !found.repoUrl,
  ];
  const current = done.indexOf(false);
  const stepState = (i: number) => (done[i] ? "done" : i === current ? "current" : "todo");

  const st = inspection.state;
  const githubStage: StageResult | undefined =
    st.status === "loading"
      ? { state: "running" }
      : st.status === "success"
        ? { state: "done" }
        : st.status === "error"
          ? { state: "error", error: st.error.message }
          : undefined;

  const ex = extraction.state;
  const extractStage: StageResult | undefined =
    ex.status === "loading"
      ? { state: "running" }
      : ex.status === "success"
        ? { state: "done" }
        : ex.status === "error"
          ? { state: "error", error: ex.error.message }
          : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-12"
    >
      <div>
        <StepSection step={1} title="프로젝트" state={stepState(0)}>
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
              className={`${inputCls} sm:max-w-md`}
            />
            <FieldError id="e-name" message={errors.name} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">문서 유형</legend>
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              {INPUT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface px-2 py-2 text-center text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
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
        </StepSection>

        <StepSection step={2} title="문서" state={stepState(1)}>
          <DocumentEditor
            kind={values.type}
            value={values.text}
            error={errors.text}
            onChange={(v) => update("text", v)}
            onBlur={() => blur("text")}
          />
          <UploadPlaceholder />
        </StepSection>

        <StepSection step={3} title="GitHub 저장소" state={stepState(2)} last>
          <div>
            <label htmlFor="f-repoUrl" className="mb-1.5 block text-sm font-medium">
              공개 저장소 URL
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
              className={`${inputCls} font-mono sm:max-w-xl`}
            />
            <FieldError id="e-repoUrl" message={errors.repoUrl} />
            <button
              type="button"
              onClick={inspectRepo}
              disabled={inspection.state.status === "loading"}
              className={`${btnSecondary} mt-3 disabled:opacity-60`}
            >
              {inspection.state.status === "loading" ? "확인 중…" : "저장소 확인"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={extractStatus === "loading"} className={`${btnPrimary} disabled:opacity-60`}>
              {extractStatus === "loading" ? "추출 중…" : "분석 시작"}
            </button>
            <p className="text-sm text-faint">
              AI가 문서에서 요구사항을 추출합니다. GitHub 코드 비교와 리포트 생성은 아직 연결되지 않았습니다.
            </p>
          </div>

          <ExtractionResult state={extraction.state} onRetry={extraction.retry} panelRef={panelRef} />
        </StepSection>
      </div>

      <aside aria-label="분석 정보" className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <GithubPanel repoUrl={values.repoUrl} state={inspection.state} onRetry={inspectRepo} />
        <AnalysisPipeline status="unavailable" stages={{ github: githubStage, extract: extractStage }} />
      </aside>
    </form>
  );
}

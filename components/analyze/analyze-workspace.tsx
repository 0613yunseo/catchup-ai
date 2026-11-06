"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary } from "@/components/button-styles";
import { AnalysisPipeline } from "@/components/analyze/analysis-pipeline";
import { AttachmentPanel } from "@/components/analyze/attachment-panel";
import { ComparisonResult } from "@/components/analyze/comparison-result";
import { DiffResult } from "@/components/analyze/diff-result";
import { DocumentEditor } from "@/components/analyze/document-editor";
import { ExtractionResult } from "@/components/analyze/extraction-result";
import { GithubPanel } from "@/components/analyze/github-panel";
import { StepSection } from "@/components/analyze/step-section";
import { useAttachments } from "@/components/analyze/use-attachments";
import { useComparison } from "@/components/analyze/use-comparison";
import { useDiff } from "@/components/analyze/use-diff";
import { useExtraction } from "@/components/analyze/use-extraction";
import { useRepoInspection } from "@/components/analyze/use-repo-inspection";
import type { StageResult } from "@/lib/analysis";
import { attachChanges } from "@/lib/diff/to-report";
import { composeDocument } from "@/lib/document/attachments";
import { NEW_ANALYSIS_EVENT, resetAnalysisActivity, setAnalysisActivity } from "@/lib/new-analysis";
import {
  INPUT_TYPES,
  validate,
  type FieldKey,
  type FormErrors,
  type FormValues,
} from "@/lib/validate";

const INITIAL: FormValues = { name: "", type: "meeting", text: "", repoUrl: "", mode: "single", previousText: "" };
const ORDER: FieldKey[] = ["name", "previousText", "text", "repoUrl"];

const FILE_BUSY = "파일 추출이 끝난 뒤 분석을 시작해 주세요.";
const GATE_NOT_CLICKED = "분석을 시작하기 전에 저장소 확인 버튼을 눌러주세요.";

const inputCls =
  "w-full scroll-mt-24 rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-fg placeholder:text-faint aria-[invalid=true]:border-bad sm:text-sm";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1.5 text-sm text-bad">
      {message}
    </p>
  ) : null;
}

// 새 분석이 요청되면 세션 번호를 올려 분석 화면을 통째로 새로 만든다.
// 입력, 첨부, 결과, 진행 중이던 요청(화면이 사라질 때 취소됨)이 모두 없어지고, 취소된 요청의 늦은 응답은 반영되지 않는다.
export function AnalyzeWorkspace() {
  const [session, setSession] = useState(0);
  useEffect(() => {
    const onNew = () => setSession((n) => n + 1);
    window.addEventListener(NEW_ANALYSIS_EVENT, onNew);
    return () => window.removeEventListener(NEW_ANALYSIS_EVENT, onNew);
  }, []);
  return <AnalyzeSession key={session} fresh={session > 0} />;
}

type Flags = Partial<Record<FieldKey, boolean>>;

function AnalyzeSession({ fresh }: { fresh: boolean }) {
  const [values, setValues] = useState<FormValues>(INITIAL);
  // 오류 문구는 저장하지 않고 현재 입력에서 계산한다. flagged는 사용자가 확인을 시도했거나 입력란을 벗어난 항목이다.
  const [flagged, setFlagged] = useState<Flags>({});
  const [gateAttempted, setGateAttempted] = useState(false);
  const inspection = useRepoInspection(values.repoUrl);
  const diffMode = values.mode === "diff";
  const repoVerified = inspection.state.status === "success";

  // 직접 입력과 첨부파일 텍스트를 합친 문서가 분석·검증·결과 키의 기준이다. 영역(이전/최신)마다 파일 목록이 따로 있다.
  const latestFiles = useAttachments(() => values.text);
  const prevFiles = useAttachments(() => values.previousText ?? "");
  const latestDoc = useMemo(() => composeDocument(values.text, latestFiles.ready), [values.text, latestFiles.ready]);
  const prevDoc = useMemo(() => composeDocument(values.previousText ?? "", prevFiles.ready), [values.previousText, prevFiles.ready]);
  const effective = useMemo<FormValues>(
    () => ({ ...values, text: latestDoc.text, previousText: diffMode ? prevDoc.text : "" }),
    [values, latestDoc.text, prevDoc.text, diffMode],
  );

  // 추출·변경 비교 결과는 방식·이름·유형·합친 문서가 같을 때만 보여 준다. 파일을 추가·삭제하면 합친 문서가 바뀌어 이전 결과는 숨겨진다.
  const extractKey = JSON.stringify([
    effective.mode,
    effective.name.trim(),
    effective.type,
    effective.text.trim(),
    diffMode ? (effective.previousText ?? "").trim() : "",
  ]);
  const extraction = useExtraction(extractKey);
  const diff = useDiff(extractKey);
  const panelRef = useRef<HTMLDivElement>(null);
  const extractStatus = diffMode ? diff.state.status : extraction.state.status;

  // 코드 비교는 추출 결과와 GitHub 조회 결과(커밋 SHA)를 그대로 재사용한다. 둘 중 하나가 바뀌면 이전 비교 결과는 숨겨진다.
  const diffData = diff.state.status === "success" ? diff.state.data : null;
  const extractedReqs = diffMode ? (diffData?.requirements ?? null) : extraction.state.status === "success" ? extraction.state.data.requirements : null;
  const commitSha = inspection.state.status === "success" ? inspection.state.data.repository.commitSha : undefined;
  // 같은 입력으로 추출·변경 분석을 다시 실행하면 결과가 달라질 수 있으므로, 결과 생성 시각도 키에 넣어 이전 비교 결과가 새 요구사항에 남지 않게 한다.
  const resultId = diffMode ? (diffData?.diffedAt ?? "") : extraction.state.status === "success" ? extraction.state.data.extractedAt : "";
  const comparison = useComparison(JSON.stringify([extractKey, values.repoUrl.trim(), commitSha ?? "", resultId]));
  const comparePanelRef = useRef<HTMLDivElement>(null);
  const compareStatus = comparison.state.status;

  // 새 분석으로 시작했으면 첫 입력란에 포커스를 둔다.
  useEffect(() => {
    if (fresh) document.getElementById("f-name")?.focus();
  }, [fresh]);

  // 추출이 끝나면(성공·실패) 결과 영역으로 포커스를 옮긴다.
  useEffect(() => {
    if (extractStatus === "success" || extractStatus === "error") panelRef.current?.focus();
  }, [extractStatus]);

  useEffect(() => {
    if (compareStatus === "success" || compareStatus === "error") comparePanelRef.current?.focus();
  }, [compareStatus]);

  // 입력 검증 결과(합친 문서 기준). 파일 추출이 끝나지 않았으면 분석을 시작할 수 없다.
  const found = useMemo(() => {
    const f = validate(effective);
    if (latestFiles.busy && !f.text) f.text = FILE_BUSY;
    if (diffMode && prevFiles.busy && !f.previousText) f.previousText = FILE_BUSY;
    return f;
  }, [effective, latestFiles.busy, prevFiles.busy, diffMode]);
  const errors: FormErrors = Object.fromEntries(
    (Object.keys(found) as FieldKey[]).filter((k) => flagged[k]).map((k) => [k, found[k]]),
  );

  // 저장소 확인을 거치지 않았으면 분석을 시작할 수 없다. 확인에 성공하면 이 안내는 저절로 사라진다.
  const repoGate =
    gateAttempted && !found.repoUrl && !repoVerified
      ? inspection.state.status === "loading"
        ? "저장소 확인이 끝난 뒤 분석을 시작해 주세요."
        : inspection.state.status === "error"
          ? "저장소 확인에 실패했습니다. 주소를 확인한 뒤 저장소 확인 버튼을 다시 눌러주세요."
          : GATE_NOT_CLICKED
      : undefined;
  const repoError = errors.repoUrl ?? repoGate;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    // 저장소 주소를 확인한 뒤 바꾸면 이전 확인 결과는 무효이므로 다시 확인하도록 안내한다.
    if (key === "repoUrl" && repoVerified && String(value).trim() !== values.repoUrl.trim()) setGateAttempted(true);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function blur(key: FieldKey) {
    setFlagged((f) => ({ ...f, [key]: true }));
  }

  // GitHub 저장소 확인: 저장소 주소만 검증하고 실제 조회를 요청한다.
  function inspectRepo() {
    setFlagged((f) => ({ ...f, repoUrl: true }));
    if (found.repoUrl) {
      document.getElementById("f-repoUrl")?.focus();
      return;
    }
    void inspection.inspect();
  }

  const compareDisabledReason = !extractedReqs
    ? diffMode
      ? "변경사항 분석을 먼저 완료하세요."
      : "요구사항 추출을 먼저 완료하세요."
    : extractedReqs.length === 0
      ? "비교할 요구사항이 없습니다."
      : !commitSha
        ? "‘저장소 확인’으로 GitHub 저장소를 먼저 확인하세요. 확인한 커밋 기준으로 비교합니다."
        : null;

  function runCompare() {
    if (!extractedReqs || !commitSha) return;
    // 회의 변경 비교는 최신 회의록 기준 요구사항만 코드와 비교하고, 변경 유형은 리포트에 따로 붙인다.
    const decorate = diffMode && diffData ? (r: Parameters<typeof attachChanges>[0]) => attachChanges(r, diffData.items) : undefined;
    void comparison.run({ projectName: values.name.trim(), repoUrl: values.repoUrl.trim(), commitSha, requirements: extractedReqs }, decorate);
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setFlagged({ name: true, previousText: true, text: true, repoUrl: true });
    const first = ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    // 확인되지 않은 저장소로는 분석을 시작하지 않는다. (문서에서 요구사항을 뽑는 API 자체는 저장소와 무관하게 쓸 수 있다)
    if (!repoVerified) {
      setGateAttempted(true);
      document.getElementById("f-repoUrl")?.focus();
      return;
    }
    if (diffMode) void diff.run({ projectName: effective.name, previousText: effective.previousText ?? "", latestText: effective.text });
    else void extraction.run({ projectName: effective.name, documentType: effective.type, text: effective.text });
  }

  // 단계 완료는 입력값이 검증을 통과하는지로만 판단한다.
  const done = [
    effective.name.trim() !== "" && !found.name,
    effective.text.trim() !== "" && !found.text && (!diffMode || ((effective.previousText ?? "").trim() !== "" && !found.previousText)),
    effective.repoUrl.trim() !== "" && !found.repoUrl,
  ];
  const current = done.indexOf(false);
  const stepState = (i: number) => (done[i] ? "done" : i === current ? "current" : "todo");

  // 문서 확인 단계: 파일 추출 중이면 진행 중, 그 외에는 합친 문서가 검증을 통과했는지를 따른다.
  const filesBusy = latestFiles.busy || (diffMode && prevFiles.busy);
  const documentStage: StageResult | undefined = filesBusy ? { state: "running" } : done[1] ? { state: "done" } : undefined;

  // 다른 화면의 ‘새 분석’ 링크가 확인 여부를 판단할 수 있도록 현재 활동 상태를 알려 준다.
  const dirty =
    values.name.trim() !== "" ||
    values.text.trim() !== "" ||
    (values.previousText ?? "").trim() !== "" ||
    values.repoUrl.trim() !== "" ||
    latestFiles.items.length > 0 ||
    prevFiles.items.length > 0;
  const busy = extractStatus === "loading" || inspection.state.status === "loading" || compareStatus === "loading" || latestFiles.busy || prevFiles.busy;
  const completed = comparison.state.status === "success" && comparison.state.saved;
  useEffect(() => {
    setAnalysisActivity({ busy, dirty, completed });
  }, [busy, dirty, completed]);
  useEffect(() => resetAnalysisActivity, []);

  const st = inspection.state;
  const githubStage: StageResult | undefined =
    st.status === "loading"
      ? { state: "running" }
      : st.status === "success"
        ? { state: "done" }
        : st.status === "error"
          ? { state: "error", error: st.error.message }
          : undefined;

  const cm = comparison.state;
  const compareStage: StageResult | undefined =
    cm.status === "loading"
      ? { state: "running" }
      : cm.status === "success"
        ? { state: "done" }
        : cm.status === "error"
          ? { state: "error", error: cm.error.message }
          : undefined;

  const reportStage: StageResult | undefined =
    cm.status === "success" && cm.saved ? { state: "done" } : cm.status === "success" ? { state: "error", error: "결과를 브라우저에 보관하지 못했습니다." } : undefined;

  const ex = diffMode ? diff.state : extraction.state;
  const extractStage: StageResult | undefined =
    ex.status === "loading"
      ? { state: "running" }
      : ex.status === "success"
        ? { state: "done" }
        : ex.status === "error"
          ? { state: "error", error: ex.error.message }
          : undefined;

  // 첨부 영역에서 중복으로 빠지는 파일과 이유
  const skippedOf = (doc: ReturnType<typeof composeDocument>) => new Map(doc.skipped.map((s) => [s.id, s.reason]));
  const latestSkipped = skippedOf(latestDoc);
  const prevSkipped = skippedOf(prevDoc);
  const directDup = (doc: ReturnType<typeof composeDocument>) => doc.skipped.find((s) => s.id === "direct")?.reason;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-12"
    >
      <div>
        <StepSection step={1} title="프로젝트" state={stepState(0)}>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">분석 방식</legend>
            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
              {(
                [
                  { value: "single", label: "단일 문서 분석" },
                  { value: "diff", label: "회의 변경 비교" },
                ] as const
              ).map((m) => (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface px-2 py-2 text-center text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    checked={values.mode === m.value}
                    onChange={() => {
                      setValues((v) => ({ ...v, mode: m.value, type: m.value === "diff" ? "meeting" : v.type }));
                      setFlagged({});
                    }}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            {diffMode && <p className="mt-2 text-sm text-faint">이전 회의록과 최신 회의록을 비교해 결정사항의 변화를 찾고, 최신 기준 요구사항을 GitHub 코드와 비교합니다.</p>}
          </fieldset>
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
          {!diffMode && (
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
          )}
        </StepSection>

        <StepSection step={2} title="문서" state={stepState(1)}>
          {diffMode && (
            <>
              <DocumentEditor
                kind="meeting"
                id="f-previousText"
                label="이전 회의록"
                hint="이전 회의에서 합의된 결정과 할 일을 붙여넣거나, 아래에서 파일을 첨부하세요."
                value={values.previousText ?? ""}
                error={errors.previousText}
                onChange={(v) => update("previousText", v)}
                onBlur={() => blur("previousText")}
              />
              <AttachmentPanel
                idPrefix="f-prev"
                label="이전 회의록"
                api={prevFiles}
                totalChars={prevDoc.text.length}
                skipped={prevSkipped}
                disabled={extractStatus === "loading"}
              />
              {directDup(prevDoc) && <p className="text-xs text-warn">직접 입력한 이전 회의록: {directDup(prevDoc)}</p>}
            </>
          )}
          <DocumentEditor
            kind={values.type}
            label={diffMode ? "최신 회의록" : undefined}
            hint={diffMode ? "가장 최근 회의에서 합의된 결정과 할 일을 붙여넣거나, 아래에서 파일을 첨부하세요." : "내용을 붙여넣거나, 아래에서 파일을 첨부하세요."}
            value={values.text}
            error={errors.text}
            onChange={(v) => update("text", v)}
            onBlur={() => blur("text")}
          />
          <AttachmentPanel
            idPrefix="f-latest"
            label={diffMode ? "최신 회의록" : "문서"}
            api={latestFiles}
            totalChars={latestDoc.text.length}
            skipped={latestSkipped}
            disabled={extractStatus === "loading"}
          />
          {directDup(latestDoc) && <p className="text-xs text-warn">직접 입력한 내용: {directDup(latestDoc)}</p>}
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
              aria-invalid={repoError ? true : undefined}
              aria-describedby={repoError ? "e-repoUrl" : undefined}
              autoComplete="off"
              className={`${inputCls} font-mono sm:max-w-xl`}
            />
            <FieldError id="e-repoUrl" message={repoError} />
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
              {extractStatus === "loading" ? (diffMode ? "비교 중…" : "추출 중…") : diffMode ? "변경사항 분석" : "분석 시작"}
            </button>
            <p className="text-sm text-faint">
              {diffMode
                ? "변경사항 분석은 두 회의록을 비교해 추가·변경·삭제·유지·충돌 가능성을 찾습니다. 이어서 ‘코드 비교 실행’으로 최신 기준 요구사항을 GitHub 코드와 비교합니다."
                : "분석 시작은 문서에서 요구사항을 추출합니다. 이어서 ‘코드 비교 실행’으로 GitHub 코드와 비교합니다."}
            </p>
          </div>

          {diffMode ? (
            <DiffResult state={diff.state} onRetry={diff.retry} panelRef={panelRef} />
          ) : (
            <ExtractionResult state={extraction.state} onRetry={extraction.retry} panelRef={panelRef} />
          )}

          {extractedReqs && (
            <ComparisonResult
              state={comparison.state}
              canRun={compareDisabledReason === null}
              disabledReason={compareDisabledReason}
              onRun={runCompare}
              onRetry={comparison.retry}
              panelRef={comparePanelRef}
            />
          )}
        </StepSection>
      </div>

      <aside aria-label="분석 정보" className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <GithubPanel repoUrl={values.repoUrl} state={inspection.state} onRetry={inspectRepo} />
        <AnalysisPipeline status="unavailable" stages={{ document: documentStage, github: githubStage, extract: extractStage, compare: compareStage, report: reportStage }} />
      </aside>
    </form>
  );
}

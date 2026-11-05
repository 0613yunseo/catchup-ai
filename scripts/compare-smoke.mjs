// 실제 GitHub 수집 + 실제 OpenAI 호출로 요구사항 비교를 한 번 실행하는 스크립트. 키가 없으면 실행하지 않는다.
//
// 사용: node --env-file=.env.local scripts/compare-smoke.mjs [owner/repo] [commitSha] [R-1,R-3 처럼 일부만]
// 요구사항은 대상 저장소(기본: 이 프로젝트)에 맞춰 직접 작성한 테스트 입력이다. 비교 자체는 실제 AI가 한다.
// 인용한 근거는 GitHub raw 파일을 별도로 받아 서버가 돌려준 스니펫과 다시 대조한다.
import { compareRequirements } from "../lib/compare/compare.ts";
import { parseCompareRequest } from "../lib/compare/request.ts";
import { readConfig } from "../lib/extract/config.ts";
import { createOpenAIClient } from "../lib/extract/openai-client.ts";
import { collectRepository } from "../lib/github/collect.ts";

const { apiKey, model } = readConfig(process.env);
if (!apiKey) {
  console.error("OPENAI_API_KEY가 설정되지 않았습니다. 실제 호출을 하지 않고 종료합니다.");
  process.exit(2);
}

const target = process.argv[2] ?? "0613yunseo/catchup-ai";
const commitSha = process.argv[3];
const q = (id, title, description, o = {}) => ({
  id,
  title,
  description,
  sourceType: "meeting",
  sourceQuote: `${title}에 대한 원문 근거 문장입니다`,
  decisionType: "confirmed",
  changeType: "new",
  ambiguity: null,
  ...o,
});

const all = [
  q("R-1", "GitHub 저장소 URL 검증", "사용자가 입력한 공개 GitHub 저장소 URL에서 owner와 repo를 추출하고 형식이 올바른지 검증한다."),
  q("R-2", "모든 API에 요청 빈도 제한", "서버의 모든 API 엔드포인트에 IP당 요청 빈도 제한을 적용한다."),
  q("R-3", "소스코드 전체를 브라우저로 전달", "GitHub 저장소 조회 API의 응답에 수집한 소스코드 파일의 전체 내용을 포함해 브라우저로 전달한다."),
  q("R-4", "Stripe 결제", "Stripe를 연동해 유료 구독 결제 기능을 구현한다."),
  q("R-5", "관리자 대시보드", "관리자용 대시보드를 추가한다.", { decisionType: "undecided", ambiguity: "다음 회의에서 추가 여부를 결정한다." }),
  q("R-6", "다크 모드 지원", "화면이 다크 모드를 지원하면 좋겠다.", { decisionType: "suggestion" }),
  q("R-7", "파일 업로드 기능 삭제", "분석 입력 화면의 문서 파일 업로드 기능은 삭제한다.", { changeType: "removed" }),
];

const only = process.argv[4]?.split(",");
const requirements = only ? all.filter((r) => only.includes(r.id)) : all;
const input = parseCompareRequest({ repoUrl: `https://github.com/${target}`, commitSha, projectName: "스모크 테스트", requirements });
const result = await compareRequirements(input, {
  client: createOpenAIClient(apiKey),
  model,
  collect: (ref, opts) => collectRepository(ref, { commitSha: opts.commitSha, token: process.env.GITHUB_TOKEN }),
}).catch((e) => {
  console.error("실패:", e?.code ?? e?.name, "-", e?.message);
  process.exit(1);
});

console.log(`저장소 ${result.repository.name} @ ${result.repository.commitSha}`);
console.log(`모델 ${result.model} | 모델 호출 ${result.usage.modelCalls}회 | 토큰 입력 ${result.usage.inputTokens} + 출력 ${result.usage.outputTokens} = ${result.usage.totalTokens}`);
console.log(`시간 전체 ${result.usage.durationMs}ms (GitHub ${result.usage.githubMs}ms, 모델 ${result.usage.modelMs}ms)`);
console.log(`수집 범위: ${JSON.stringify({ ...result.coverage, warnings: result.coverage.warnings.map((w) => w.code) })}`);
console.log(`파일 선택: [${result.selection.method}] ${result.selection.explanation}`);
console.log(`요약: ${JSON.stringify(result.summary)}\n`);

let checked = 0;
let mismatched = 0;
for (const v of result.verdicts) {
  const r = requirements.find((x) => x.id === v.requirementId);
  console.log(`[${v.requirementId}] ${r.title} (${r.decisionType}/${r.changeType}) -> ${v.status}  (decidedBy=${v.decidedBy}, rejected=${v.evidenceRejected}, coverageLimited=${v.coverageLimited})`);
  console.log(`   이유: ${v.reason}`);
  if (v.policyNote) console.log(`   서버 정책: ${v.policyNote}`);
  for (const why of v.evidenceRejections) console.log(`   버린 근거 사유: ${why}`);
  if (v.missingConditions.length) console.log(`   확인 못한 조건: ${v.missingConditions.join(" / ")}`);
  if (v.recommendation) console.log(`   권고: ${v.recommendation}`);
  console.log(`   검토한 파일: ${v.consideredFiles.join(", ") || "(없음)"}`);
  for (const n of v.selectionNotes.slice(0, 8)) console.log(`     · ${n}`);
  for (const e of v.evidence) {
    // 서버와 별개로 GitHub raw에서 같은 커밋의 파일을 받아 스니펫을 다시 대조한다.
    const raw = await fetch(`https://raw.githubusercontent.com/${target}/${result.repository.commitSha}/${e.path.split("/").map(encodeURIComponent).join("/")}`).then((r) => (r.ok ? r.text() : null));
    const slice = raw?.replace(/\r\n?/g, "\n").split("\n").slice(e.startLine - 1, e.endLine).join("\n");
    const same = slice === e.snippet;
    checked++;
    if (!same) mismatched++;
    console.log(`   근거 ${e.path}:${e.startLine}-${e.endLine} [독립 대조: ${same ? "일치" : "불일치"}]`);
    console.log(e.snippet.split("\n").slice(0, 4).map((l) => `      | ${l}`).join("\n"));
  }
  console.log();
}
console.log(`독립 검증: 근거 ${checked}건 중 불일치 ${mismatched}건`);

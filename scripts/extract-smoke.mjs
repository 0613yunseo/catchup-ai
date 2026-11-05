// 실제 OpenAI 호출 한 번으로 요구사항 추출을 확인하는 스크립트. 키가 없으면 실행하지 않는다. (가짜 결과를 만들지 않는다.)
//
// 사용: 키를 .env.local 에 OPENAI_API_KEY=... 로 직접 넣은 뒤
//   node --env-file=.env.local scripts/extract-smoke.mjs
// 키 값은 출력하지 않는다. 호출은 한 번(검증 실패 시 최대 한 번 더)이다.
import { readConfig } from "../lib/extract/config.ts";
import { extractRequirements } from "../lib/extract/extract.ts";
import { createOpenAIClient } from "../lib/extract/openai-client.ts";

const { apiKey, model } = readConfig(process.env);
if (!apiKey) {
  console.error("OPENAI_API_KEY가 설정되지 않았습니다. 실제 호출을 하지 않고 종료합니다.");
  process.exit(2);
}

const text =
  "지난 회의에서는 로그인 기능을 세션 방식으로 구현하기로 했다. 오늘 교수님 피드백에 따라 JWT 기반 인증으로 변경하기로 확정했다. 관리자 대시보드 추가는 다음 회의에서 결정한다. 비밀번호 재설정 기능도 구현해달라는 요청이 있었다.";

try {
  const r = await extractRequirements(
    { projectName: "캡스톤 테스트", documentType: "meeting", text },
    { client: createOpenAIClient(apiKey), model },
  );
  console.log(JSON.stringify({ model: r.model, count: r.count, usage: r.usage, extractedAt: r.extractedAt }, null, 2));
  for (const q of r.requirements) {
    console.log(`\n[${q.id}] ${q.title}  (${q.decisionType} / ${q.changeType})`);
    console.log(`  설명: ${q.description}`);
    console.log(`  불확실: ${q.ambiguity ?? "없음"}`);
    console.log(`  원문 근거: "${q.sourceQuote}"  → 문서에 그대로 존재: ${text.includes(q.sourceQuote)}`);
  }
} catch (e) {
  console.error("실패:", e?.code ?? e?.name, "-", e?.message);
  process.exit(1);
}

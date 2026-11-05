import { CodePanel } from "@/components/code-panel";
import { STATUS_DOT } from "@/components/report/status-dot";
import { StatusBadge } from "@/components/status-badge";
import type { Status } from "@/lib/status";

// 예시(데모) 데이터입니다. 실제 분석 결과가 아닙니다.
const DEMO_REQS: { id: string; text: string; status: Status }[] = [
  { id: "R-1", text: "이메일 인증으로 로그인한다", status: "VERIFIED" },
  { id: "R-2", text: "비밀번호를 재설정할 수 있다", status: "PARTIAL" },
  { id: "R-3", text: "관리자 페이지를 제공한다", status: "UNKNOWN" },
];

const DEMO_CODE = `export async function login(email: string, code: string) {
  const user = await findUserByEmail(email);
  if (!user) throw new AuthError("NOT_FOUND");
  await verifyEmailCode(user.id, code);
  return createSession(user.id);
}`;

export function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="CatchUp AI 리포트 화면 예시. 회의록 문장, 요구사항 판정 목록, 코드 근거로 구성됩니다. 실제 분석 결과가 아닌 데모입니다."
      className="overflow-hidden rounded-xl border border-line-strong bg-canvas"
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <p className="truncate text-sm text-muted">캡스톤 프로젝트 · 분석 리포트</p>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">
            예시 · 데모
          </span>
        </div>

        <div className="grid divide-line md:grid-cols-[1fr_1fr_1.3fr] md:divide-x">
          {/* 1. 문서 */}
          <div className="p-5">
            <p className="text-sm font-semibold">회의록</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              2주차 회의.{" "}
              <mark className="rounded bg-accent-soft px-1 py-0.5 text-fg">
                로그인은 이메일 인증을 포함해 구현한다.
              </mark>{" "}
              비밀번호 재설정은 이번 스프린트에 넣는다. 관리자 페이지는 다음 학기로 미룬다.
            </p>
          </div>

          {/* 2. 요구사항 */}
          <div className="p-5">
            <p className="text-sm font-semibold">요구사항 판정</p>
            <ul className="mt-3 space-y-1">
              {DEMO_REQS.map((r, i) => (
                <li
                  key={r.id}
                  className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 ${
                    i === 0 ? "bg-accent-soft" : ""
                  }`}
                >
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${STATUS_DOT[r.status]}`} />
                  <span className="text-sm">
                    {r.text}
                    <span className="mt-0.5 block text-xs text-faint">{r.id}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. 코드 근거 */}
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">코드 근거 · R-1</p>
              <StatusBadge status="VERIFIED" />
            </div>
            <CodePanel
              path="src/auth/login.ts"
              startLine={12}
              endLine={17}
              snippet={DEMO_CODE}
              highlight={[15, 15]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

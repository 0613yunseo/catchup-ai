import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACH_LIMITS, ATTACH_MESSAGES, checkAddable, composeDocument, sanitizeFileName } from "./attachments.ts";
import { SOURCE_MARKER } from "./source-marker.ts";
import { quoteExistsInDocument } from "../extract/quote.ts";
import { validateOutput } from "../extract/schema.ts";

const A = "회의에서 로그인은 이메일 인증으로 구현하기로 결정했다. 결제는 Stripe로 확정했다.";
const B = "관리자 대시보드는 나중에 논의해서 정하자. 다크 모드를 지원하기로 했다.";
const C = "알림은 이메일로 보내기로 했다. 업로드는 PDF, DOCX, TXT를 지원한다.";

// ---------- 목록 규칙 ----------
test("첨부 추가 규칙: 최대 3개, 형식, 빈 파일, 4MB, 중복", () => {
  const f = (name, size = 100) => ({ name, size });
  assert.equal(checkAddable([], f("a.pdf")), null);
  assert.equal(checkAddable([f("a.pdf")], f("b.DOCX")), null);
  assert.equal(checkAddable([f("a.pdf"), f("b.txt")], f("c.txt")), null); // 3번째까지 가능
  assert.equal(checkAddable([f("a.pdf"), f("b.txt"), f("c.docx")], f("d.txt")), ATTACH_MESSAGES.tooMany); // 4번째 거부
  assert.equal(checkAddable([], f("a.png")), ATTACH_MESSAGES.type);
  assert.equal(checkAddable([], f("a.doc")), ATTACH_MESSAGES.type);
  assert.equal(checkAddable([], f("noext")), ATTACH_MESSAGES.type);
  assert.equal(checkAddable([], f("a.pdf", 0)), ATTACH_MESSAGES.empty);
  assert.equal(checkAddable([], f("a.pdf", ATTACH_LIMITS.maxBytes)), null); // 경계
  assert.equal(checkAddable([], f("a.pdf", ATTACH_LIMITS.maxBytes + 1)), ATTACH_MESSAGES.tooLarge);
  assert.equal(checkAddable([f("a.pdf", 100)], f("a.pdf", 100)), ATTACH_MESSAGES.duplicate); // 같은 이름·크기
  assert.equal(checkAddable([f("a.pdf", 100)], f("a.pdf", 101)), null); // 이름만 같고 내용이 다름
  assert.equal(ATTACH_LIMITS.maxFiles, 3);
});

// ---------- 파일명 ----------
test("파일명 정리: 줄바꿈·제어 문자·대괄호·꺾쇠 제거, 길이 제한, 확장자 유지", () => {
  assert.equal(sanitizeFileName("회의록.pdf"), "회의록.pdf");
  assert.equal(sanitizeFileName("a\nb\r\nc.txt"), "a b c.txt");
  assert.equal(sanitizeFileName("[첨부파일 9: 가짜].txt"), "첨부파일 9: 가짜.txt");
  assert.equal(sanitizeFileName("<b>x</b>.pdf"), "bx/b.pdf");
  assert.equal(sanitizeFileName("   "), "파일");
  assert.equal(sanitizeFileName("\u0000\u0007.txt"), ".txt");
  const long = sanitizeFileName(`${"가".repeat(200)}.docx`);
  assert.ok(long.length <= ATTACH_LIMITS.fileNameMax);
  assert.ok(long.endsWith(".docx"));
  // 줄 구분 문자도 줄바꿈처럼 처리
  assert.equal(sanitizeFileName(`a${String.fromCharCode(0x2028)}b.txt`), "a b.txt");
  // 정리한 이름은 출처 표시 패턴을 위조하지 못한다
  const hostile = sanitizeFileName("x]\n[직접 입력].txt");
  assert.ok(!hostile.includes("[") && !hostile.includes("]") && !hostile.includes("\n"));
});

// ---------- 문서 합치기 ----------
test("합치기: 첨부가 없으면 직접 입력 그대로(CRLF만 정리) — 기존 입력과 동일", () => {
  const r = composeDocument(`  ${A}\r\n${B}  `, []);
  assert.equal(r.text, `${A}\n${B}`);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.included, []);
  assert.equal(composeDocument("", []).text, "");
});

test("합치기: 직접 입력 + 첨부 → 출처 표시와 함께 이어 붙이고 순서를 지킨다", () => {
  const r = composeDocument(A, [{ id: "f1", name: "b.txt", text: B }, { id: "f2", name: "c.docx", text: C }]);
  assert.equal(r.text, `[직접 입력]\n${A}\n\n[첨부파일 1: b.txt]\n${B}\n\n[첨부파일 2: c.docx]\n${C}`);
  assert.deepEqual(r.included, ["f1", "f2"]);
  assert.deepEqual(r.skipped, []);
});

test("합치기: 직접 입력이 없으면 첨부만, 빈 첨부 텍스트는 무시", () => {
  const r = composeDocument("", [{ id: "f1", name: "a.pdf", text: A }, { id: "f2", name: "empty.txt", text: "  \n " }]);
  assert.equal(r.text, `[첨부파일 1: a.pdf]\n${A}`);
  assert.deepEqual(r.included, ["f1"]);
  // 쓸 수 있는 첨부 텍스트가 없으면 출처 표시도 붙이지 않는다
  assert.equal(composeDocument(A, [{ id: "f", name: "e.txt", text: " " }]).text, A);
});

test("합치기: 중복 내용은 뺀다 (직접 입력을 파일에도 올림 / 같은 내용의 두 파일 / 파일이 다른 파일에 포함)", () => {
  // 직접 입력이 파일 내용의 일부(공백만 다름)
  let r = composeDocument(A, [{ id: "f1", name: "full.txt", text: `${A}\n\n${B}` }]);
  assert.equal(r.text, `[첨부파일 1: full.txt]\n${A}\n\n${B}`);
  assert.deepEqual(r.skipped.map((s) => s.id), ["direct"]);
  assert.match(r.skipped[0].reason, /full\.txt/);

  // 공백·줄바꿈만 다른 같은 내용의 두 파일 → 앞선 것만
  r = composeDocument("", [{ id: "f1", name: "a.txt", text: A }, { id: "f2", name: "copy.txt", text: A.replace(/ /g, "\n") }]);
  assert.deepEqual(r.included, ["f1"]);
  assert.deepEqual(r.skipped.map((s) => s.id), ["f2"]);

  // 짧은 파일이 긴 파일에 포함
  r = composeDocument("", [{ id: "short", name: "s.txt", text: B }, { id: "long", name: "l.txt", text: `${A} ${B}` }]);
  assert.deepEqual(r.included, ["long"]);
  assert.deepEqual(r.skipped.map((s) => s.id), ["short"]);

  // 서로 다른 내용은 모두 포함
  r = composeDocument(A, [{ id: "f1", name: "b.txt", text: B }]);
  assert.deepEqual(r.skipped, []);
});

test("합치기: 이전/최신 문서는 서로 다른 입력으로 따로 합쳐진다 (섞이지 않음)", () => {
  const prev = composeDocument("", [{ id: "p1", name: "week1.txt", text: A }]);
  const last = composeDocument("", [{ id: "l1", name: "week2.txt", text: B }]);
  assert.ok(prev.text.includes(A) && !prev.text.includes(B));
  assert.ok(last.text.includes(B) && !last.text.includes(A));
  assert.ok(prev.text.includes("week1.txt") && !prev.text.includes("week2.txt"));
});

// ---------- 인용 검증과 출처 표시 ----------
test("인용 검증: 한 파일 안의 문장은 통과, 출처 표시를 낀 인용과 두 출처에 걸친 인용은 거부", () => {
  const doc = composeDocument(A, [{ id: "f1", name: "b.txt", text: B }]).text;
  assert.equal(quoteExistsInDocument(doc, "로그인은 이메일 인증으로 구현하기로 결정했다.", 6), true); // 직접 입력 문장
  assert.equal(quoteExistsInDocument(doc, "관리자 대시보드는 나중에 논의해서 정하자.", 6), true); // 첨부 문장
  // 출처 표시를 포함한 인용
  assert.equal(quoteExistsInDocument(doc, "[첨부파일 1: b.txt]\n관리자 대시보드는 나중에 논의해서 정하자.", 6), false);
  assert.equal(quoteExistsInDocument(doc, "[직접 입력]\n회의에서 로그인은", 6), false);
  // 두 출처의 끝과 시작을 이어 붙인 인용(표시를 빼고)은 문서에 연속으로 없으므로 거부
  assert.equal(quoteExistsInDocument(doc, "결제는 Stripe로 확정했다. 관리자 대시보드는 나중에", 6), false);
  // 표시가 없는 문서(직접 입력만)는 기존과 같다
  assert.equal(quoteExistsInDocument(A, "결제는 Stripe로 확정했다.", 6), true);
  assert.equal(SOURCE_MARKER.test("[첨부파일 12: 이름.pdf]"), true);
  assert.equal(SOURCE_MARKER.test("[참고] 대괄호 문장"), false);
});

test("요구사항 추출 검증: 출처 표시가 낀 sourceQuote는 거부되고, 첨부 문장은 통과한다", () => {
  const doc = composeDocument(A, [{ id: "f1", name: "b.txt", text: B }]).text;
  const item = (q) => ({ requirements: [{ title: "t", description: "d", sourceType: "meeting", sourceQuote: q, decisionType: "confirmed", changeType: "new", ambiguity: null }] });
  assert.equal(validateOutput(item("다크 모드를 지원하기로 했다."), doc, "meeting").ok, true);
  const bad = validateOutput(item("[첨부파일 1: b.txt] 관리자 대시보드는"), doc, "meeting");
  assert.equal(bad.ok, false);
  assert.equal(bad.kind, "quote");
});

test("합산 글자 수 한도: 합친 문서(출처 표시 포함)가 20,000자를 넘는지 바로 알 수 있다", () => {
  const big = "가".repeat(9000);
  const r = composeDocument(big + "나", [{ id: "f1", name: "a.txt", text: "다".repeat(9000) }, { id: "f2", name: "b.txt", text: "라".repeat(2500) }]);
  assert.ok(r.text.length > ATTACH_LIMITS.maxChars); // 호출 측이 이 길이로 한도를 판단한다
  const ok = composeDocument("가".repeat(100), [{ id: "f1", name: "a.txt", text: "나".repeat(100) }]);
  assert.ok(ok.text.length <= ATTACH_LIMITS.maxChars);
});

test("새 분석 확인 정책: 진행 중이거나 입력만 한 상태에서만 묻고, 끝난 분석에서는 묻지 않는다", async () => {
  const { needsConfirm } = await import("../new-analysis.ts");
  assert.equal(needsConfirm({ busy: false, dirty: false, completed: false }), false); // 빈 화면
  assert.equal(needsConfirm({ busy: false, dirty: true, completed: false }), true); // 입력 중
  assert.equal(needsConfirm({ busy: true, dirty: true, completed: false }), true); // 분석 중
  assert.equal(needsConfirm({ busy: true, dirty: false, completed: false }), true); // 파일 추출 중
  assert.equal(needsConfirm({ busy: false, dirty: true, completed: true }), false); // 완료한 분석
  assert.equal(needsConfirm({ busy: true, dirty: true, completed: true }), true); // 완료 후 새 요청이 진행 중
});

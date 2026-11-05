import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { extractDocument, formatFromName, normalizeText } from "./extract.ts";
import { DocumentError, httpStatusFor } from "./errors.ts";
import { DOC_LIMITS } from "./limits.ts";
import { zipUncompressedTotal } from "./zip.ts";

const enc = (s) => new TextEncoder().encode(s);
const MEETING = "3주차 회의록. 로그인은 이메일 인증으로 구현하기로 결정했다. 관리자 페이지는 나중에 논의한다.";

// ---------- 테스트용 파일 만들기 (저장소에 바이너리를 두지 않는다) ----------
function zip(entries, { claimSize } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameB = Buffer.from(name);
    const data = Buffer.from(text);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    parts.push(local, nameB, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(claimSize ?? data.length, 24);
    c.writeUInt16LE(nameB.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function docx(paragraphs, opts) {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join("");
  return zip(
    {
      "[Content_Types].xml":
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      "_rels/.rels":
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    },
    opts,
  );
}

function pdf(lines, { encrypt = false, pages = 1 } = {}) {
  const content = lines.length
    ? `BT /F1 12 Tf 72 720 Td ${lines.map((l, i) => `${i ? "0 -16 Td " : ""}(${l}) Tj`).join(" ")} ET`
    : "";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array(pages).fill("3 0 R").join(" ")}] /Count ${pages} >>`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  if (encrypt) {
    const h = "0".repeat(64);
    objs.push(`<< /Filter /Standard /V 1 /R 2 /O <${h}> /U <${h}> /P -4 >>`);
  }
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R${encrypt ? ` /Encrypt 6 0 R /ID [<${"1".repeat(32)}><${"1".repeat(32)}>]` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return enc(out);
}

async function code(fn) {
  try {
    await fn();
  } catch (e) {
    assert.ok(e instanceof DocumentError, `DocumentError 아님: ${e?.stack}`);
    return e.code;
  }
  assert.fail("오류가 나야 합니다");
}

// ---------- 정상 ----------
test("TXT: UTF-8(BOM 포함)과 줄바꿈 정리", async () => {
  const r = await extractDocument("meeting.txt", enc(`﻿${MEETING}\r\n\r\n\r\n\r\n끝.\r\n`));
  assert.equal(r.format, "txt");
  assert.equal(r.text, `${MEETING}\n\n끝.`);
  assert.equal(r.chars, r.text.length);
});

test("TXT: EUC-KR(CP949) 파일도 읽는다", async () => {
  const bytes = new Uint8Array(new TextEncoder().encode("")); // 자리 표시
  assert.equal(bytes.length, 0);
  // "안녕하세요 회의록입니다" 의 EUC-KR 바이트
  const euckr = Uint8Array.from([0xbe, 0xc8, 0xb3, 0xe7, 0xc7, 0xcf, 0xbc, 0xbc, 0xbf, 0xe4, 0x20, 0xc8, 0xb8, 0xc0, 0xc7, 0xb7, 0xcf, 0xc0, 0xd4, 0xb4, 0xcf, 0xb4, 0xd9]);
  const r = await extractDocument("old.TXT", euckr);
  assert.equal(r.text, "안녕하세요 회의록입니다");
});

test("DOCX: 문단 텍스트(한글 포함)를 추출", async () => {
  const r = await extractDocument("회의록.docx", docx(["프로젝트 회의록", MEETING, "A & B <c>"]));
  assert.equal(r.format, "docx");
  assert.ok(r.text.includes(MEETING));
  assert.ok(r.text.includes("A & B <c>"));
});

test("PDF: 텍스트 기반 PDF에서 텍스트와 쪽수를 추출", async () => {
  const r = await extractDocument("spec.pdf", pdf(["Login uses email verification.", "Admin page is undecided."]));
  assert.equal(r.format, "pdf");
  assert.equal(r.pages, 1);
  assert.ok(r.text.includes("Login uses email verification."));
  assert.ok(r.text.includes("Admin page is undecided."));
});

test("확장자는 대소문자를 구분하지 않고, 지원 형식만 허용", () => {
  assert.equal(formatFromName("A.PDF"), "pdf");
  assert.equal(formatFromName("a.b.docx"), "docx");
  assert.equal(formatFromName("a.md"), null);
  assert.equal(formatFromName("a.doc"), null);
  assert.equal(formatFromName("pdf"), null);
});

// ---------- 오류 ----------
test("빈 파일, 공백뿐인 TXT", async () => {
  assert.equal(await code(() => extractDocument("a.txt", new Uint8Array())), "EMPTY_FILE");
  assert.equal(await code(() => extractDocument("a.txt", enc(" \n\t\r\n "))), "EMPTY_FILE");
  assert.equal(await code(() => extractDocument("a.pdf", new Uint8Array())), "EMPTY_FILE");
});

test("지원하지 않는 형식", async () => {
  for (const n of ["a.doc", "a.png", "a.exe", "noext", "a.pdf.exe"]) {
    assert.equal(await code(() => extractDocument(n, enc("hello world"))), "UNSUPPORTED_TYPE", n);
  }
});

test("확장자와 내용이 다르면 거부", async () => {
  assert.equal(await code(() => extractDocument("fake.pdf", enc("그냥 텍스트입니다. 그냥 텍스트입니다."))), "TYPE_MISMATCH");
  assert.equal(await code(() => extractDocument("fake.docx", enc("그냥 텍스트입니다. 그냥 텍스트입니다."))), "TYPE_MISMATCH");
  assert.equal(await code(() => extractDocument("bin.txt", Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 1, 2]))), "TYPE_MISMATCH");
});

test("손상된 PDF·DOCX", async () => {
  const good = pdf(["Hello world text content here."]);
  assert.equal(await code(() => extractDocument("a.pdf", good.subarray(0, 120))), "CORRUPT");
  assert.equal(await code(() => extractDocument("a.pdf", enc("%PDF-1.4\n이건 PDF가 아닙니다 \x00\x01"))), "CORRUPT");
  const d = docx(["본문 텍스트가 들어 있는 문서입니다."]);
  assert.equal(await code(() => extractDocument("a.docx", d.subarray(0, 60))), "CORRUPT");
  assert.equal(await code(() => extractDocument("a.docx", Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]))), "CORRUPT");
  // 필수 부분(word/document.xml)이 없는 zip
  assert.equal(await code(() => extractDocument("a.docx", zip({ "readme.txt": "hello hello hello" }))), "CORRUPT");
});

test("암호화된 PDF", async () => {
  assert.equal(await code(() => extractDocument("locked.pdf", pdf(["secret"], { encrypt: true }))), "ENCRYPTED");
});

test("PDF 쪽수 경계: 50쪽 통과, 51쪽 거부", async () => {
  const ok = await extractDocument("a.pdf", pdf(["page text"], { pages: DOC_LIMITS.maxPdfPages }));
  assert.equal(ok.pages, DOC_LIMITS.maxPdfPages);
  assert.equal(await code(() => extractDocument("a.pdf", pdf(["page text"], { pages: DOC_LIMITS.maxPdfPages + 1 }))), "TOO_MANY_PAGES");
});

test("텍스트 없는 PDF(스캔본 등)와 빈 DOCX는 NO_TEXT", async () => {
  assert.equal(await code(() => extractDocument("scan.pdf", pdf([]))), "NO_TEXT");
  assert.equal(await code(() => extractDocument("empty.docx", docx([]))), "NO_TEXT");
  assert.equal(await code(() => extractDocument("empty.docx", docx(["   "]))), "NO_TEXT");
});

// ---------- 경계 ----------
test("크기 경계: 한도 이하 통과, 초과 거부", async () => {
  const at = new Uint8Array(DOC_LIMITS.maxBytes).fill(0x61); // 'a' 4MB
  assert.equal(await code(() => extractDocument("a.txt", at)), "TEXT_TOO_LONG"); // 크기는 통과, 길이에서 거부
  const over = new Uint8Array(DOC_LIMITS.maxBytes + 1).fill(0x61);
  assert.equal(await code(() => extractDocument("a.txt", over)), "FILE_TOO_LARGE");
});

test("텍스트 길이 경계: 20,000자 통과, 20,001자 거부 (잘라내지 않는다)", async () => {
  const ok = await extractDocument("a.txt", enc("가".repeat(DOC_LIMITS.textMax)));
  assert.equal(ok.chars, DOC_LIMITS.textMax);
  assert.equal(await code(() => extractDocument("a.txt", enc("가".repeat(DOC_LIMITS.textMax + 1)))), "TEXT_TOO_LONG");
  assert.equal(await code(() => extractDocument("a.docx", docx(["가".repeat(DOC_LIMITS.textMax + 1)]))), "TEXT_TOO_LONG");
});

test("DOCX 압축 폭탄: 풀었을 때 크기가 크다고 선언된 파일은 풀기 전에 거부", async () => {
  const bomb = docx(["안녕하세요 본문입니다."], { claimSize: DOC_LIMITS.maxDocxUncompressed + 1 });
  assert.equal(zipUncompressedTotal(bomb) > DOC_LIMITS.maxDocxUncompressed, true);
  assert.equal(await code(() => extractDocument("bomb.docx", bomb)), "FILE_TOO_LARGE");
  assert.equal(zipUncompressedTotal(enc("not a zip at all, really, not a zip")), null);
});

test("정규화: 제어 문자 제거, 3줄 이상 빈 줄 축소", () => {
  assert.equal(normalizeText("a\u0000b\u0007c\n\n\n\n\nd  \ne"), "abc\n\nd\ne");
});

test("오류 코드별 HTTP 상태", () => {
  assert.equal(httpStatusFor("FILE_TOO_LARGE"), 413);
  assert.equal(httpStatusFor("UNSUPPORTED_TYPE"), 415);
  assert.equal(httpStatusFor("NO_FILE"), 400);
  assert.equal(httpStatusFor("ENCRYPTED"), 422);
  assert.equal(httpStatusFor("INTERNAL"), 500);
});

test("오류 메시지에 파일 내용·이름이 들어가지 않는다", async () => {
  try {
    await extractDocument("비밀-문서.pdf", enc("%PDF-1.4 SECRET-CONTENT"));
  } catch (e) {
    assert.ok(!e.message.includes("SECRET-CONTENT") && !e.message.includes("비밀-문서"));
  }
});

// 최소한의 tar 스트림 파서. 필요한 파일만 메모리에 모으고 나머지는 읽는 즉시 버린다.
// 파일을 디스크에 쓰지 않으며, 경로는 문자열 키로만 쓴다.

export type TarSink = (path: string, data: Buffer) => void;

type Entry = {
  kind: "skip" | "meta" | "file";
  type: string;
  path: string;
  remaining: number;
  pad: number;
  chunks: Buffer[];
};

const EMPTY = Buffer.alloc(0);
const META_MAX = 1_000_000;

function cstr(buf: Buffer, start: number, len: number): string {
  const slice = buf.subarray(start, start + len);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? len : end).toString("utf8");
}

export class TarReader {
  /** 요청한 파일을 모두 찾았으면 true. 이후 push는 무시된다. */
  done: boolean;
  private carry: Buffer = EMPTY;
  private cur: Entry | null = null;
  private nextPath: string | undefined;
  private left: number;
  private want: Map<string, number>;
  private sink: TarSink;

  /**
   * @param want 읽을 파일: 저장소 루트 기준 경로 → 허용하는 최대 바이트
   * @param sink 파일을 하나 다 읽을 때마다 호출된다
   */
  constructor(want: Map<string, number>, sink: TarSink) {
    this.want = want;
    this.sink = sink;
    this.left = want.size;
    this.done = want.size === 0;
  }

  push(chunk: Buffer): void {
    let data = this.carry.length ? Buffer.concat([this.carry, chunk]) : chunk;
    this.carry = EMPTY;
    while (data.length > 0 && !this.done) {
      const cur = this.cur;
      if (cur) {
        if (cur.remaining > 0) {
          const n = Math.min(cur.remaining, data.length);
          if (cur.kind !== "skip") cur.chunks.push(Buffer.from(data.subarray(0, n)));
          cur.remaining -= n;
          data = data.subarray(n);
          if (cur.remaining > 0) break;
        }
        if (cur.pad > 0) {
          const n = Math.min(cur.pad, data.length);
          cur.pad -= n;
          data = data.subarray(n);
          if (cur.pad > 0) break;
        }
        this.cur = null;
        this.finish(cur);
        continue;
      }
      if (data.length < 512) {
        this.carry = Buffer.from(data);
        break;
      }
      const header = data.subarray(0, 512);
      data = data.subarray(512);
      this.begin(header);
    }
  }

  private begin(h: Buffer): void {
    if (h.every((b) => b === 0)) return; // 아카이브 끝의 빈 블록
    const size = parseInt(cstr(h, 124, 12).trim() || "0", 8);
    if (!Number.isFinite(size) || size < 0) throw new Error("tar: invalid size");
    const type = String.fromCharCode(h[156] || 48);
    const ustar = cstr(h, 257, 5) === "ustar";
    const name = cstr(h, 0, 100);
    const prefix = ustar ? cstr(h, 345, 155) : "";
    const header = prefix ? `${prefix}/${name}` : name;
    const pad = (512 - (size % 512)) % 512;

    let kind: Entry["kind"] = "skip";
    let path = header;
    if (type === "x" || type === "L") {
      kind = size <= META_MAX ? "meta" : "skip";
    } else if (type === "0") {
      path = this.nextPath ?? header;
      this.nextPath = undefined;
      // 첫 경로 조각은 "owner-repo-sha/" 루트 폴더다.
      const rel = path.slice(path.indexOf("/") + 1);
      const max = this.want.get(rel);
      if (max !== undefined && size <= max) {
        kind = "file";
        path = rel;
      }
    } else if (type !== "g") {
      this.nextPath = undefined;
    }
    const entry: Entry = { kind, type, path, remaining: size, pad, chunks: [] };
    if (size === 0 && pad === 0) this.finish(entry);
    else this.cur = entry;
  }

  private finish(e: Entry): void {
    if (e.kind === "file") {
      this.sink(e.path, Buffer.concat(e.chunks));
      if (--this.left <= 0) this.done = true;
    } else if (e.kind === "meta") {
      const text = Buffer.concat(e.chunks);
      if (e.type === "L") this.nextPath = cstr(text, 0, text.length);
      else {
        const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(text.toString("utf8"));
        if (m) this.nextPath = m[1];
      }
    }
  }
}

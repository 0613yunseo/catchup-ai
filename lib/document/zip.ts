// ZIP 중앙 디렉터리에서 압축을 푼 뒤의 총 크기를 읽는다. 파일을 실제로 풀지 않는다.
// 읽을 수 없으면 null.
export function zipUncompressedTotal(b: Uint8Array): number | null {
  if (b.length < 22) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const min = Math.max(0, b.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = b.length - 22; i >= min; i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) return null;
    total += v.getUint32(p + 24, true);
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return total;
}

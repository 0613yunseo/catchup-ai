// 메모리 기반 요청 제한. 서버 인스턴스마다 따로 센다. (서버리스에서는 인스턴스가 여러 개일 수 있어 완전한 제한은 아니다.)
export type LimiterConfig = {
  windowMs: number;
  maxPerWindow: number;
  maxConcurrentPerClient: number;
  globalWindowMs: number;
  globalMax: number;
};

export type Acquire =
  | { ok: true; release: () => void }
  | { ok: false; code: "BUSY" | "RATE_LIMITED"; retryAfterSec: number };

type Entry = { times: number[]; inflight: number };

export function createLimiter(cfg: LimiterConfig, now: () => number = Date.now) {
  const clients = new Map<string, Entry>();
  let globalTimes: number[] = [];

  function acquire(key: string): Acquire {
    const t = now();
    globalTimes = globalTimes.filter((x) => t - x < cfg.globalWindowMs);
    if (globalTimes.length >= cfg.globalMax) {
      return { ok: false, code: "RATE_LIMITED", retryAfterSec: Math.max(1, Math.ceil((globalTimes[0] + cfg.globalWindowMs - t) / 1000)) };
    }
    if (clients.size > 5000) {
      for (const [k, e] of clients) if (e.inflight === 0 && e.times.every((x) => t - x >= cfg.windowMs)) clients.delete(k);
    }
    const e = clients.get(key) ?? { times: [], inflight: 0 };
    e.times = e.times.filter((x) => t - x < cfg.windowMs);
    clients.set(key, e);

    if (e.inflight >= cfg.maxConcurrentPerClient) return { ok: false, code: "BUSY", retryAfterSec: 5 };
    if (e.times.length >= cfg.maxPerWindow) {
      return { ok: false, code: "RATE_LIMITED", retryAfterSec: Math.max(1, Math.ceil((e.times[0] + cfg.windowMs - t) / 1000)) };
    }
    e.times.push(t);
    globalTimes.push(t);
    e.inflight++;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (!released) {
          released = true;
          e.inflight--;
        }
      },
    };
  }

  return { acquire };
}

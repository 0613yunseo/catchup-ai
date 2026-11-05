import type { Status } from "@/lib/status";

export const STATUS_DOT: Record<Status, string> = {
  VERIFIED: "bg-ok",
  PARTIAL: "bg-warn",
  MISMATCH: "bg-bad",
  UNKNOWN: "bg-unk",
};

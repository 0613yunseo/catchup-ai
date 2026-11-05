import { INPUT_TYPES } from "@/lib/validate";

export const sourceLabel = (kind: string) => INPUT_TYPES.find((t) => t.value === kind)?.label ?? kind;

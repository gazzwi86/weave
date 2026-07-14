import type { DiffResponse } from "./types";

export interface DiffExport extends DiffResponse {
  from: string;
  to: string;
  generated_at: string;
}

/** AC-6: JSON summary export -- CE-DIFF-1's response plus a
 * {from, to, generated_at} envelope. `now` is injected so the timestamp
 * stays deterministic in tests (no Date.now() call site to fake). */
export function buildDiffExport(from: string, to: string, diff: DiffResponse, now: () => string): DiffExport {
  return { from, to, generated_at: now(), ...diff };
}

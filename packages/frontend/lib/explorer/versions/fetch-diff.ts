import type { DiffResponse } from "../diff/types";

export type FetchDiffResult = { type: "ok"; diff: DiffResponse } | { type: "error"; status: number };

/** AC-3/AC-5: fetches CE-DIFF-1's diff via the same-origin
 * `/api/proxy/ontology/diff` route -- never throws (timeout/network/HTTP
 * error all resolve to a typed error so the caller's retry banner has one
 * branch to handle, per fetch-ontology-types.ts's pattern). */
export async function fetchDiff(from: string, to: string, timeoutMs: number): Promise<FetchDiffResult> {
  const params = new URLSearchParams({ from, to });
  let response: Response;
  try {
    response = await fetch(`/api/proxy/ontology/diff?${params.toString()}`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const diff = (await response.json()) as DiffResponse;
  return { type: "ok", diff };
}

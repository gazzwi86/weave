import type { VersionEntry } from "./types";

export type FetchVersionsResult = { type: "ok"; versions: VersionEntry[] } | { type: "error"; status: number };

/** AC-1: fetches CE-VERSION-1's published version list via the same-origin
 * `/api/proxy/ontology/versions` route -- never throws, matching the other
 * fetch clients in this module (fetch-ontology-types.ts). */
export async function fetchVersions(timeoutMs: number): Promise<FetchVersionsResult> {
  let response: Response;
  try {
    response = await fetch("/api/proxy/ontology/versions", { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const versions = (await response.json()) as VersionEntry[];
  return { type: "ok", versions };
}

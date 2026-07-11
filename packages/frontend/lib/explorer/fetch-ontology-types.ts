import type { OntologyRelationshipEntry } from "./validate-closure";

export type FetchOntologyTypesResult =
  | { type: "ok"; relationships: OntologyRelationshipEntry[] }
  | { type: "error"; status: number };

interface OntologyTypesResponseBody {
  relationships: OntologyRelationshipEntry[];
}

/** TASK-028 AC-2: fetches CE-READ-1's relationship list via the same-origin
 * `/api/proxy/ontology/types` route (the client never handles the JWT
 * directly). Never throws: every failure (HTTP error, network/timeout)
 * resolves to `{type: "error", status}` so the boot-time drift guard can
 * degrade the same way every other fetch client in this module does. */
export async function fetchOntologyTypes(timeoutMs: number): Promise<FetchOntologyTypesResult> {
  let response: Response;
  try {
    response = await fetch("/api/proxy/ontology/types", { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as OntologyTypesResponseBody;
  return { type: "ok", relationships: body.relationships };
}

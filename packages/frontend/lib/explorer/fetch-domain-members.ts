import { buildDomainMemberQuery } from "./build-domain-member-query";

export interface DomainMemberRow {
  entityIri: string;
  entityLabel: string;
}

export type FetchDomainMembersResult =
  | { type: "ok"; rows: DomainMemberRow[] }
  | { type: "error"; status: number };

interface DomainMemberResponseBody {
  rows: Array<{ entity_iri: string; entity_label: string }>;
}

/** AC-1/AC-2: fetches a domain's member entities via the same-origin
 * `/api/proxy/sparql` POST route (the client never handles the JWT
 * directly -- see fetch-graph.ts's proxyFetch). Never throws: every failure
 * (unsafe IRI, HTTP error, network/timeout) resolves to
 * `{type: "error", status}` so callers can render a fallback. */
export async function fetchDomainMembers(
  domainIri: string,
  membershipPredicate: string,
  timeoutMs: number
): Promise<FetchDomainMembersResult> {
  let query: string;
  try {
    query = buildDomainMemberQuery(domainIri, membershipPredicate);
  } catch {
    return { type: "error", status: 422 };
  }

  let response: Response;
  try {
    response = await fetch("/api/proxy/sparql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { type: "error", status: 0 };
  }

  if (!response.ok) return { type: "error", status: response.status };

  const body = (await response.json()) as DomainMemberResponseBody;
  return {
    type: "ok",
    rows: body.rows.map((row) => ({ entityIri: row.entity_iri, entityLabel: row.entity_label })),
  };
}

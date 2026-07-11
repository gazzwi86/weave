"use client";

import { useEffect, useState } from "react";

interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

interface EdgeModel {
  predicate: string;
  target?: string;
  source?: string;
}

interface ResourceResponse {
  iri: string;
  kind: string | null;
  label: string;
  triples: Triple[];
  outgoing: EdgeModel[];
  incoming: EdgeModel[];
}

export interface InspectedResource {
  iri: string;
  kind: string | null;
  label: string;
  properties: { label: string; value: string }[];
  edges: { label: string; value: string }[];
}

function localName(iri: string): string {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  return iri.slice(Math.max(hashIndex, slashIndex) + 1);
}

function toInspectedResource(body: ResourceResponse): InspectedResource {
  const properties = body.triples
    .filter((triple) => triple.subject === body.iri)
    .map((triple) => ({ label: localName(triple.predicate), value: triple.object }));
  const edges = [
    ...body.outgoing.map((edge) => ({ label: `→ ${localName(edge.predicate)}`, value: edge.target ?? "" })),
    ...body.incoming.map((edge) => ({ label: `← ${localName(edge.predicate)}`, value: edge.source ?? "" })),
  ];
  return { iri: body.iri, kind: body.kind, label: body.label, properties, edges };
}

/** AC-3: fetches one entity's properties + edges from CE-READ-1
 * `GET /api/ontology/resource/{iri}`. History/PROV is intentionally not
 * derived here -- see `.claude/state/escalations/TASK-031-blocker.md`, no
 * read path exposes it; the inspector renders an explicit "unavailable"
 * state instead of fabricating one.
 */
export function useInspector(iri: string | null): { resource: InspectedResource | null; loading: boolean } {
  const [resource, setResource] = useState<InspectedResource | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Resetting on iri change before the new fetch resolves, same
    // fetch-on-mount pattern as `use-kind-shape.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResource(null);
    if (!iri) return undefined;
    let cancelled = false;
    setLoading(true);
    // A single encodeURIComponent'd segment -- Next's `[...iri]` catch-all
    // decodes it back to one array element containing the full IRI
    // (including its slashes), matching the route's own re-encode-and-join
    // (`resolvePath`, `route.ts`) and its own test fixture's URL shape.
    fetch(`/api/ontology/resource/${encodeURIComponent(iri)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ResourceResponse>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setResource(toInspectedResource(body));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [iri]);

  return { resource, loading };
}

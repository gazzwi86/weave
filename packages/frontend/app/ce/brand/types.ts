/** TASK-003's committed shapes (`framework.shacl.ttl`): full-class IRIs,
 * not BPMO-kind short names -- these two classes deliberately bypass the
 * 14-kind BPMO catalogue (ADR-022), so `add_node.kind` must carry the
 * whole IRI (`operations/graph_ops.py::_expand` passes an IRI containing
 * "://" straight through, never re-prefixing it).
 */
export const BRAND_STANDARD_KIND = "https://weave.io/ontology/BrandStandard";
export const VOICE_RULE_KIND = "https://weave.io/ontology/VoiceRule";

export interface BrandStandardRow {
  iri: string;
  contentType: string;
  contentBody: string | null;
  sourceUri: string | null;
  effectiveDate: string;
  owner: string;
}

export interface VoiceRuleRow {
  iri: string;
  ruleId: string;
  severity: "critical" | "normal";
  assertion: string;
}

/** ponytail: per-item PROV attribution isn't queryable today -- every
 * CE-WRITE-1 commit's `prov:Activity` links to the whole minted
 * `version_iri` (`operations/provenance.py`), not the individual entity
 * it created, and the same is true of the Postgres audit log
 * (`subject_iri` is version-scoped). The only place a real per-item actor
 * is knowable is the moment this UI itself creates the item (the apply
 * response). See `attribution.ts`.
 */
export interface Attribution {
  actorIri: string;
  versionIri: string;
  committedAt: string;
}

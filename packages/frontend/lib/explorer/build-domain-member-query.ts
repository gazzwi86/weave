import { assertSafeIriTerm } from "./sparql-safe";

const RDFS_LABEL_PREFIX = "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>";

/** AC-1 (SS-GE-4): `membershipPredicate` is entirely caller-supplied --
 * this function never embeds a predicate IRI literal itself, so the
 * domain-membership relationship CE confirms can change without touching
 * this file. The `GRAPH ?g` wrapper matches the backend's
 * `validate_query` requirement (every SELECT must be GRAPH-scoped);
 * dataset scoping to the caller's tenant is enforced one layer down by
 * the SPARQL 1.1 Protocol parameters, not by this query text. */
export function buildDomainMemberQuery(domainIri: string, membershipPredicate: string): string {
  const safeDomainIri = assertSafeIriTerm(domainIri);
  const safePredicate = assertSafeIriTerm(membershipPredicate);

  return `${RDFS_LABEL_PREFIX}
SELECT ?entity_iri ?entity_label
WHERE {
  GRAPH ?g {
    ?entity_iri <${safePredicate}> <${safeDomainIri}> .
    ?entity_iri rdfs:label ?entity_label .
  }
}`;
}

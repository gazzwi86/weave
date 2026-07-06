export type VersionStatus = "draft" | "published";

/** CE-READ-1's `GET /api/ontology/versions` list entry shape. */
export interface VersionEntry {
  version_iri: string;
  semver: string;
  status: VersionStatus;
  created_at: string;
  published_at: string | null;
  actor_iri: string;
}

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

export interface ModifiedTriple {
  subject: string;
  predicate: string;
  before: string;
  after: string;
}

/** CE-DIFF-1's `GET /api/ontology/diff` result shape. */
export interface DiffResult {
  added: Triple[];
  removed: Triple[];
  modified: ModifiedTriple[];
}

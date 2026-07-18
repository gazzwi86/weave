/** CE-VERSION-1's `GET /api/proxy/ontology/versions` row shape. */
export interface VersionEntry {
  version_iri: string;
  semver: string;
  // Null for unpublished drafts (they arrive in the list too) -- consumers
  // must guard before comparing, see use-canvas-overlay-toggles.ts.
  published_at: string | null;
  is_latest: boolean;
}

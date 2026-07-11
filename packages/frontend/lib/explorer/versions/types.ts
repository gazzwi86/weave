/** CE-VERSION-1's `GET /api/proxy/ontology/versions` row shape. */
export interface VersionEntry {
  version_iri: string;
  semver: string;
  published_at: string;
  is_latest: boolean;
}

export interface ContributorRow {
  principal_iri: string;
  role: string;
}

/** TASK-015 AC-4: derives the caller's effective project role client/
 * server-side. `ProjectSettingsResponse` (TASK-014) carries no role field
 * to read instead -- this is a UX mirror only, matching the backend's
 * `has_admin_grant` tenant-scope overlay (rbac.py): a tenant-level
 * `admin` role always overlays any per-project role. Absent an overlay,
 * falls back to matching `principalIri` against the contributors list.
 * The real 403 boundary is server-side; this only shapes which controls
 * render. Returns null (no access -- hide mutations) when unresolved. */
export function deriveProjectRole(
  tenantRole: string | null,
  principalIri: string | null,
  contributors: ContributorRow[]
): "admin" | "editor" | null {
  if (tenantRole === "admin") return "admin";
  if (!principalIri) return null;

  const contributor = contributors.find((c) => c.principal_iri === principalIri);
  return contributor?.role === "admin" || contributor?.role === "editor" ? contributor.role : null;
}

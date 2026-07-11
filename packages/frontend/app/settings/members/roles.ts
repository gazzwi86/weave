/** TASK-030 AC-3: the 10 canonical in-tenant role slugs (`weave-platform.md`
 * "Canonical human roles", mirrored server-side in `rbac.py` ADR-019's
 * `ROLE_RANK` extension). The invite role selector offers only these --
 * never Weave's own internal super-admin role, which has no in-tenant slug
 * and is never assignable via this form.
 */
export interface CanonicalRole {
  slug: string;
  label: string;
}

export const CANONICAL_ROLES: CanonicalRole[] = [
  { slug: "viewer", label: "Viewer" },
  { slug: "automation_author", label: "Automation author" },
  { slug: "ops_sre", label: "Ops / SRE" },
  { slug: "engineer", label: "Engineer" },
  { slug: "brand_content_owner", label: "Brand & content owner" },
  { slug: "data_steward", label: "Data steward" },
  { slug: "business_analyst_sme", label: "Business analyst / SME" },
  { slug: "enterprise_architect", label: "Enterprise architect" },
  { slug: "compliance_officer", label: "Compliance officer" },
  { slug: "workspace_admin", label: "Workspace admin" },
];

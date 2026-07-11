/** AC-6: `audit.chain.invalid` is non-suppressible for a workspace admin or
 * compliance officer -- notifications-recommendation.md's role/type matrix
 * ("Governance | audit.chain.invalid | ... | not suppressible"). Role
 * literals match the AC's own EARS text; M1's session-claims role field
 * still carries the pre-realignment "admin"/"author" pair (PLAT-SETTINGS-1
 * "M1 transition" note) -- this gate is written against the spec's
 * canonical role vocabulary so it needs no rework when that lands. */

const NON_SUPPRESSIBLE_ROLES = new Set(["workspace_admin", "compliance_officer"]);
const NON_SUPPRESSIBLE_TYPE = "audit.chain.invalid";

/** Whether a "mute/suppress this type" control may render for `eventType`
 * given the viewer's `role`. False means: no control renders, and no
 * `PUT /api/notifications/preferences` call is reachable from this row. */
export function canSuppressNotificationType(eventType: string, role: string | null): boolean {
  return !(eventType === NON_SUPPRESSIBLE_TYPE && role !== null && NON_SUPPRESSIBLE_ROLES.has(role));
}

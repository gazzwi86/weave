/** TASK-027 AC-5: fallback target when no edit controller is available
 * (TASK-023/024 absent -- soft dependency, feature-detected). Links into
 * the existing CE Query surface (app/ce/query) pre-filled with the
 * entity, rather than a bespoke entity-detail route this task doesn't own. */
export function ceEditingSurface(entityIri: string): string {
  return `/ce/query?entity=${encodeURIComponent(entityIri)}`;
}

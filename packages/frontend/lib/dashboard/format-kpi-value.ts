/** H2: a KPI value that is a Weave URN ending in a `:vX.Y.Z` version tag
 * (e.g. a workspace snapshot IRI) is unreadable in full at KPI-card size --
 * show just the version, put the full URN in `title` so it's still
 * available on hover/inspect. Any other value passes through unchanged.
 */
const URN_VERSION_TAIL = /^(urn:[^\s]+):(v\d+\.\d+\.\d+)$/;

export function formatKpiValue(value: unknown): { display: string; title?: string } {
  if (typeof value === "string") {
    const match = URN_VERSION_TAIL.exec(value);
    const version = match?.[2];
    if (version) return { display: version, title: value };
  }
  return { display: String(value), title: undefined };
}

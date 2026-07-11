/** TASK-023 AC-6: cytoscape-edgehandles params. The task brief's Design
 * Decisions table says "port params from prototype into
 * config.edgehandlesParams" -- Engineer Law 12 forbids reading
 * `prototype/` directly (only the Architect may extract prototype values
 * into a task brief), and no `edgehandles`-params spike/artifact equivalent
 * to TASK-001's `fcose-params.mjs` exists to cite instead. Substituting the
 * published `cytoscape-edgehandles` library defaults here, disclosed
 * (ADR-022) rather than guessed -- same substitution shape as GE-TASK-001's
 * fcose default fallback. `canConnect` is stated explicitly even though it
 * matches the library default, so the self-loop block is documented intent
 * here, not an unread default. */
export const EDGEHANDLES_PARAMS = Object.freeze({
  canConnect: (source: { id(): string }, target: { id(): string }) => source.id() !== target.id(),
  hoverDelay: 150,
  snap: true,
  snapThreshold: 50,
});

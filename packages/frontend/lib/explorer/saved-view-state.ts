import type { FilterState } from "./filter-state";
import type { Viewport } from "./renderer-adapter";

/** TASK-026: what a saved view's `definition` JSONB column stores --
 * FilterState must round-trip verbatim (TASK-020 dependency), the rest is
 * new for this task. `domainFocus` is the focused domain's IRI, or null
 * when no domain focus was active at save time. */
export interface SavedViewDefinition {
  filterState: FilterState;
  activeOverlayIds: string[];
  domainFocus: string | null;
  viewport: Viewport;
}

export interface SaveViewInput {
  name: string;
  overwrite?: boolean;
  definition: SavedViewDefinition;
  /** adapter.allNodePositions()'s id-keyed shape -- converted to the API's
   * array-of-rows wire shape below. */
  positions: Record<string, { x: number; y: number }>;
}

export interface ViewSaveBody {
  name: string;
  overwrite: boolean;
  definition: SavedViewDefinition;
  positions: { node_iri: string; position_x: number; position_y: number }[];
}

/** AC-1: builds the exact POST /api/views wire body (schemas/views.py's
 * ViewCreateRequest/ViewPositionIn shapes). */
export function buildSaveViewBody(input: SaveViewInput): ViewSaveBody {
  return {
    name: input.name,
    overwrite: input.overwrite ?? false,
    definition: input.definition,
    positions: Object.entries(input.positions).map(([nodeIri, position]) => ({
      node_iri: nodeIri,
      position_x: position.x,
      position_y: position.y,
    })),
  };
}

/** AC-3: entities a view references (saved position rows + the domain
 * focus IRI) that are absent from the freshly loaded graph -- entity-type/
 * relationship-type tokens in filterState are kind tokens, not entity
 * IRIs, so they're never candidates. */
export function computeMissingEntityIds(
  definition: SavedViewDefinition,
  positionNodeIris: string[],
  loadedIds: ReadonlySet<string>
): string[] {
  const candidates = new Set(positionNodeIris);
  if (definition.domainFocus) candidates.add(definition.domainFocus);
  return [...candidates].filter((id) => !loadedIds.has(id));
}

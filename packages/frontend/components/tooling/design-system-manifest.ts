/**
 * The TASK-026 starting-set manifest: single source of truth for which
 * component lives in which atomic-design layer and which of the closed
 * AC-4 states {default, hover, selected, loading, empty, error} it actually
 * exposes. Applicability is tied to each component's real prop surface (see
 * its .tsx file) -- this manifest doesn't invent states a component can't
 * render, it just names the ones it does.
 */
export type Layer = "atoms" | "molecules" | "organisms" | "templates";
export type StoryState = "default" | "hover" | "selected" | "loading" | "empty" | "error";

export interface ManifestEntry {
  name: string;
  layer: Layer;
  states: StoryState[];
}

export const DESIGN_SYSTEM_MANIFEST: ManifestEntry[] = [
  // atoms -- 5 pre-existing components/ui/* files, extended with layer tags.
  { name: "Button", layer: "atoms", states: ["default", "hover", "loading"] },
  { name: "Input", layer: "atoms", states: ["default", "error"] },
  { name: "Badge", layer: "atoms", states: ["default"] },
  { name: "Card", layer: "atoms", states: ["default", "selected"] },
  { name: "Toast", layer: "atoms", states: ["default"] },

  // molecules
  { name: "EntityRef", layer: "molecules", states: ["default"] },
  { name: "KindChip", layer: "molecules", states: ["default"] },
  { name: "PageHeader", layer: "molecules", states: ["default"] },
  { name: "CanvasLegend", layer: "molecules", states: ["default"] },
  { name: "KpiTile", layer: "molecules", states: ["default", "loading", "empty"] },
  { name: "AskBar", layer: "molecules", states: ["default", "loading"] },
  { name: "CanvasToolbar", layer: "molecules", states: ["default", "selected"] },
  { name: "EmptyState", layer: "molecules", states: ["default"] },

  // organisms
  { name: "NavRail", layer: "organisms", states: ["default", "selected"] },
  { name: "SecondarySidebar", layer: "organisms", states: ["default", "selected"] },
  { name: "AppHeader", layer: "organisms", states: ["default"] },
  { name: "CommandBar", layer: "organisms", states: ["default", "loading", "empty"] },
  { name: "BellPanel", layer: "organisms", states: ["default", "empty"] },
  { name: "UserMenu", layer: "organisms", states: ["default"] },
  { name: "DataTable", layer: "organisms", states: ["default", "loading", "empty", "error", "selected"] },
  { name: "InspectorPanel", layer: "organisms", states: ["default", "loading", "empty"] },
  { name: "GlassPanel", layer: "organisms", states: ["default"] },

  // templates
  { name: "CanvasPage", layer: "templates", states: ["default"] },
  { name: "TablePage", layer: "templates", states: ["default"] },
  { name: "FormDrawerPage", layer: "templates", states: ["default"] },
  { name: "DashboardGrid", layer: "templates", states: ["default"] },
];

function pascalState(state: StoryState): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/** Story export names a component's manifest entry requires: one per state,
 * per theme (light default export name, `*Dark` for the dark pair). */
export function expectedStoryExportNames(entry: ManifestEntry): string[] {
  return entry.states.flatMap((state) => {
    const base = pascalState(state);
    return [base, `${base}Dark`];
  });
}

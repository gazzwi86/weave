import type { AreaId, EngineId, Phase } from "./types";

export type Anchor = {
  engine: EngineId;
  area: AreaId;
  phase: Phase;
  /**
   * Flips to true in the same PR that plants the `data-tour-id` attribute
   * (ADR-008). Defaults false -- nothing is planted by TASK-003.
   */
  shipped: boolean;
  /** The single onboarding task that owns planting this anchor's attribute. */
  planted_by: string;
};

/**
 * Anchor id -> owning engine/area/phase (ADR-005), plus the per-anchor
 * shipped signal (ADR-008). `as const satisfies` keeps `keyof` typing
 * flowing into the content schemas' zod enums.
 */
export const ANCHORS = {
  // M1 -- Constitution (CE) screen inventory.
  "ce.overview": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.glossary": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.query": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.rules": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.types": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.versions": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ce.brand": { engine: "constitution", area: "constitution", phase: "m1", shipped: false, planted_by: "TASK-007" },
  // M1 -- Graph Explorer.
  "ge.canvas": { engine: "graph-explorer", area: "explorer", phase: "m1", shipped: false, planted_by: "TASK-007" },
  "ge.canvas.spotlight-control": { engine: "graph-explorer", area: "explorer", phase: "m1", shipped: false, planted_by: "TASK-007" },
  // M1 -- no-tour areas (welcome modal only; AC-003-02).
  "compliance.page": { engine: "constitution", area: "compliance", phase: "m1", shipped: false, planted_by: "TASK-008" },
  "settings.page": { engine: "platform", area: "settings", phase: "m1", shipped: false, planted_by: "TASK-008" },
  // M2 -- registered now, no DOM yet (ADR-005).
  "ce.metrics-tile": { engine: "constitution", area: "constitution", phase: "m2", shipped: false, planted_by: "TASK-014" },
  // post-v1 -- registered now, no DOM yet (ADR-005).
  "build.project-list": { engine: "build", area: "build", phase: "post-v1", shipped: false, planted_by: "TASK-014" },
  "events.rule-list": { engine: "events", area: "events", phase: "post-v1", shipped: false, planted_by: "TASK-014" },
} as const satisfies Record<string, Anchor>;

export type AnchorId = keyof typeof ANCHORS;

export const anchorIds = Object.keys(ANCHORS) as AnchorId[];

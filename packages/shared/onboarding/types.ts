/** Shared enums for the onboarding content-config package (ADR-005, ADR-006, ADR-008). */

/** Engines the onboarding registry can point an anchor at. */
export type EngineId = "constitution" | "graph-explorer" | "build" | "events" | "platform";

/** Primary navigation areas an anchor lives in. */
export type AreaId =
  | "constitution"
  | "explorer"
  | "build"
  | "events"
  | "compliance"
  | "settings"
  | "role-home";

/** Milestone an anchor's owning surface belongs to (descriptive only — ADR-008). */
export type Phase = "m1" | "m2" | "post-v1";

/** The 10->4 role-path mapping (business-process.md); zero-role/Viewer defaults to "business". */
export type RolePath = "business" | "technical" | "compliance" | "admin";

import type { BadgeProps } from "@/components/ui/badge";

import type { DecisionEntry } from "./use-decision-log";

// AC-7: one namespace->kind map already drives the server's own
// classification (audit/decisions.py's classify_kind) -- this is just the
// display label/variant for each of that map's 3 outputs, never a second
// source of truth for what a kind IS. Shared by the table row and the
// detail drawer (refit-mock #sub-bld-decisions), so it lives here rather
// than in either component.
export const KIND_CHIP: Record<DecisionEntry["kind"], { label: string; variant: BadgeProps["variant"] }> = {
  decision: { label: "Decision", variant: "info" },
  task_update: { label: "Task update", variant: "neutral" },
  system: { label: "System", variant: "warn" },
};

// AC-9: PLAT-IDENTITY-1 mints human principals as
// urn:weave:principal:user:{cognito_sub} -- anything else is agent/service.
// Parsed client-side from the already-fetched IRI, never a per-row lookup.
export function actorLabel(actorPrincipalIri: string): string {
  return actorPrincipalIri.includes(":user:") ? "Human" : "Agent";
}
